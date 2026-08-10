// Minimal Redis client over the Upstash REST API.
//
// WHY NOT @upstash/redis
// ----------------------
// The same reasoning as lib/vision/openai.ts: what this app needs is eight
// Redis commands behind two store interfaces. A dependency buys typings
// for a surface we do not use, and has to be kept in step with the
// runtime. The REST API is one POST with a JSON array as the body.
//
// WHY REST AND NOT A TCP CLIENT
// -----------------------------
// Serverless functions do not get to keep a connection pool. Every
// invocation would open a TCP connection, use it once and drop it, which
// is slower than an HTTP request to an endpoint that is already warm — and
// on some runtimes a raw socket is not available at all.
//
// CONFIGURED OR ABSENT, NEVER HALF-WORKING
// ----------------------------------------
// `kvConfigured()` is the only switch. When the environment has no Upstash
// credentials the callers keep their in-memory stores, which is correct for
// local development. What must never happen is a store that looks
// configured and silently drops writes: a login code that vanishes is
// indistinguishable from a wrong code, and a lost entitlement is
// indistinguishable from a customer who never paid. So every failure here
// throws rather than returning a falsy value.

/**
 * Vercel's Upstash integration injects KV_REST_API_*; a store provisioned
 * directly at Upstash injects UPSTASH_REDIS_REST_*. Accept both so it does
 * not matter which route was taken.
 */
function credentials(): { url: string; token: string } | null {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ""), token };
}

export const kvConfigured = (): boolean => credentials() !== null;

export class KvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KvError";
  }
}

type Command = (string | number)[];

async function post(body: unknown): Promise<unknown> {
  const creds = credentials();
  if (!creds) throw new KvError("No Upstash credentials in the environment.");

  // A login code is worthless after ten minutes, so a request that hangs
  // is a failed request. Better to surface it than to hold the user's
  // browser open on a spinner.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(creds.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new KvError(`Upstash returned ${res.status}.`);
    return await res.json();
  } catch (err) {
    if (err instanceof KvError) throw err;
    const aborted = err instanceof Error && err.name === "AbortError";
    throw new KvError(aborted ? "Upstash timed out." : "Upstash was unreachable.");
  } finally {
    clearTimeout(timer);
  }
}

/** One command. Returns the raw result, or null for a Redis nil. */
export async function kv(...command: Command): Promise<unknown> {
  const body = (await post(command)) as { result?: unknown; error?: string };
  if (body?.error) throw new KvError(body.error);
  return body?.result ?? null;
}

/**
 * Several commands in one round trip.
 *
 * Not a transaction — Upstash's pipeline is batching, not MULTI. Every
 * place it is used here either writes independent keys or follows a write
 * with its own EXPIRE, where a partial application is survivable: the
 * worst case is a key without a TTL, which the next write replaces.
 */
export async function kvPipeline(...commands: Command[]): Promise<unknown[]> {
  const body = (await post(commands)) as Array<{ result?: unknown; error?: string }>;
  if (!Array.isArray(body)) throw new KvError("Unexpected pipeline response.");
  return body.map((entry) => {
    if (entry?.error) throw new KvError(entry.error);
    return entry?.result ?? null;
  });
}

/** HGETALL returns a flat [field, value, field, value] array over REST. */
export function toHash(result: unknown): Record<string, string> | null {
  if (!Array.isArray(result) || result.length === 0) return null;
  const out: Record<string, string> = {};
  for (let i = 0; i + 1 < result.length; i += 2) {
    out[String(result[i])] = String(result[i + 1]);
  }
  return out;
}
