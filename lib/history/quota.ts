// How many scans a customer's purchase includes.
//
// lib/pricing.ts has promised for two tiers now that SCAN_QUOTA is "enforced
// server-side against the scan history — a client-side count is a
// suggestion". Until this file existed that comment was aspirational: the
// number was declared and read by nobody.
//
// WHAT A SCAN COSTS, AND WHY THAT SHAPES THE LIMITS
// -------------------------------------------------
// A scan costs nothing. The analysis runs on the customer's device and the
// only thing a saved scan consumes is a row in a spreadsheet. So this quota
// is a PRODUCT limit, not a spending limit — the opposite of the image quota
// in lib/style/quota.ts, which exists because every render is money.
//
// That difference decides two things:
//
//   1. AN ADDRESS WITHOUT A PURCHASE GETS THE TOP ALLOWANCE, not the raw
//      tier's one. Applying a paid tier's quota to somebody who bought
//      nothing once locked every signed-in customer out of their own history
//      after a single scan — for a limit they never bought and could not
//      see. SCAN_QUOTA is "how many further scans the PURCHASE includes"
//      (lib/pricing.ts); applied to a non-purchase it is a category error.
//
//   2. A PURCHASE COUNTS FROM ITS OWN GRANT, not from the account's first
//      day. The funnel requires signing in BEFORE checkout, and signing in
//      saves the current scan — so counting a plan's quota against the
//      lifetime history meant the mandatory pre-purchase save had already
//      spent it. "Further scans" starts at grantedAt.
//
// Erring toward the customer is only defensible BECAUSE the thing being
// rationed is free. The image quota does not get the same treatment.

import { SCAN_QUOTA, type PlanId } from "../pricing";
import { entitlements, entitlementsEnforceable } from "../stripe/entitlements";

export interface ScanQuota {
  used: number;
  limit: number;
  remaining: number;
  /** The plan the limit came from, or null when it could not be read. */
  plan: PlanId | null;
}

/** The most generous tier — the no-purchase ceiling. See the header. */
export const MAX_QUOTA = Math.max(...Object.values(SCAN_QUOTA));

/**
 * The decision table, with no store and no network in it.
 *
 * Separated out so the table below can be tested exhaustively. Folded into
 * the async function it would need a live backend to exercise even one
 * branch, which in practice means it would be tested by deploying it.
 *
 *   plan known → that plan's quota, whatever it is
 *   no plan    → the top quota; scans are free and SCAN_QUOTA prices a
 *                purchase, so there is nothing here for it to price
 */
export function limitFor(plan: PlanId | null): number {
  return plan ? SCAN_QUOTA[plan] : MAX_QUOTA;
}

/**
 * How many of the stored scans count against the limit. Pure, see limitFor.
 *
 * A purchase includes FURTHER scans, so its count starts at grantedAt; the
 * scans saved before the purchase were free ones and stay free. Without a
 * plan there is no grant instant, so everything counts against the (top)
 * free allowance.
 */
export function usedFor(
  plan: PlanId | null,
  entries: readonly { at: number }[],
  grantedAt: number,
): number {
  if (!plan) return entries.length;
  return entries.filter((e) => e.at >= grantedAt).length;
}

export async function scanQuota(
  email: string,
  entries: readonly { at: number }[],
): Promise<ScanQuota> {
  let plan: PlanId | null = null;
  let grantedAt = 0;
  if (entitlementsEnforceable()) {
    const ent = await entitlements.get(email);
    if (ent) {
      plan = ent.plan;
      // A record without a usable grant instant (a hand-written sheet row,
      // say) falls back to 0 — everything counts, the limit still holds.
      // `e.at >= undefined` is false for every entry, which would make the
      // quota infinite instead.
      grantedAt = Number.isFinite(ent.grantedAt) ? ent.grantedAt : 0;
    }
  }

  const limit = limitFor(plan);
  const used = usedFor(plan, entries, grantedAt);
  return { used, limit, remaining: Math.max(0, limit - used), plan };
}
