import { NextResponse } from "next/server";

// GPT-4.1 Vision face analysis — the whole rating, in one call.
//
// This route replaces stages 4 through 8 of the on-device pipeline
// (geometry, quality, skin, scoring, response building) with a single
// vision call. Stages 1 and 3 — MediaPipe's detector and its 478-point
// mesh — still run in the browser, because the mesh overlay on /results is
// drawn from them and a language model cannot produce one.
//
// WHAT IT COSTS AND WHAT THAT BUYS
//   ~1-3 s and a real per-request charge, against ~200 ms and nothing for
//   the local pipeline. What it buys is the thing the local pipeline
//   documents at length that it cannot do: an actual attractiveness
//   judgement rather than a conformity-to-published-proportions measure.
//   See the long comment at the top of lib/analysis/norms.ts.
//
// ⚠️ ENTITLEMENT. Like /api/report, this endpoint spends money and is not
// gated on a verified purchase. The per-IP throttle below limits the blast
// radius; it is not authorisation. Gate it on entitlements before putting a
// production key behind it.

import {
  PROMPT_VERSION,
  VISION_MODEL,
  assertContract,
} from "@/lib/vision/contract";
import { buildSystemPrompt, buildUserInstruction } from "@/lib/vision/prompt";
import { VISION_RESPONSE_FORMAT } from "@/lib/vision/schema";
import { callVisionModel, VisionError } from "@/lib/vision/openai";
import { parseDataUrl } from "@/lib/vision/image";
import { cacheGet, cacheKey, cacheSet, sha256 } from "@/lib/vision/cache";
import { validateVision } from "@/lib/vision/validate";
import { adaptVision, type VisionPayload } from "@/lib/vision/adapt";
import { imageRef, log, newRequestId } from "@/lib/vision/log";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Per-attempt budget. Three attempts must still fit inside maxDuration. */
const TIMEOUT_MS = Number(process.env.VISION_TIMEOUT_MS ?? 45_000);
const MAX_ATTEMPTS = Number(process.env.VISION_MAX_ATTEMPTS ?? 3);
/**
 * Output budget.
 *
 * The document is 25 measurements, 9 modules, a quality block and the
 * findings — around 1.5 k tokens of JSON. 4000 leaves headroom for long
 * notes without letting a runaway generation burn the whole timeout. Too
 * low is not a small problem: a truncated structured output is unparseable,
 * so the request is lost rather than degraded.
 */
const MAX_OUTPUT_TOKENS = Number(process.env.VISION_MAX_OUTPUT_TOKENS ?? 4000);

// ---------------------------------------------------------------------------
// Per-IP throttle
// ---------------------------------------------------------------------------
// In-process and therefore per-warm-instance, which makes it a brake rather
// than a gate — it stops a loop in a browser tab from spending a hundred
// dollars, and it does not stop a distributed caller. Stated plainly rather
// than presented as protection it is not.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = Number(process.env.VISION_RATE_LIMIT ?? 6);
const hits = new Map<string, number[]>();

function throttled(ip: string): { limited: boolean; retryAfter: number } {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX) {
    const retryAfter = Math.ceil((RATE_WINDOW_MS - (now - recent[0])) / 1000);
    hits.set(ip, recent);
    return { limited: true, retryAfter: Math.max(1, retryAfter) };
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return { limited: false, retryAfter: 0 };
}

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

  if (process.env.NODE_ENV !== "production") {
    for (const problem of assertContract()) {
      log.error("contract_drift", { requestId, ...problem });
    }
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  const gate = throttled(ip);
  if (gate.limited) {
    log.warn("throttled", { requestId });
    return NextResponse.json(
      { error: "Too many scans from this address. Wait a moment and try again." },
      { status: 429, headers: { "retry-after": String(gate.retryAfter) } },
    );
  }

  // ---- Input --------------------------------------------------------------
  let front: ReturnType<typeof parseDataUrl>;
  let side: ReturnType<typeof parseDataUrl> | null = null;
  try {
    const body = await req.json();
    front = parseDataUrl(body?.front, "front");
    side = body?.side ? parseDataUrl(body.side, "side") : null;
  } catch (err) {
    const message =
      err instanceof VisionError ? err.message : "The request body could not be read.";
    log.warn("bad_request", { requestId, errorKind: "input" });
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const frontHash = sha256(front.base64);
  const sideHash = side ? sha256(side.base64) : null;
  const ref = imageRef(frontHash);
  const key = cacheKey({
    frontHash,
    sideHash,
    promptVersion: PROMPT_VERSION,
    model: VISION_MODEL,
  });

  // ---- Cache --------------------------------------------------------------
  const cached = cacheGet<VisionPayload>(key);
  if (cached) {
    log.info("served", {
      requestId,
      imageRef: ref,
      cache: "hit",
      ms: Date.now() - started,
      overall: cached.scan.overall,
    });
    return NextResponse.json({ ...cached, meta: { ...cached.meta, cached: true } });
  }

  // ---- Model --------------------------------------------------------------
  try {
    const call = await callVisionModel({
      model: VISION_MODEL,
      system: buildSystemPrompt(),
      instruction: buildUserInstruction(Boolean(side)),
      images: side ? [front, side] : [front],
      responseFormat: VISION_RESPONSE_FORMAT,
      timeoutMs: TIMEOUT_MS,
      maxAttempts: MAX_ATTEMPTS,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      requestId,
      logFields: { imageRef: ref, cache: "miss" },
    });

    const validated = validateVision(call.text);
    const payload = adaptVision(validated, {
      model: VISION_MODEL,
      promptVersion: PROMPT_VERSION,
      cached: false,
    });

    cacheSet(key, payload);

    log.info("served", {
      requestId,
      imageRef: ref,
      cache: "miss",
      ms: Date.now() - started,
      attempt: call.attempts,
      inputTokens: call.inputTokens,
      outputTokens: call.outputTokens,
      repaired: validated.repairs,
      overall: payload.scan.overall,
    });
    if (validated.repairs > 0) {
      log.warn("repaired", { requestId, imageRef: ref, repaired: validated.repairs, notes: validated.repairNotes });
    }

    return NextResponse.json(payload);
  } catch (err) {
    if (err instanceof VisionError) {
      log.error("failed", {
        requestId,
        imageRef: ref,
        errorKind: err.kind,
        ms: Date.now() - started,
      });
      // A refusal is the model's own words and is safe to pass through; the
      // rest are replaced with a message that says what the user can do,
      // because an upstream error string can echo the request.
      const message =
        err.kind === "refused"
          ? err.message
          : err.kind === "not_configured"
            ? "The vision analysis is not configured — set OPENAI_API_KEY."
            : err.kind === "timeout"
              ? "The analysis took too long. Try again with a smaller photo."
              : err.kind === "rate_limited"
                ? "The analysis service is busy. Try again in a moment."
                : "The analysis could not be completed. Please try again.";
      const headers =
        err.kind === "rate_limited" && err.retryAfterMs
          ? { "retry-after": String(Math.ceil(err.retryAfterMs / 1000)) }
          : undefined;
      return NextResponse.json({ error: message, kind: err.kind }, { status: STATUS[err.kind], headers });
    }

    log.error("failed", { requestId, imageRef: ref, errorKind: "unexpected", ms: Date.now() - started });
    return NextResponse.json(
      { error: "The analysis could not be completed. Please try again." },
      { status: 500 },
    );
  }
}
