// How many pictures one address may generate.
//
// WHY THIS EXISTS RATHER THAN AN ENTITLEMENT CHECK ALONE
// ------------------------------------------------------
// Every render costs real money at OpenAI. The obvious gate is "blueprint
// customers only", and that gate is checked — but it cannot be the only one,
// for the reason written across this codebase already: Stripe is not
// configured in production, so no entitlement can exist, so an
// entitlement-only gate is either shut for everybody or open to everybody
// depending on which way you fail it. That is the same trap that silently
// killed every history write.
//
// A quota does not care. It bounds the spend per address whatever the
// entitlement store says, so the answer to "what is the worst a signed-in
// stranger can cost us" is a number rather than a shrug. The entitlement
// check stays on top of it as the real product gate; this is the floor under
// the bill.
//
// THE COUNTER ONLY EVER GOES UP. A refund path would be nice and is not
// worth the race: two tabs rendering at once must not both see "5 used" and
// both proceed. INCR first, act second, and a failed render costs the
// customer one of their allowance — which is why the route only charges
// after the picture actually arrives.

import { kv, kvConfigured } from "../kv";
import { skBump, skGetJson, skSetJson, sheetsKvConfigured, sheetsKvHealthy } from "../sheets-kv";

/**
 * Three pictures is one full set (two haircuts and the projection). Nine
 * lets a customer redo the set twice — enough to try another photograph
 * without turning the studio into an unmetered image generator.
 */
export const IMAGE_QUOTA = Number(process.env.STYLE_IMAGE_QUOTA ?? 9);

const KEY = (email: string) => `style:used:${email.toLowerCase()}`;

/** Survives one warm instance only — the last resort, as everywhere else. */
const memory = new Map<string, number>();

/**
 * Same chain as the OTP and entitlement stores: Redis, then the spreadsheet,
 * then memory. This counter is the floor under the bill, and a floor that
 * resets on every cold start is not one — an instance-local Map made the
 * nine-image limit advisory in production, where Upstash was never
 * configured. The sheet holds `{used: n}` per address and kv-bump increments
 * it under the script lock, so two tabs cannot both read five and write six.
 */
const sheetsUsable = () => sheetsKvConfigured() && sheetsKvHealthy();

export async function imagesUsed(email: string): Promise<number> {
  const key = KEY(email);
  if (kvConfigured()) {
    const raw = await kv("GET", key);
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }
  if (sheetsUsable()) {
    try {
      const rec = await skGetJson<{ used?: number }>(key);
      const n = rec?.used;
      // The HIGHER of sheet and memory: a charge whose bump failed lives
      // only in the memory mirror, and letting a lower sheet value shadow
      // it would un-count a picture that was already paid for at OpenAI.
      const sheet = typeof n === "number" && Number.isFinite(n) ? n : 0;
      return Math.max(sheet, memory.get(key) ?? 0);
    } catch {
      // Fall through to the floor below.
    }
  }
  return memory.get(key) ?? 0;
}

/** Charge one picture. Returns the new total. */
export async function chargeImage(email: string): Promise<number> {
  const key = KEY(email);
  if (kvConfigured()) {
    const raw = await kv("INCR", key);
    const n = Number(raw);
    return Number.isFinite(n) ? n : 1;
  }
  if (sheetsUsable()) {
    try {
      const bumped = await skBump(key, "used", 1);
      if (typeof bumped === "number") {
        memory.set(key, bumped);
        return bumped;
      }
      // No record yet: the first charge creates it. Two first charges racing
      // can both land here and one increment is lost — the same bounded race
      // the route already accepts, and it only ever undercounts by one.
      await skSetJson(key, { used: 1 });
      memory.set(key, 1);
      return 1;
    } catch {
      // Fall through to the floor below.
    }
  }
  const next = (memory.get(key) ?? 0) + 1;
  memory.set(key, next);
  return next;
}

export interface QuotaState {
  used: number;
  limit: number;
  remaining: number;
}

export async function quotaFor(email: string): Promise<QuotaState> {
  const used = await imagesUsed(email);
  return { used, limit: IMAGE_QUOTA, remaining: Math.max(0, IMAGE_QUOTA - used) };
}
