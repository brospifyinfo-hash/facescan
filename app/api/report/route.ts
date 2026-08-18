import { NextResponse } from "next/server";
import { requireCapability } from "@/lib/access";
import { callVisionModel, VisionError } from "@/lib/vision/openai";
import { parseDataUrl } from "@/lib/vision/image";
import { VISION_MODEL } from "@/lib/vision/contract";
import { imageRef, log, newRequestId } from "@/lib/vision/log";
import { sha256 } from "@/lib/vision/cache";

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
// a 429 is read, and a log that never prints a photograph. Its structured
// output is now optional, because a report is Markdown rather than JSON —
// wrapping a document in a JSON string field buys nothing and adds an
// escaping layer that can truncate mid-sentence.
//
// GATED SERVER-SIDE on requireCapability("blueprint"): a signed session for
// the address, plus the entitlement whenever one could exist. See
// lib/access.ts for why the second half is conditional.

export const runtime = "nodejs";
export const maxDuration = 60;

/** Long enough for a full document; three attempts still fit maxDuration. */
const TIMEOUT_MS = Number(process.env.REPORT_TIMEOUT_MS ?? 50_000);
const MAX_ATTEMPTS = 2;
/**
 * The report runs to roughly 1,200 words across six sections. 6000 leaves
 * generous headroom — and a truncated Markdown document is not degraded, it
 * is a report that stops mid-sentence, so the ceiling is set high rather
 * than tight.
 */
const MAX_OUTPUT_TOKENS = Number(process.env.REPORT_MAX_OUTPUT_TOKENS ?? 6000);

const SYSTEM = `You are a facial-aesthetics coach writing a personalized report.
You receive one or two photos (front, and optionally a side profile),
on-device geometric measurements (0-100 heuristic scores plus canthal tilt in
degrees), and the user's quiz answers.

Rules:
- Be honest and specific, but constructive and respectful. Never demean.
- No medical or dermatological diagnoses. For skin/hair concerns that look
  clinical, recommend seeing a professional.
- Ground every observation in what is actually visible or measured.
- Do not invent numeric ratings beyond the provided metrics.

Structure the report in Markdown with these sections:
1. Overview — two or three sentences summarizing the overall picture.
2. Your measurements, explained — what each score means for this face.
3. Strengths — what already works well (be specific).
4. Three focus areas — the biggest realistic levers, with reasoning.
5. 4-week action plan — concrete weekly steps covering skincare (AM/PM),
   jawline & posture, grooming/hairstyle suggestions, and lifestyle.
6. Closing note — brief, encouraging, no fluff.`;

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
  try {
    const body = await req.json();
    front = parseDataUrl(body?.front, "front");
    side = body?.side ? parseDataUrl(body.side, "side") : null;
    quiz = body?.quiz ?? {};
    metrics = body?.metrics ?? {};
  } catch (err) {
    const message =
      err instanceof VisionError ? err.message : "The request body could not be read.";
    log.warn("report_bad_request", { requestId, errorKind: "input" });
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const ref = imageRef(sha256(front.base64));

  const instruction = [
    `Quiz answers:\n${JSON.stringify(quiz, null, 2)}`,
    `\nOn-device scan metrics:\n${JSON.stringify(metrics, null, 2)}`,
    `\nWrite the personalized report now. The first image is the front profile${
      side ? ", the second is the side profile" : " (no side profile provided)"
    }.`,
  ].join("\n");

  try {
    const call = await callVisionModel({
      model: VISION_MODEL,
      system: SYSTEM,
      instruction,
      images: side ? [front, side] : [front],
      timeoutMs: TIMEOUT_MS,
      maxAttempts: MAX_ATTEMPTS,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      requestId,
      logFields: { imageRef: ref },
    });

    log.info("report_served", {
      requestId,
      imageRef: ref,
      ms: Date.now() - started,
      attempt: call.attempts,
      inputTokens: call.inputTokens,
      outputTokens: call.outputTokens,
    });

    return NextResponse.json({ report: call.text });
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
