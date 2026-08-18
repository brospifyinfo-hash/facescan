// A key-value store on top of the Apps Script backend.
//
// WHY THIS EXISTS
// ---------------
// Login codes and entitlements need a store that survives a cold start and is
// shared between serverless instances. Until now the only such store was
// Upstash, and Upstash was never configured — so both fell back to a
// process-local Map, and the consequences were not subtle:
//
//   * a login code written by one instance was looked up by another and was
//     simply not there, so sign-in failed for a share of users at random
//   * an entitlement granted by the Stripe webhook lived until the next cold
//     start, after which the customer had paid and the app had no record
//
// The spreadsheet is already deployed, already authenticated and already
// holds the products and the scans. Putting these two on it as well costs a
// few hundred milliseconds per call and removes a dependency that was never
// going to get provisioned.
//
// REDIS IS STILL PREFERRED. Every consumer picks Upstash first and only falls
// through to here — so connecting Upstash later is a matter of setting two
// env vars, with no code change and no migration. What changed is the
// bottom of the chain: the last resort used to be a Map that loses data, and
// is now a store that does not.
//
// WHAT THIS IS NOT: it is not fast, it has no transactions beyond the single
// script lock, and it is not a general Redis replacement. It is get, set with
// an expiry, delete, and one atomic increment — the four operations the two
// stores above actually need.

const TIMEOUT_MS = 10_000;

export const sheetsKvConfigured = (): boolean =>
  Boolean(process.env.SHEETS_URL && process.env.SHEETS_TOKEN);

/**
 * Has a call to the key-value actions failed?
 *
 * THIS EXISTS BECAUSE THE BACKEND IS DEPLOYED BY HAND. The Apps Script lives
 * in the owner's spreadsheet and is updated by pasting a file and pressing
 * Deploy — so there is a window where this code is live and the script
 * serving it is the previous version, which answers `unknown_action` to
 * every request here.
 *
 * Without this flag that window is a hard outage: the stores would be
 * selected, every call would throw, and signing in would go from unreliable
 * to impossible. With it, a failure means the callers quietly behave the way
 * they did before the spreadsheet existed, and start working the moment the
 * script is updated. Deploy order stops mattering.
 *
 * It latches rather than retrying per request: a spreadsheet that answered
 * "unknown action" once will answer it every time until a human redeploys,
 * and paying a second of timeout on every login to rediscover that helps
 * nobody. The process is short-lived, so a new instance re-probes anyway.
 */
let degraded = false;
export const sheetsKvHealthy = (): boolean => !degraded;

function markDegraded(err: unknown): void {
  if (degraded) return;
  degraded = true;
  console.error(
    "[sheets-kv] the key-value backend is unavailable — falling back to " +
      "process-local storage. Paste the current scripts/sheets-backend.gs " +
      "into the spreadsheet's Apps Script and redeploy the web app. " +
      (err instanceof Error ? err.message : String(err)),
  );
}

function config(): { url: string; token: string } {
  const url = process.env.SHEETS_URL;
  const token = process.env.SHEETS_TOKEN;
  if (!url || !token) throw new Error("SHEETS_URL or SHEETS_TOKEN is missing.");
  return { url, token };
}

async function call<T>(init: RequestInit & { query?: string }): Promise<T> {
  const { url } = config();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${url}${init.query ?? ""}`, {
      ...init,
      // A web app published for "Anyone" answers with a 302 to a
      // googleusercontent URL; without following it every call returns the
      // redirect page rather than the payload.
      redirect: "follow",
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Sheets backend returned ${res.status}.`);
    const data = (await res.json()) as T & { error?: string };
    // `unknown_action` is the specific answer an out-of-date script gives, and
    // it is the one failure that will never fix itself by retrying.
    if (data?.error === "unknown_action") {
      markDegraded(new Error("the deployed Apps Script does not know the kv actions"));
      throw new Error("Sheets backend: unknown_action");
    }
    if (data?.error) throw new Error(`Sheets backend: ${data.error}`);
    return data;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Sheets backend timed out.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function post<T>(body: Record<string, unknown>): Promise<T> {
  const { token } = config();
  return call<T>({
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ ...body, token }),
  });
}

/** The raw string, or null when absent or expired. */
export async function skGet(key: string): Promise<string | null> {
  const { token } = config();
  const res = await call<{ record?: { value: string; expiresAt: number } | null }>({
    method: "GET",
    query: `?action=kv-get&token=${encodeURIComponent(token)}&key=${encodeURIComponent(key)}`,
  });

  // THE RESPONSE MUST CARRY A `record` FIELD, even when it is null.
  //
  // An out-of-date Apps Script does not answer "unknown_action" to a GET the
  // way it does to a POST — its doGet falls through to the DEFAULT branch and
  // returns the product catalogue. That parses fine, has no `error`, and
  // `res.record?.value ?? null` reads it as "no such key".
  //
  // So every read silently missed and the store looked EMPTY rather than
  // broken: logins fell back to memory, entitlements were granted into one
  // instance and gone from the next, and nothing anywhere reported a fault.
  // A backend that cannot answer has to say so.
  if (!("record" in res)) {
    markDegraded(new Error("kv-get answered without a record field — the script is out of date"));
    throw new Error("Sheets backend: kv unsupported");
  }
  return res.record?.value ?? null;
}

/**
 * Is the key-value backend actually there? One round trip, no side effects.
 *
 * Used by the health check, which until now reported "sheets" purely because
 * the env vars existed — and therefore said storage was fine while every
 * write was disappearing into per-instance memory.
 */
export async function probeSheetsKv(): Promise<boolean> {
  if (!sheetsKvConfigured()) return false;
  try {
    await skGet("probe:health");
    return true;
  } catch {
    return false;
  }
}

/** JSON convenience. A corrupt value reads as absent rather than throwing. */
export async function skGetJson<T>(key: string): Promise<T | null> {
  const raw = await skGet(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** `ttlMs` of 0 or undefined means no expiry — used for purchases. */
export async function skSet(key: string, value: string, ttlMs?: number): Promise<void> {
  await post({
    action: "kv-set",
    key,
    value,
    expiresAt: ttlMs && ttlMs > 0 ? Date.now() + ttlMs : 0,
  });
}

export async function skSetJson(key: string, value: unknown, ttlMs?: number): Promise<void> {
  await skSet(key, JSON.stringify(value), ttlMs);
}

export async function skDel(key: string): Promise<void> {
  await post({ action: "kv-del", key });
}

/**
 * Add to one numeric field of a stored JSON object and return the new value.
 * Null when the key is gone.
 *
 * Atomic on the server under the script lock. Read-modify-write from here
 * would race, and the one field this is used for is the login-code attempt
 * counter — where a lost update means the brute-force limit never trips.
 */
export async function skBump(key: string, field: string, by = 1): Promise<number | null> {
  const res = await post<{ value: number | null }>({ action: "kv-bump", key, field, by });
  return typeof res.value === "number" ? res.value : null;
}
