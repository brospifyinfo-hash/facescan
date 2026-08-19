import { NextResponse } from "next/server";
import { requireCapability } from "@/lib/access";
import { callVisionModel, VisionError } from "@/lib/vision/openai";
import { parseDataUrl } from "@/lib/vision/image";
import { VISION_MODEL } from "@/lib/vision/contract";
import { imageRef, log, newRequestId } from "@/lib/vision/log";
import { sha256 } from "@/lib/vision/cache";
import {
  REPORT_RESPONSE_FORMAT,
  reportInstruction,
  reportSystemPrompt,
  validateReport,
} from "@/lib/report/contract";
import { LOCALES, type Locale } from "@/lib/i18n/types";

// The paid deep-dive report.
//
// ONE PROVIDER, ONE KEY. This used to call Claude through @anthropic-ai/sdk
// while the hairstyle studio and the projection ran on OpenAI, so the product
// needed two accounts, two keys and two billing relationships for three
// features that do the same kind of work. ANTHROPIC_API_KEY was never set in
// production, which meant the deep-dive answered 501 to every customer who
// paid for it. It now runs on OPENAI_API_KEY like everything else.
//
// IT REUSES lib/vision/openai.ts rather than posting to the API itself. That
// transport already owns the parts that are easy to get wrong and tedious to
// write twice: what is retried and what is not, the per-attempt timeout, how
// a 429 is read, and a log that never prints a photograph.
//
// STRUCTURED, IN THE CUSTOMER'S LANGUAGE. The contract (schema, prompts,
// validation) lives in lib/report/contract.ts, shared with the live smoke
// test — see the header there for why the report stopped being Markdown.
//
// GATED SERVER-SIDE on requireCapability("blueprint"): a signed session for
// the address, plus the entitlement whenever one could exist. See
// lib/access.ts for why the second half is conditional.

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Long enough for a full document — GPT-4.1 takes 20-40 s for ~1,200 words —
 * and deliberately ONE attempt: a second 50 s try cannot fit inside
 * maxDuration, so it would not be a retry, it would be Vercel killing the
 * function mid-write and the customer getting a dead socket instead of the
 * classified error below. A failed run is retried by the button, not here.
 */
const TIMEOUT_MS = Number(process.env.REPORT_TIMEOUT_MS ?? 50_000);
const MAX_ATTEMPTS = 1;
/**
 * The report runs to roughly 1,200 words across six sections. 6000 leaves
 * generous headroom — and a truncated Markdown document is not degraded, it
 * is a report that stops mid-sentence, so the ceiling is set high rather
 * than tight.
 */
const MAX_OUTPUT_TOKENS = Number(process.env.REPORT_MAX_OUTPUT_TOKENS ?? 6000);

const STATUS: Record<VisionError["kind"], number> = {
  not_configured: 501,
  timeout: 504,
  rate_limited: 429,
  upstream: 502,
  refused: 422,
  malformed: 502,
  network: 502,
};

export async function POST(req: Request) {
  const requestId = newRequestId();
  const started = Date.now();

  // Before anything that could reveal configuration: an unauthorised caller
  // must not be able to learn whether the feature is even switched on.
  const access = await requireCapability("blueprint");
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  if (!access.enforced) {
    console.warn("[report] entitlement not enforced; purchases cannot be granted");
  }

  let front: ReturnType<typeof parseDataUrl>;
  let side: ReturnType<typeof parseDataUrl> | null = null;
  let quiz: unknown;
  let metrics: unknown;
  // German is the default because it is the product's home market — the
  // same fallback the style studio uses. The old route never named a
  // language at all, so every report came back in English.
  let locale: Locale = "de";
  try {
    const body = await req.json();
    front = parseDataUrl(body?.front, "front");
    side = body?.side ? parseDataUrl(body.side, "side") : null;
    quiz = body?.quiz ?? {};
    metrics = body?.metrics ?? {};
    if (LOCALES.includes(body?.locale)) locale = body.locale;
  } catch (err) {
    const message =
      err instanceof VisionError ? err.message : "The request body could not be read.";
    log.warn("report_bad_request", { requestId, errorKind: "input" });
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const ref = imageRef(sha256(front.base64));

  try {
    const call = await callVisionModel({
      model: VISION_MODEL,
      system: reportSystemPrompt(locale),
      instruction: reportInstruction(quiz, metrics, side !== null),
      images: side ? [front, side] : [front],
      responseFormat: REPORT_RESPONSE_FORMAT,
      timeoutMs: TIMEOUT_MS,
      maxAttempts: MAX_ATTEMPTS,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      requestId,
      logFields: { imageRef: ref },
    });

    const report = validateReport(JSON.parse(call.text));
    if (!report) {
      log.error("report_malformed", { requestId, imageRef: ref });
      return NextResponse.json(
        { error: "The report came back incomplete. Please try again." },
        { status: 502 },
      );
    }

    log.info("report_served", {
      requestId,
      imageRef: ref,
      ms: Date.now() - started,
      attempt: call.attempts,
      inputTokens: call.inputTokens,
      outputTokens: call.outputTokens,
    });

    return NextResponse.json({ report });
  } catch (err) {
    if (err instanceof VisionError) {
      log.error("report_failed", {
        requestId,
        imageRef: ref,
        errorKind: err.kind,
        ms: Date.now() - started,
      });
      // A refusal is the model's own words and safe to pass through; the rest
      // are replaced, because an upstream error string can echo the request —
      // and the request contains a photograph.
      const message =
        err.kind === "refused"
          ? err.message
          : err.kind === "not_configured"
            ? "The deep-dive report is not configured — set OPENAI_API_KEY."
            : err.kind === "timeout"
              ? "The report took too long. Please try again."
              : err.kind === "rate_limited"
                ? "The service is busy. Try again in a moment."
                : "Report generation failed — please try again in a moment.";
      return NextResponse.json({ error: message, kind: err.kind }, { status: STATUS[err.kind] });
    }

    log.error("report_failed", { requestId, imageRef: ref, errorKind: "unexpected" });
    return NextResponse.json(
      { error: "Report generation failed — please try again in a moment." },
      { status: 502 },
    );
  }
}
