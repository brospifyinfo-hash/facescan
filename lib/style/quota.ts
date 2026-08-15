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

/**
 * Three pictures is one full set (two haircuts and the projection). Nine
 * lets a customer redo the set twice — enough to try another photograph
 * without turning the studio into an unmetered image generator.
 */
export const IMAGE_QUOTA = Number(process.env.STYLE_IMAGE_QUOTA ?? 9);

const KEY = (email: string) => `style:used:${email.toLowerCase()}`;

/** Survives one warm instance only — the same honest fallback as the rest. */
const memory = new Map<string, number>();

export async function imagesUsed(email: string): Promise<number> {
  if (!kvConfigured()) return memory.get(KEY(email)) ?? 0;
  const raw = await kv("GET", KEY(email));
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

/** Charge one picture. Returns the new total. */
export async function chargeImage(email: string): Promise<number> {
  const key = KEY(email);
  if (!kvConfigured()) {
    const next = (memory.get(key) ?? 0) + 1;
    memory.set(key, next);
    return next;
  }
  const raw = await kv("INCR", key);
  const n = Number(raw);
  return Number.isFinite(n) ? n : 1;
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
