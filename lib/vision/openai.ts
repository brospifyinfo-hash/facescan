// Transport for the OpenAI Responses API.
//
// WHY fetch AND NOT THE SDK
// -------------------------
// An SDK buys a typed wrapper around a single POST and costs a dependency
// that has to be kept in step with the runtime. The Responses API is one
// endpoint with a JSON body; everything that actually matters here — the
// retry policy, the timeout, how a 429 is read — has to be written by hand
// either way, and writing it against fetch means it is visible rather than
// buried in a client's defaults.
//
// This paragraph used to justify itself by pointing at @anthropic-ai/sdk,
// which the paid report ran on. That dependency is gone: the report now uses
// this transport too, so the whole product speaks to one provider with one
// key. The argument stands on its own.
//
// WHAT THE RETRY POLICY IS FOR, AND WHAT IT IS NOT FOR
// ----------------------------------------------------
// Retried: 408, 409, 429, 5xx, and network/abort failures. These are
// transient by definition.
// NOT retried: 400 (a schema the API rejected — retrying sends the same
// broken schema), 401/403 (a key problem), 404 (a model name problem), and
// a refusal. Retrying a deterministic failure just multiplies the latency
// before the user sees the same error.
//
// The delay honours `retry-after` when the API sends one, because guessing
// against a server that has told you the answer is how a rate limit turns
// into a rate-limit storm. Without the header it is exponential with full
// jitter — not fixed backoff, which synchronises every client that failed
// at the same moment into retrying at the same moment.

import { log, type LogFields } from "./log";

const ENDPOINT = "https://api.openai.com/v1/responses";

export interface VisionImage {
  /** image/jpeg, image/png or image/webp. */
  mediaType: string;
  /** Base64 payload without the data-URL prefix. */
  base64: string;
}

export interface CallOptions {
  model: string;
  system: string;
  instruction: string;
  images: VisionImage[];
  /**
   * Strict structured output. OMITTED for prose.
   *
   * Optional because two callers want JSON with a schema and one — the paid
   * deep-dive report — wants Markdown. Forcing a schema on the report would
   * mean wrapping a whole document in a JSON string field, which buys nothing
   * and costs an escaping layer that can truncate mid-document.
   */
  responseFormat?: Record<string, unknown>;
  /** Per-attempt timeout in ms. */
  timeoutMs: number;
  maxAttempts: number;
  maxOutputTokens: number;
  requestId: string;
  logFields?: LogFields;
}

export interface CallResult {
  /** The raw JSON text of the structured output. */
  text: string;
  inputTokens: number;
  outputTokens: number;
  attempts: number;
}

export class VisionError extends Error {
  constructor(
    /** Stable classification the route maps to an HTTP status. */
    readonly kind:
      | "not_configured"
      | "timeout"
      | "rate_limited"
      | "upstream"
      | "refused"
      | "malformed"
      | "network",
    message: string,
    readonly status?: number,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "VisionError";
  }
}

