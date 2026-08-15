import { NextResponse } from "next/server";

// Stage 1 of the style studio: which two cuts suit this face, and why.
//
// Text only. It costs a fraction of a cent and returns in a couple of
// seconds, which is why it is its own endpoint — the customer reads the
// recommendation while the pictures are still rendering, and a picture that
// fails does not take the advice down with it.
//
// The prompts it hands to stage 2 travel back through the browser. That is
// deliberate (no server-side session state for a one-shot flow) and it is
// why /api/style/render treats what it receives as untrusted. See the
// header of lib/style/prompt.ts.

import { callVisionModel, VisionError } from "@/lib/vision/openai";
import { parseDataUrl } from "@/lib/vision/image";
import { imageRef, log, newRequestId } from "@/lib/vision/log";
import { sha256 } from "@/lib/vision/cache";
import {
  STYLE_MODEL,
  STYLE_PROMPT_VERSION,
  adviceInstruction,
  adviceSystemPrompt,
  toAdvice,
} from "@/lib/style/prompt";
import { STYLE_RESPONSE_FORMAT } from "@/lib/style/schema";
import { STYLE_FACE_SHAPES, UPKEEP_LEVELS, MAX_PROMPT_CHARS } from "@/lib/style/types";
import { gateStyle } from "@/lib/style/gate";
import { LOCALES } from "@/lib/i18n/types";
import type { QuizAnswers, ScanMetrics } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 60;

const TIMEOUT_MS = Number(process.env.STYLE_TIMEOUT_MS ?? 40_000);
const MAX_ATTEMPTS = 2;

const STATUS: Record<VisionError["kind"], number> = {
  not_configured: 501,
  timeout: 504,
  rate_limited: 429,
  upstream: 502,
  refused: 422,
  malformed: 502,
  network: 502,
};

/** Clamp to the closed vocabularies rather than trusting the enum held. */
function validate(raw: any): ReturnType<typeof toAdvice> | null {
  const shape = STYLE_FACE_SHAPES.includes(raw?.faceShape) ? raw.faceShape : "oval";
  const cut = (c: any) =>
    c && typeof c.name === "string" && typeof c.imagePrompt === "string"
      ? {
          name: String(c.name).slice(0, 60),
          reason: String(c.reason ?? "").slice(0, 400),
          barberBrief: String(c.barberBrief ?? "").slice(0, 500),
          upkeep: UPKEEP_LEVELS.includes(c.upkeep) ? c.upkeep : "medium",
          imagePrompt: String(c.imagePrompt).slice(0, MAX_PROMPT_CHARS),
        }
      : null;

  const primary = cut(raw?.primary);
  const alternate = cut(raw?.alternate);
  if (!primary || !alternate) return null;
  if (typeof raw?.projectionPrompt !== "string" || raw.projectionPrompt.length < 8) return null;

  return toAdvice({
    faceShape: shape,
    shapeNote: String(raw?.shapeNote ?? "").slice(0, 300),
    primary,
    alternate,
    projectionPrompt: raw.projectionPrompt.slice(0, MAX_PROMPT_CHARS),
    projectionNote: String(raw?.projectionNote ?? "").slice(0, 300),
  });
}

export async function POST(req: Request) {
  const requestId = newRequestId();
  const started = Date.now();

  const gate = await gateStyle();
  if (!gate.ok) {
    log.warn("style_refused", { requestId, errorKind: gate.error });
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  if (gate.entitlementUnenforced) {
    log.warn("style_entitlement_unenforced", { requestId });
  }

  let photo: ReturnType<typeof parseDataUrl>;
  let quiz: QuizAnswers;
  let metrics: ScanMetrics;
  let locale = "de";
  try {
    const body = await req.json();
    photo = parseDataUrl(body?.photo, "photo");
    quiz = body?.quiz ?? {};
    metrics = body?.metrics ?? {};
    if (typeof metrics?.overall !== "number") throw new Error("metrics missing");
    if (LOCALES.includes(body?.locale)) locale = body.locale;
  } catch (err) {
    const message =
      err instanceof VisionError ? err.message : "The request body could not be read.";
    log.warn("style_bad_request", { requestId, errorKind: "input" });
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const ref = imageRef(sha256(photo.base64));

  try {
    const call = await callVisionModel({
      model: STYLE_MODEL,
      system: adviceSystemPrompt(),
      instruction: adviceInstruction(quiz, metrics, locale),
      images: [photo],
      responseFormat: STYLE_RESPONSE_FORMAT,
      timeoutMs: TIMEOUT_MS,
      maxAttempts: MAX_ATTEMPTS,
      maxOutputTokens: 1600,
      requestId,
      logFields: { imageRef: ref, promptVersion: STYLE_PROMPT_VERSION },
    });

    const advice = validate(JSON.parse(call.text));
    if (!advice) {
      log.error("style_malformed", { requestId, imageRef: ref });
      return NextResponse.json(
        { error: "The recommendation came back incomplete. Please try again." },
        { status: 502 },
      );
    }

    log.info("style_served", {
      requestId,
      imageRef: ref,
      ms: Date.now() - started,
      attempt: call.attempts,
      inputTokens: call.inputTokens,
      outputTokens: call.outputTokens,
    });

    return NextResponse.json({ advice, quota: gate.quota });
  } catch (err) {
    if (err instanceof VisionError) {
      log.error("style_failed", { requestId, imageRef: ref, errorKind: err.kind, ms: Date.now() - started });
      const message =
        err.kind === "refused"
          ? err.message
          : err.kind === "not_configured"
            ? "The style analysis is not configured — set OPENAI_API_KEY."
            : err.kind === "timeout"
              ? "The recommendation took too long. Try again with a smaller photo."
              : "The recommendation could not be completed. Please try again.";
      return NextResponse.json({ error: message, kind: err.kind }, { status: STATUS[err.kind] });
    }
    log.error("style_failed", { requestId, imageRef: ref, errorKind: "unexpected" });
    return NextResponse.json(
      { error: "The recommendation could not be completed. Please try again." },
      { status: 500 },
    );
  }
}
