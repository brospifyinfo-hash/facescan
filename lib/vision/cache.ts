// SHA-256 keyed result cache.
//
// WHAT IT IS FOR
// --------------
// A vision call is the most expensive thing this product does — roughly a
// second of latency and a real per-request cost. The funnel makes the same
// call more often than it looks: a reload of /results, a back-navigation to
// /scan, an owner testing the paid view, and a user re-uploading the photo
// they just cropped all produce byte-identical input.
//
// WHAT THE KEY COVERS, AND WHY EACH PART IS IN IT
//   sha256(front) + sha256(side)  the actual input
//   PROMPT_VERSION                a prompt edit must not serve answers
//                                 produced by the previous wording
//   model id                      two models are two different analyses
//
// WHAT THIS IS NOT: a persistence layer. The map lives in the process, so
// on Vercel it is per-warm-instance and disappears on a cold start. That is
// the correct trade here — a shared cache would mean writing face-analysis
// results to storage the user was told nothing about, to save a few cents.
// The hash is of the image, so a stored entry would also be a stored link
// between a photograph and a rating.

import { createHash } from "node:crypto";
import { log } from "./log";

/** How long an entry stays usable. */
const TTL_MS = 60 * 60 * 1000;
/** Hard bound on entries, so a busy instance cannot grow without limit. */
const MAX_ENTRIES = 200;

interface Entry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, Entry<unknown>>();

export function sha256(base64: string): string {
  return createHash("sha256").update(base64, "utf8").digest("hex");
}

export function cacheKey(parts: {
  frontHash: string;
  sideHash: string | null;
  promptVersion: string;
  model: string;
}): string {
  return createHash("sha256")
    .update(
      [parts.frontHash, parts.sideHash ?? "-", parts.promptVersion, parts.model].join("|"),
    )
    .digest("hex");
}

export function cacheGet<T>(key: string): T | null {
  const hit = store.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    store.delete(key);
    return null;
  }
  // Re-insert so the eviction order is least-recently-USED rather than
  // least-recently-written; a photo being re-analysed repeatedly is exactly
  // the entry worth keeping.
  store.delete(key);
  store.set(key, hit);
  return hit.value as T;
}

export function cacheSet<T>(key: string, value: T): void {
  if (store.size >= MAX_ENTRIES) {
    // Map preserves insertion order, so the first key is the coldest.
    const oldest = store.keys().next();
    if (!oldest.done) store.delete(oldest.value);
  }
  store.set(key, { value, expiresAt: Date.now() + TTL_MS });
  log.debug("cache_store", { size: store.size });
}

/** Test hook. Not called by the route. */
export function cacheClear(): void {
  store.clear();
}
