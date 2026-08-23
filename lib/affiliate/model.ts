// The affiliate programme's vocabulary and its arithmetic.
//
// EVERYTHING HERE IS PURE. No store, no network, no clock of its own — the
// current time is always passed in as `now`. That is deliberate: these are the
// functions that decide what a partner is owed, and a rule you cannot run in a
// test script is a rule nobody ever checks. `scripts/test-affiliate.mts` runs
// every one of them.
//
// TWO DECISIONS WORTH KNOWING BEFORE YOU CHANGE ANYTHING HERE
//
// 1. A commission freezes the percentage and the level it was booked at.
//    The admin can move the levels around at any time; if the numbers were
//    recomputed on read, yesterday's payout would change overnight and the
//    partner would be right to call it fraud. Config changes apply to the
//    NEXT purchase, never to a booked one.
//
// 2. Maturity is derived, not stored. A commission sits at "pending" until
//    `maturesAt` has passed, and `effectiveStatus` is the only thing that
//    knows it. No cron job, no scheduled sweep, nothing that can silently
//    stop running and leave a partner unpaid.

import type { PlanId } from "@/lib/pricing";

export type CommissionStatus = "pending" | "available" | "requested" | "paid" | "reversed";
export type AffiliateStatus = "pending" | "active" | "blocked";

/** The five rungs. Fixed count: the admin edits them, it cannot add a sixth. */
export type LevelNumber = 1 | 2 | 3 | 4 | 5;

export interface LevelRule {
  level: LevelNumber;
  label: string;
  /** Paying referred customers required to reach this rung. */
  minReferrals: number;
  /** Commission in percent. 0–50, at most one decimal. */
  percent: number;
}

export interface AffiliateConfig {
  enabled: boolean;
  joinMode: "open" | "code";
  requireApproval: boolean;
  levels: LevelRule[];
  /** "first" pays on the referred customer's first purchase only. */
  commissionScope: "first" | "lifetime";
  /** Percentage base: the charged amount, or the amount minus VAT. */
  commissionBase: "gross" | "net";
  vatPercent: number;
  cookieDays: number;
  /** Days a commission has to sit before it can be paid out. */
  holdDays: number;
  payoutMinCents: number;
  currency: "eur";
  selfReferralBlocked: boolean;
  terms: string;
  updatedAt: number;
}

export interface AffiliateAddress {
  street: string;
  postalCode: string;
  city: string;
  /** ISO-3166 alpha-2, upper case. */
  country: string;
}

export interface Affiliate {
  /** The account address. There is exactly one partner per account. */
  email: string;
  code: string;
  status: AffiliateStatus;
  firstName: string;
  lastName: string;
  address: AffiliateAddress;
  /** AES-256-GCM, see lib/affiliate/crypto.ts. Never leaves the server. */
  ibanEnc: string;
  /** The only part of the IBAN a client is ever allowed to see. */
  ibanLast4: string;
  ibanCountry: string;
  accountHolder: string;
  createdAt: number;
  approvedAt: number | null;
  invitedWithCode: string | null;
  /** Admin overrides. null means "the global rule applies". */
  percentOverride: number | null;
  levelOverride: LevelNumber | null;
  payoutMinOverrideCents: number | null;
  note: string;
  /** Who changed their payout details when. Bounded to the last 10 entries. */
  history: Array<{ at: number; field: "iban" | "address"; ibanLast4?: string }>;
}

export interface InviteCode {
  code: string;
  createdAt: number;
  expiresAt: number | null;
  maxUses: number;
  uses: number;
  usedBy: string[];
  note: string;
  disabled: boolean;
}

export interface Binding {
  customerEmail: string;
  affiliateEmail: string;
  code: string;
  boundAt: number;
  source: "link" | "manual";
  /** Set by the first booked commission. Drives "first purchase only" and the
   *  unique-paying-customer count that levels are built on. */
  firstPurchaseAt: number | null;
}

export interface Commission {
  /** The Stripe PaymentIntent id — which is what makes replays no-ops. */
  id: string;
  affiliateEmail: string;
  customerEmail: string;
  plan: PlanId;
  grossCents: number;
  baseCents: number;
  /** Frozen at booking time. See the note at the top of this file. */
  percent: number;
  level: LevelNumber;
  amountCents: number;
  createdAt: number;
  maturesAt: number;
  status: CommissionStatus;
  payoutId: string | null;
  reversedReason: string | null;
}

export interface AffiliateSummary {
  clicks: number;
  signups: number;
  /** Unique referred customers who have paid at least once. The level basis. */
  payingCustomers: number;
  revenueCents: number;
  earnedCents: number;
  paidCents: number;
  updatedAt: number;
}

export interface Payout {
  id: string;
  affiliateEmail: string;
  amountCents: number;
  commissionIds: string[];
  status: "requested" | "approved" | "paid" | "rejected";
  requestedAt: number;
  decidedAt: number | null;
  paidAt: number | null;
  reference: string;
  rejectionReason: string | null;
  /**
   * The payout details as they were when the money was claimed. A partner who
   * moves house after requesting must not retroactively change the record of
   * where a completed transfer went.
   */
  snapshot: { accountHolder: string; ibanLast4: string; address: AffiliateAddress };
}

export const EMPTY_SUMMARY: AffiliateSummary = {
  clicks: 0,
  signups: 0,
  payingCustomers: 0,
  revenueCents: 0,
  earnedCents: 0,
  paidCents: 0,
  updatedAt: 0,
};

