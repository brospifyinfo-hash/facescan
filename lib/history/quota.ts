// How many scans a customer's purchase includes.
//
// lib/pricing.ts has promised for two tiers now that SCAN_QUOTA is "enforced
// server-side against the scan history — a client-side count is a
// suggestion". Until this file existed that comment was aspirational: the
// number was declared and read by nobody.
//
// WHAT A SCAN COSTS, AND WHY THAT SHAPES THE FALLBACK
// ----------------------------------------------------
// A scan costs nothing. The analysis runs on the customer's device and the
// only thing a saved scan consumes is a row in a spreadsheet. So this quota
// is a PRODUCT limit, not a spending limit — the opposite of the image quota
// in lib/style/quota.ts, which exists because every render is money.
//
// That difference decides the fallback. When the entitlement store is
// memory-backed — Stripe unconfigured, which is production today — nobody
// has a readable plan. Applying the raw tier's quota of one would then lock
// every customer out of their own history after a single scan, for a limit
// they never hit and cannot see. Applying the top tier's ten still bounds
// the rows, costs nothing, and errs toward the customer.
//
// Erring toward the customer is only defensible BECAUSE the thing being
// rationed is free. The image quota does not get the same treatment.

import { SCAN_QUOTA, type PlanId } from "../pricing";
import { entitlements, entitlementBacking } from "../stripe/entitlements";

export interface ScanQuota {
  used: number;
  limit: number;
  remaining: number;
  /** The plan the limit came from, or null when it could not be read. */
  plan: PlanId | null;
}

/** The most generous tier — the fallback ceiling. See the header. */
export const MAX_QUOTA = Math.max(...Object.values(SCAN_QUOTA));

/**
 * The decision, with no store and no network in it.
 *
 * Separated out so the table below can be tested exhaustively. Folded into
 * the async function it would need a live Upstash to exercise even one
 * branch, which in practice means it would be tested by deploying it.
 *
 *   plan known            → that plan's quota, whatever it is
 *   no plan, store real   → the raw quota; the store says they bought
 *                           nothing, and that answer is trustworthy
 *   no plan, store memory → the top quota; the store cannot answer, and
 *                           rationing something free on a non-answer would
 *                           lock out paying customers. See the header.
 */
export function limitFor(plan: PlanId | null, entitlementsReadable: boolean): number {
  if (plan) return SCAN_QUOTA[plan];
  return entitlementsReadable ? SCAN_QUOTA.raw : MAX_QUOTA;
}

export async function scanQuota(email: string, used: number): Promise<ScanQuota> {
  const readable = entitlementBacking() !== "memory";

  let plan: PlanId | null = null;
  if (readable) {
    const ent = await entitlements.get(email);
    plan = ent?.plan ?? null;
  }

  const limit = limitFor(plan, readable);
  return { used, limit, remaining: Math.max(0, limit - used), plan };
}
