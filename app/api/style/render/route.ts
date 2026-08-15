import { NextResponse } from "next/server";

// Stage 2: one picture per request.
//
// ONE, not three. The client calls this three times and shows each result as
// it lands. Three pictures in one request would be a fifty-second function
// on a sixty-second budget where the third failure discards the first two,
// and the customer would watch a spinner for the whole minute with no idea
// whether anything was happening.
//
// THE PROMPT IN THE BODY IS UNTRUSTED. It was written by stage 1 but it
// arrived here by way of a browser, so it is treated exactly as if a
// stranger had typed it: length-capped in sanitisePrompt(), then quoted
// inside a fixed frame whose rules are restated afterwards, so the last
// instruction the image model reads is ours. Without that pair this endpoint
// is a free image generator billed to us.
//
// THE QUOTA IS CHARGED ON SUCCESS, NOT ON ARRIVAL. A render that fails
// upstream cost us nothing at OpenAI and must not cost the customer one of
// their nine. The race this opens — two tabs both passing the check before
// either charges — is bounded by the check itself running first, so the
// worst case is a couple of pictures over the line, not an unmetered loop.

import { VisionError } from "@/lib/vision/openai";
import { parseDataUrl } from "@/lib/vision/image";
import { imageRef, log, newRequestId } from "@/lib/vision/log";
import { sha256 } from "@/lib/vision/cache";
import { editImage } from "@/lib/style/images";
import { renderPrompt, projectPrompt } from "@/lib/style/prompt";
import { sanitisePrompt } from "@/lib/style/types";
import { gateStyle } from "@/lib/style/gate";
import { chargeImage, IMAGE_QUOTA } from "@/lib/style/quota";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * The whole function has 60 s. The deadline is set below that so the failure
 * path still has time to send an error instead of being killed mid-write —
 * an unexplained dead socket is the worst thing this endpoint can return.
 */
const BUDGET_MS = Number(process.env.STYLE_RENDER_BUDGET_MS ?? 52_000);
const PER_ATTEMPT_MS = Number(process.env.STYLE_RENDER_TIMEOUT_MS ?? 50_000);

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
  const deadline = started + BUDGET_MS;

  const gate = await gateStyle();
  if (!gate.ok) {
    log.warn("render_refused", { requestId, errorKind: gate.error });
    return NextResponse.json(
      { error: gate.error, ...("quota" in gate ? { quota: gate.quota } : {}) },
      { status: gate.status },
    );
  }

  let photo: ReturnType<typeof parseDataUrl>;
  let prompt: string;
  let kind: "hairstyle" | "projection";
  try {
    const body = await req.json();
    photo = parseDataUrl(body?.photo, "photo");
    const clean = sanitisePrompt(body?.prompt);
    if (!clean) throw new Error("prompt rejected");
    prompt = clean;
    kind = body?.kind === "projection" ? "projection" : "hairstyle";
  } catch (err) {
    const message =
      err instanceof VisionError ? err.message : "The request body could not be read.";
    log.warn("render_bad_request", { requestId, errorKind: "input" });
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const ref = imageRef(sha256(photo.base64));

  try {
    const result = await editImage({
      prompt: kind === "projection" ? projectPrompt(prompt) : renderPrompt(prompt),
      image: { mediaType: photo.mediaType, base64: photo.base64 },
      timeoutMs: PER_ATTEMPT_MS,
      deadline,
      requestId,
      logFields: { imageRef: ref, kind },
    });

    const used = await chargeImage(gate.email);

    log.info("render_served", {
      requestId,
      imageRef: ref,
      kind,
      ms: Date.now() - started,
      attempt: result.attempts,
      used,
    });

    return NextResponse.json({
      image: `data:${result.mediaType};base64,${result.base64}`,
      quota: { used, limit: IMAGE_QUOTA, remaining: Math.max(0, IMAGE_QUOTA - used) },
    });
  } catch (err) {
    if (err instanceof VisionError) {
      log.error("render_failed", { requestId, imageRef: ref, kind, errorKind: err.kind, ms: Date.now() - started });
      const message =
        err.kind === "refused"
          ? "The image service declined this photo. Try a different one."
          : err.kind === "not_configured"
            ? "Image generation is not configured — set OPENAI_API_KEY."
            : err.kind === "timeout"
              ? "The image took too long. Try again."
              : "The image could not be generated. Please try again.";
      return NextResponse.json({ error: message, kind: err.kind }, { status: STATUS[err.kind] });
    }
    log.error("render_failed", { requestId, imageRef: ref, kind, errorKind: "unexpected" });
    return NextResponse.json(
      { error: "The image could not be generated. Please try again." },
      { status: 500 },
    );
  }
}