/** Levels in rung order, defensively — a stored config could be in any order. */
export function sortedLevels(cfg: AffiliateConfig): LevelRule[] {
  return [...cfg.levels].sort((a, b) => a.level - b.level);
}

/**
 * The rung a partner stands on.
 *
 * `override` wins over everything: it is the admin's manual seat, used for a
 * deal that was agreed outside the ladder. Otherwise it is the highest rung
 * whose threshold the partner has actually passed.
 */
export function levelFor(
  payingCustomers: number,
  cfg: AffiliateConfig,
  override?: LevelNumber | null,
): LevelRule {
  const levels = sortedLevels(cfg);
  // A config without levels cannot happen through validateConfig, but a
  // hand-edited store row could produce one, and paying 0 % silently is a
  // worse outcome than falling back to the first rung.
  if (levels.length === 0) {
    return { level: 1, label: "Starter", minReferrals: 0, percent: 0 };
  }
  if (override) {
    return levels.find((l) => l.level === override) ?? levels[0];
  }
  const count = Number.isFinite(payingCustomers) ? Math.max(0, payingCustomers) : 0;
  let current = levels[0];
  for (const rule of levels) {
    if (count >= rule.minReferrals) current = rule;
  }
  return current;
}

/** The rung above `current`, or null at the top. */
export function nextLevel(current: LevelRule, cfg: AffiliateConfig): LevelRule | null {
  return sortedLevels(cfg).find((l) => l.level > current.level) ?? null;
}

/**
 * What this partner earns per sale right now.
 *
 * A percent override keeps the partner's level for display — they still climb
 * the ladder and still see the next rung; they are simply paid their own rate.
 */
export function percentFor(
  aff: Pick<Affiliate, "percentOverride" | "levelOverride">,
  cfg: AffiliateConfig,
  payingCustomers: number,
): number {
  if (typeof aff.percentOverride === "number" && Number.isFinite(aff.percentOverride)) {
    return clampPercent(aff.percentOverride);
  }
  return levelFor(payingCustomers, cfg, aff.levelOverride).percent;
}

/** Percentages are money. Anything outside 0–50 is a mistake, not a deal. */
export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(50, Math.max(0, Math.round(value * 10) / 10));
}

/**
 * The status a commission really has at `now`.
 *
 * Only "pending" ripens. "requested", "paid" and "reversed" are decisions that
 * were made about this line, and time does not undo a decision.
 */
export function effectiveStatus(c: Commission, now: number): CommissionStatus {
  if (c.status === "pending" && now >= c.maturesAt) return "available";
  return c.status;
}

/**
 * What can be paid out right now.
 *
 * Reversal lines carry a negative amount and are counted here, which is how a
 * refund that arrived after a payout claws itself back out of the next one.
 * The result is floored at zero: a partner can end up owing nothing, never
 * owing us money.
 */
export function payableCents(list: Commission[], now: number): number {
  const sum = list.reduce(
    (acc, c) => (effectiveStatus(c, now) === "available" ? acc + c.amountCents : acc),
    0,
  );
  return Math.max(0, sum);
}

/** What is still ripening — the number the dashboard shows as "in Reifung". */
export function pendingCents(list: Commission[], now: number): number {
  const sum = list.reduce(
    (acc, c) => (effectiveStatus(c, now) === "pending" ? acc + c.amountCents : acc),
    0,
  );
  return Math.max(0, sum);
}

/** Already claimed and waiting for the transfer. */
export function requestedCents(list: Commission[], now: number): number {
  const sum = list.reduce(
    (acc, c) => (effectiveStatus(c, now) === "requested" ? acc + c.amountCents : acc),
    0,
  );
  return Math.max(0, sum);
}

/** Rounded, not floored: floor would quietly shave a cent off every sale. */
export function commissionAmount(baseCents: number, percent: number): number {
  if (!Number.isFinite(baseCents) || !Number.isFinite(percent)) return 0;
  return Math.round((baseCents * percent) / 100);
}

/**
 * The amount the percentage applies to.
 *
 * Prices in this shop are gross (EU B2C law), and the PaymentIntent already
 * carries `vatMinor` from lib/stripe/server.ts. Preferring that over our own
 * division matters: it is the rate that was actually charged, while
 * `cfg.vatPercent` is only what the admin typed into a form.
 */
export function baseCentsFor(
  grossCents: number,
  vatCents: number | null,
  cfg: AffiliateConfig,
): number {
  if (cfg.commissionBase === "gross") return grossCents;
  if (vatCents !== null && Number.isFinite(vatCents) && vatCents >= 0 && vatCents < grossCents) {
    return grossCents - vatCents;
  }
  const rate = Number.isFinite(cfg.vatPercent) ? Math.max(0, cfg.vatPercent) : 0;
  return Math.round(grossCents / (1 + rate / 100));
}

/**
 * "max@gmail.com" → "m***@gmail.com".
 *
 * The partner dashboard never shows a customer's address. A partner has no
 * business holding our customer list, and the domain alone is enough for them
 * to recognise the person they referred.
 */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  const local = email.slice(0, at);
  const domain = email.slice(at);
  if (local.length === 1) return `*${domain}`;
  return `${local[0]}***${domain}`;
}

/** The shareable link. One shape, built in one place. */
export function affiliateLink(origin: string, code: string): string {
  return `${origin.replace(/\/+$/, "")}/r/${code}`;
}
