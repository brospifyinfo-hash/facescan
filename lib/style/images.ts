// Transport for the OpenAI image-edit endpoint.
//
// WHY THIS IS NOT lib/vision/openai.ts WITH A DIFFERENT URL
// ---------------------------------------------------------
// Different endpoint, different encoding, and — the part that actually
// forces a separate file — a different relationship with time. A text call
// takes two seconds and can be retried three times inside a 60 s function.
// An image edit takes twenty to fifty, so a fixed "three attempts of 45 s"
// policy would be a lie: the function is killed by the platform partway
// through attempt two and the customer gets a dead socket instead of an
// error.
//
// So this retries against a DEADLINE rather than a count. Before sleeping it
// asks whether there is enough budget left for another attempt to plausibly
// finish; if not, it gives up now and returns a real error while there is
// still time to send one. Retrying into a wall is worse than not retrying:
// it converts a clean 502 into a timeout with no message.
//
// input_fidelity: "high" IS THE FEATURE. Without it the edit endpoint
// returns a plausible man with the requested haircut, and it is not the
// customer. High fidelity is what keeps the face on the photograph the face
// in the result — which is the entire premise of showing someone a haircut
// on themselves rather than on a model.

import { VisionError } from "../vision/openai";
import { log, type LogFields } from "../vision/log";
import { IMAGE_MODEL } from "./prompt";

const ENDPOINT = "https://api.openai.com/v1/images/edits";

const RETRYABLE = new Set([408, 409, 429, 500, 502, 503, 504, 529]);

export interface ImageEditOptions {
  prompt: string;
  image: { mediaType: string; base64: string };
  /** Per-attempt timeout. */
  timeoutMs: number;
  /** Absolute deadline (epoch ms). No attempt starts that cannot finish. */
  deadline: number;
  requestId: string;
  logFields?: LogFields;
}

export interface ImageEditResult {
  /** Base64 PNG, without the data-URL prefix. */
  base64: string;
  attempts: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Full jitter, capped short — the budget here is measured in seconds. */
const backoff = (attempt: number) =>
  Math.round(Math.random() * Math.min(4000, 800 * 2 ** (attempt - 1)));

export async function editImage(opts: ImageEditOptions): Promise<ImageEditResult> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new VisionError(
      "not_configured",
      "OPENAI_API_KEY is not set — images cannot be generated.",
    );
  }

  const bytes = Buffer.from(opts.image.base64, "base64");
  const ext = opts.image.mediaType === "image/png" ? "png" : opts.image.mediaType === "image/webp" ? "webp" : "jpg";

  const base: LogFields = {
    requestId: opts.requestId,
    model: IMAGE_MODEL,
    ...opts.logFields,
  };

  let lastError: VisionError | null = null;

  for (let attempt = 1; ; attempt++) {
    // The form is rebuilt per attempt: a consumed body cannot be re-sent.
    const form = new FormData();
    form.append("model", IMAGE_MODEL);
    form.append("prompt", opts.prompt);
    form.append("n", "1");
    form.append("size", "1024x1024");
    form.append("quality", "medium");
    // Keeps the customer's own face on the result. See the header.
    form.append("input_fidelity", "high");
    form.append(
      "image",
      new Blob([new Uint8Array(bytes)], { type: opts.image.mediaType }),
      `photo.${ext}`,
    );

    const remaining = opts.deadline - Date.now();
    if (remaining <= 2000) {
      throw (
        lastError ??
        new VisionError("timeout", "There was no time left to generate the image.")
      );
    }

    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(opts.timeoutMs, remaining));

    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}` },
        body: form,
        signal: controller.signal,
      });

      const ms = Date.now() - started;

      if (!res.ok) {
        // Read and discard: the error body can echo the prompt, and a
        // moderation refusal echoes it in full.
        const raw = await res.text().catch(() => "");
        const kind =
          res.status === 429
            ? "rate_limited"
            : res.status === 401 || res.status === 403
              ? "not_configured"
              : res.status === 400 && /moderation|safety|policy/i.test(raw)
                ? "refused"
                : "upstream";
        lastError = new VisionError(kind, `The image service returned ${res.status}.`, res.status);

        const budget = opts.deadline - Date.now();
        // Another attempt only if one could plausibly finish. `ms` is what
        // this attempt cost, and the next will cost about the same.
        if (!RETRYABLE.has(res.status) || budget < ms + 3000) {
          log.error("image_failed", { ...base, attempt, ms, status: res.status, errorKind: kind });
          throw lastError;
        }
        const delay = backoff(attempt);
        log.warn("image_retry", { ...base, attempt, ms, status: res.status, errorKind: kind, retryInMs: delay });
        await sleep(delay);
        continue;
      }

      const json = await res.json();
      const b64 = json?.data?.[0]?.b64_json;
      if (typeof b64 !== "string" || b64.length === 0) {
        throw new VisionError("malformed", "The image service returned no image.");
      }

      log.info("image_ok", { ...base, attempt, ms, bytes: Math.floor((b64.length * 3) / 4) });
      return { base64: b64, attempts: attempt };
    } catch (err) {
      const ms = Date.now() - started;
      if (err instanceof VisionError) throw err;

      const aborted = err instanceof Error && err.name === "AbortError";
      lastError = aborted
        ? new VisionError("timeout", "The image took too long to generate.")
        : new VisionError("network", "The image request could not be completed.");

      const budget = opts.deadline - Date.now();
      if (budget < ms + 3000) {
        log.error("image_failed", { ...base, attempt, ms, errorKind: lastError.kind });
        throw lastError;
      }
      const delay = backoff(attempt);
      log.warn("image_retry", { ...base, attempt, ms, errorKind: lastError.kind, retryInMs: delay });
      await sleep(delay);
    } finally {
      clearTimeout(timer);
    }
  }
}