const RETRYABLE_STATUS = new Set([408, 409, 429, 500, 502, 503, 504, 529]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** `retry-after` in seconds or as an HTTP date; null when absent or unusable. */
function retryAfterMs(headers: Headers): number | null {
  const raw = headers.get("retry-after");
  if (raw) {
    const seconds = Number(raw);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const date = Date.parse(raw);
    if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  }
  // OpenAI also publishes the reset window on its own headers.
  for (const key of ["x-ratelimit-reset-requests", "x-ratelimit-reset-tokens"]) {
    const v = headers.get(key);
    if (!v) continue;
    const m = /^([\d.]+)(ms|s|m)$/.exec(v.trim());
    if (!m) continue;
    const n = Number(m[1]);
    if (!Number.isFinite(n)) continue;
    return m[2] === "ms" ? n : m[2] === "s" ? n * 1000 : n * 60_000;
  }
  return null;
}

/** Exponential backoff with FULL jitter, capped. */
function backoffMs(attempt: number): number {
  const ceiling = Math.min(16_000, 700 * 2 ** (attempt - 1));
  return Math.round(Math.random() * ceiling);
}

/**
 * Pull the structured-output text out of a Responses API payload.
 *
 * `output_text` is the convenience field, but it is absent whenever the
 * response was truncated or carries a refusal, so the output array is
 * walked as well rather than trusting one accessor.
 */
function extractText(body: any): { text: string | null; refusal: string | null } {
  if (typeof body?.output_text === "string" && body.output_text.length > 0) {
    return { text: body.output_text, refusal: null };
  }
  const parts: string[] = [];
  for (const item of body?.output ?? []) {
    for (const c of item?.content ?? []) {
      if (c?.type === "refusal" && typeof c.refusal === "string") {
        return { text: null, refusal: c.refusal };
      }
      if (typeof c?.text === "string") parts.push(c.text);
    }
  }
  return { text: parts.length > 0 ? parts.join("") : null, refusal: null };
}

/**
 * One structured-output call, with retries.
 *
 * temperature 0 and top_p 1 are not a style choice: they are half of what
 * makes "the same face gets the same score" true. The other half is the
 * anchor table in the prompt.
 */
export async function callVisionModel(opts: CallOptions): Promise<CallResult> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new VisionError(
      "not_configured",
      "OPENAI_API_KEY is not set — the vision analysis cannot run.",
    );
  }

  const body = {
    model: opts.model,
    temperature: 0,
    top_p: 1,
    max_output_tokens: opts.maxOutputTokens,
    // Nothing about a face scan benefits from carrying state on OpenAI's
    // side, and storing the request would leave the photographs on their
    // servers past the call. Both are switched off deliberately.
    store: false,
    instructions: opts.system,
    input: [
      {
        role: "user",
        content: [
          ...opts.images.map((img) => ({
            type: "input_image",
            image_url: `data:${img.mediaType};base64,${img.base64}`,
            detail: "high",
          })),
          { type: "input_text", text: opts.instruction },
        ],
      },
    ],
    ...(opts.responseFormat ? { text: { format: opts.responseFormat } } : {}),
  };

  const base: LogFields = {
    requestId: opts.requestId,
    model: opts.model,
    ...opts.logFields,
  };

  let lastError: VisionError | null = null;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs);

    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const ms = Date.now() - started;

      if (!res.ok) {
        const wait = retryAfterMs(res.headers);
        // The error body is read but never logged: it can echo the request,
        // and the request contains a photograph.
        await res.text().catch(() => "");

        const kind =
          res.status === 429
            ? "rate_limited"
            : res.status === 401 || res.status === 403
              ? "not_configured"
              : "upstream";
        lastError = new VisionError(
          kind,
          `OpenAI returned ${res.status}.`,
          res.status,
          wait ?? undefined,
        );

        if (!RETRYABLE_STATUS.has(res.status) || attempt === opts.maxAttempts) {
          log.error("upstream_failed", { ...base, attempt, ms, status: res.status, errorKind: kind });
          throw lastError;
        }
        const delay = wait ?? backoffMs(attempt);
        log.warn("upstream_retry", { ...base, attempt, ms, status: res.status, errorKind: kind, retryInMs: delay });
        await sleep(delay);
        continue;
      }

      const json = await res.json();
      const { text, refusal } = extractText(json);

      if (refusal) {
        log.warn("model_refused", { ...base, attempt, ms, errorKind: "refused" });
        throw new VisionError("refused", refusal);
      }

      // An incomplete response is a truncated JSON document — unparseable,
      // and retrying the identical request would truncate again. Surfaced
      // as its own class so max_output_tokens can be raised rather than
      // the failure being read as a flaky upstream.
      if (json?.status === "incomplete") {
        const reason = json?.incomplete_details?.reason ?? "unknown";
        log.error("response_incomplete", { ...base, attempt, ms, errorKind: `incomplete:${reason}` });
        throw new VisionError(
          "malformed",
          `The model stopped early (${reason}); the JSON document is truncated.`,
        );
      }

      if (!text) {
        lastError = new VisionError("malformed", "The response carried no output text.");
        if (attempt === opts.maxAttempts) {
          log.error("empty_output", { ...base, attempt, ms, errorKind: "malformed" });
          throw lastError;
        }
        log.warn("empty_output_retry", { ...base, attempt, ms, errorKind: "malformed" });
        await sleep(backoffMs(attempt));
        continue;
      }

      const inputTokens = json?.usage?.input_tokens ?? 0;
      const outputTokens = json?.usage?.output_tokens ?? 0;
      log.info("upstream_ok", { ...base, attempt, ms, inputTokens, outputTokens });

      return { text, inputTokens, outputTokens, attempts: attempt };
    } catch (err) {
      const ms = Date.now() - started;

      // A VisionError thrown above is already classified and already
      // logged; rethrow rather than reclassifying it as a network fault.
      if (err instanceof VisionError) throw err;

      const aborted = err instanceof Error && err.name === "AbortError";
      lastError = aborted
        ? new VisionError("timeout", `The analysis did not finish within ${opts.timeoutMs} ms.`)
        : new VisionError("network", "The request to OpenAI could not be completed.");

      if (attempt === opts.maxAttempts) {
        log.error("attempt_failed", { ...base, attempt, ms, errorKind: lastError.kind });
        throw lastError;
      }
      const delay = backoffMs(attempt);
      log.warn("attempt_retry", { ...base, attempt, ms, errorKind: lastError.kind, retryInMs: delay });
      await sleep(delay);
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError ?? new VisionError("upstream", "The analysis failed for an unknown reason.");
}
