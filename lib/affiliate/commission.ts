// Where a purchase turns into somebody's money.
//
// TWO ENTRY POINTS, BOTH CALLED FROM THE STRIPE PATH
// --------------------------------------------------
// `referralMetadataFor` runs while the PaymentIntent is being created and
// answers one question: who, if anybody, gets a share of this sale, and at
// what rate. `bookCommission` runs in the webhook and writes that answer
// down. Nothing else in the app may create a commission — not an admin
// click, not a client route, not a "confirm" handler. The webhook is the
// only place where a payment is proven rather than claimed.
//
// WHY THE RATE TRAVELS IN THE INTENT'S METADATA
// ---------------------------------------------
// The webhook arrives out of band, minutes later, from Stripe's servers —
// there is no cookie, no session and no request from the customer to read.
// Everything the booking needs is therefore frozen into the intent at
// creation time: the partner code, the level and the percentage. That also
// makes the commission honest by construction: the rate the customer's
// purchase was made under is the rate that gets paid, even if the operator
// edits the level table in the meantime. Editing percentages must never
// rewrite money that has already been earned — only future sales.
//
// NOTHING IN THIS FILE THROWS INTO THE PURCHASE PATH.
// A thrown error in the webhook makes Stripe retry the whole delivery, and
// the retry re-runs the entitlement grant. A broken partner programme must
// never be able to cost somebody the product they paid for, so every export
// swallows its failures and logs them with an "[affiliate]" prefix.

import { normalizeEmail } from "@/lib/auth/store";
import { PLAN_ORDER, type PlanId } from "@/lib/pricing";
import { affiliateStore } from "@/lib/affiliate/store";
import { normalizeCode } from "@/lib/affiliate/codes";
import { sendLevelUp, sendReferralEarned, siteOrigin } from "@/lib/affiliate/email";
import {
  baseCentsFor,
  commissionAmount,
  levelFor,
  percentFor,
  type Affiliate,
  type AffiliateConfig,
  type AffiliateSummary,
  type Commission,
  type LevelRule,
} from "@/lib/affiliate/model";

/**
 * The prefix that marks a reversal row.
 *
 * A refund of a commission that has already been requested or paid out
 * cannot edit the original line — the money left the bank account, and a
 * record that contradicts a bank statement is worse than no record. So the
 * original stays and a second, negative line is written beside it under
 * `affcom:<aff>:rev_<piId>`. Every consumer that sums a partner's numbers
 * just adds it up; the sign does the work.
 */
const REVERSAL_PREFIX = "rev_";

const isReversal = (c: Commission) => c.id.startsWith(REVERSAL_PREFIX);

/** Partner mails have no locale to read yet — Profile and Session carry none. */
const PARTNER_LOCALE = "de" as const;

const dashboardLink = () => `${siteOrigin()}/partner`;

function isPlan(value: unknown): value is PlanId {
  return typeof value === "string" && (PLAN_ORDER as string[]).includes(value);
}

/** A whole, finite, non-negative amount of cents — anything else is not money. */
function centsOrNull(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? Math.round(value) : null;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* 1. Intent creation — freeze the rate                                        */
/* -------------------------------------------------------------------------- */

/**
 * The `metadata` fields that attach a sale to a partner, or `{}`.
 *
 * Returns an empty object for every "no" alike — no binding, programme off,
 * partner not active, first-purchase-only scope already used up, or any
 * failure at all. The caller spreads it into the intent's metadata, so an
 * empty object is exactly "this sale belongs to nobody", which is the safe
 * answer and also the common one.
 *
 * NEVER THROWS: this runs inside checkout. A partner programme that is
 * having a bad day must not be able to stop a customer from paying.
 */
export async function referralMetadataFor(
  customerEmail: string,
): Promise<Record<string, string>> {
  try {
    const customer = normalizeEmail(customerEmail ?? "");
    if (!customer) return {};

    const cfg = await affiliateStore.getConfig();
    if (!cfg.enabled) return {};

    const binding = await affiliateStore.getBinding(customer);
    if (!binding) return {};

    // "first" pays for bringing a customer, not for keeping one: once the
    // first purchase is on file, later purchases carry no attribution at all.
    if (cfg.commissionScope === "first" && binding.firstPurchaseAt !== null) return {};

    const aff = await affiliateStore.getAffiliate(binding.affiliateEmail);
    if (!aff || aff.status !== "active") return {};

    if (cfg.selfReferralBlocked && normalizeEmail(aff.email) === customer) return {};

    const summary = await affiliateStore.getSummary(aff.email);
    const rule = levelFor(summary.payingCustomers, cfg, aff.levelOverride);
    const percent = percentFor(aff, cfg, summary.payingCustomers);

    return {
      ref: aff.code,
      refLevel: String(rule.level),
      refPercent: String(percent),
    };
  } catch (err) {
    console.error("[affiliate] could not attach referral metadata:", err);
    return {};
  }
}

/* -------------------------------------------------------------------------- */
/* 2. Webhook — book it                                                        */
/* -------------------------------------------------------------------------- */

export interface BookableIntent {
  id: string;
  amount: number | null;
  currency: string | null;
  metadata: Record<string, string | undefined>;
}

/**
 * Write the commission line for a succeeded PaymentIntent.
 *
 * Called from the Stripe webhook after the entitlement has been granted, and
 * strictly additive to it: everything below is wrapped so that no failure
 * here can turn a successful grant into a retried delivery.
 */
export async function bookCommission(intent: BookableIntent): Promise<void> {
  try {
    const md = intent.metadata ?? {};

    // All three or nothing. A ref without a rate would have to invent one,
    // and an invented rate is either a gift or a shortfall.
    const rawCode = typeof md.ref === "string" ? normalizeCode(md.ref) : "";
    if (!rawCode || !md.refLevel || !md.refPercent) return;

    const cfg = await affiliateStore.getConfig();
    if (!cfg.enabled) {
      console.warn("[affiliate] programme disabled, no commission for", intent.id);
      return;
    }

    const aff = await affiliateStore.affiliateByCode(rawCode);
    if (!aff) {
      console.warn("[affiliate] unknown partner code on", intent.id);
      return;
    }
    if (aff.status !== "active") {
      console.warn(`[affiliate] partner is ${aff.status}, no commission for`, intent.id);
      return;
    }

    const customer = normalizeEmail(md.email ?? "");
    if (!customer) {
      console.warn("[affiliate] intent without a customer address:", intent.id);
      return;
    }

    if (normalizeEmail(aff.email) === customer) {
      // Buying through your own link is a discount you granted yourself. The
      // switch exists because a few programmes deliberately allow it; the
      // default is that they do not.
      if (cfg.selfReferralBlocked) {
        console.warn("[affiliate] self-referral rejected on", intent.id);
        return;
      }
      console.warn("[affiliate] self-referral allowed by configuration on", intent.id);
    }

    const plan = md.plan;
    if (!isPlan(plan)) {
      // The entitlement path refuses the same intent for the same reason —
      // without a plan there is nothing to grant and nothing to pay for.
      console.warn("[affiliate] intent without a usable plan:", intent.id);
      return;
    }

    const binding = await affiliateStore.getBinding(customer);
    if (cfg.commissionScope === "first" && binding?.firstPurchaseAt) {
      console.info("[affiliate] scope is first purchase only, skipping", intent.id);
      return;
    }

    const grossCents = centsOrNull(intent.amount);
    if (grossCents === null || grossCents <= 0) {
      console.warn("[affiliate] intent without a usable amount:", intent.id);
      return;
    }

    // The payout ledger has exactly one currency (cfg.currency), and a payout
    // is a single SEPA transfer in euro. Booking 1995 US cents as 1995 euro
    // cents would silently pay the partner the wrong amount, so a sale in
    // another currency is logged and left unbooked rather than mispriced.
    const currency = (intent.currency ?? "").toLowerCase();
    if (currency && currency !== cfg.currency) {
      console.warn(
        `[affiliate] ${currency} sale cannot be paid out in ${cfg.currency}, not booking`,
        intent.id,
      );
      return;
    }

    // Stripe was told the VAT share when the intent was created, so the net
    // basis is read back rather than recomputed — the rate that applied to
    // the sale is the rate that was charged, not today's setting.
    const vatCents = centsOrNull(md.vatMinor);
    const baseCents = baseCentsFor(grossCents, vatCents, cfg);

    const before = await affiliateStore.getSummary(aff.email);
    const { percent, level } = frozenRate(md, aff, cfg, before.payingCustomers, intent.id);

    const now = Date.now();
    const amountCents = commissionAmount(baseCents, percent);
    const commission: Commission = {
      id: intent.id,
      affiliateEmail: normalizeEmail(aff.email),
      customerEmail: customer,
      plan,
      grossCents,
      baseCents,
      percent,
      level,
      amountCents,
      createdAt: now,
      // The hold is the operator's refund window. It is measured from the
      // purchase, not from the payout request, so a partner can see exactly
      // when the money becomes theirs.
      maturesAt: now + Math.max(0, Math.round(cfg.holdDays)) * 86_400_000,
      status: "pending",
      payoutId: null,
      reversedReason: null,
    };

    // THE IDEMPOTENCY GATE. Stripe retries until it gets a 2xx and replays
    // deliveries during outages; without this an afternoon of retries would
    // pay a partner five times for one sale. Everything with a side effect —
    // counters, the binding, the mail — lives BELOW this line.
    const fresh = await affiliateStore.putCommissionIfAbsent(commission);
    if (!fresh) {
      console.info("[affiliate] commission already booked, replay ignored:", intent.id);
      return;
    }

    // A customer counts once, on their first paid purchase, no matter how
    // often they buy afterwards — the level ladder is measured in people.
    const firstPurchase = !binding || binding.firstPurchaseAt === null;

    await affiliateStore.bumpSummary(aff.email, {
      revenueCents: grossCents,
      earnedCents: amountCents,
      payingCustomers: firstPurchase ? 1 : 0,
    });

    if (binding) {
      if (firstPurchase) {
        await affiliateStore.putBinding({ ...binding, firstPurchaseAt: now });
      }
    } else {
      // No binding, but the intent carries a signed-at-creation attribution:
      // the admin may have deleted the row, or it may have expired out of a
      // memory store between checkout and webhook. Recording it now keeps a
      // second purchase from being counted as a second customer.
      await affiliateStore.putBinding({
        affiliateEmail: normalizeEmail(aff.email),
        code: aff.code,
        boundAt: now,
        source: "link",
        firstPurchaseAt: now,
        customerEmail: customer,
      });
    }

    const payingAfter = before.payingCustomers + (firstPurchase ? 1 : 0);
    const rule = levelFor(payingAfter, cfg, aff.levelOverride);

    // Mails last, and each on its own: a Resend outage must not roll back a
    // booking that is already on the books.
    await notify(aff, cfg, {
      commission,
      rule,
      totalEarnedCents: before.earnedCents + amountCents,
      previousLevel: levelFor(before.payingCustomers, cfg, aff.levelOverride),
      payingAfter,
    });

    console.info(
      `[affiliate] booked ${amountCents} cents for ${aff.code} on ${intent.id} (${percent}% of ${baseCents})`,
    );
  } catch (err) {
    console.error("[affiliate] booking a commission failed:", err);
  }
}

/**
 * The percentage and level this sale is paid at.
 *
 * Taken from the intent, because that is what applied when the customer
 * bought. Sanity-checked all the same: metadata is a string map that has
 * travelled through a third party, and "NaN%" of a purchase would be a
 * commission of NaN cents written into the books forever. A value that
 * cannot be believed falls back to today's configuration, which is wrong by
 * at most one rate change and never nonsense.
 */
function frozenRate(
  md: Record<string, string | undefined>,
  aff: Affiliate,
  cfg: AffiliateConfig,
  payingCustomers: number,
  intentId: string,
): { percent: number; level: 1 | 2 | 3 | 4 | 5 } {
  const rawPercent = Number(md.refPercent);
  const rawLevel = Number(md.refLevel);

  const percentOk = Number.isFinite(rawPercent) && rawPercent >= 0 && rawPercent <= 50;
  const levelOk = Number.isInteger(rawLevel) && rawLevel >= 1 && rawLevel <= 5;

  if (percentOk && levelOk) {
    return {
      percent: Math.round(rawPercent * 10) / 10,
      level: rawLevel as 1 | 2 | 3 | 4 | 5,
    };
  }

  console.warn("[affiliate] unusable rate in metadata, falling back to config:", intentId);
  const rule = levelFor(payingCustomers, cfg, aff.levelOverride);
  return {
    percent: percentOk ? Math.round(rawPercent * 10) / 10 : percentFor(aff, cfg, payingCustomers),
    level: levelOk ? (rawLevel as 1 | 2 | 3 | 4 | 5) : rule.level,
  };
}

async function notify(
  aff: Affiliate,
  cfg: AffiliateConfig,
  p: {
    commission: Commission;
    rule: LevelRule;
    totalEarnedCents: number;
    previousLevel: LevelRule;
    payingAfter: number;
  },
): Promise<void> {
  const link = dashboardLink();
  try {
    await sendReferralEarned(aff.email, {
      locale: PARTNER_LOCALE,
      amountCents: p.commission.amountCents,
      plan: p.commission.plan,
      grossCents: p.commission.grossCents,
      percent: p.commission.percent,
      level: p.rule.level,
      levelLabel: p.rule.label,
      totalEarnedCents: p.totalEarnedCents,
      maturesAt: p.commission.maturesAt,
      link,
    });
  } catch (err) {
    console.error("[affiliate] earned mail failed:", err);
  }

  if (p.rule.level === p.previousLevel.level) return;
  try {
    await sendLevelUp(aff.email, {
      locale: PARTNER_LOCALE,
      level: p.rule.level,
      label: p.rule.label,
      percent: percentFor(aff, cfg, p.payingAfter),
      link,
    });
  } catch (err) {
    console.error("[affiliate] level-up mail failed:", err);
  }
}

/* -------------------------------------------------------------------------- */
/* 3. Refunds                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Undo the commission for a refunded PaymentIntent.
 *
 * Two shapes, depending on how far the money has travelled:
 *
 *  - Not yet claimed (`pending`, or matured into `available`): the line is
 *    marked `reversed` and the counters are wound back. Nobody has been told
 *    a number that this contradicts.
 *
 *  - Already inside a payout request or paid out (`requested`, `paid`): the
 *    line is LEFT ALONE and a negative line `rev_<piId>` is written beside
 *    it. Rewriting a line that is part of a bank transfer would make the
 *    books disagree with the bank statement, and "we took it back out of a
 *    payout you already received" is not something a partner can verify.
 *    The negative line matures immediately, so it simply reduces the next
 *    payout — which is what actually happens in practice.
 *
 * NEVER THROWS. It runs inside the webhook next to the refund handling.
 */
export async function reverseCommission(
  paymentIntentId: string,
  reason: string,
): Promise<void> {
  try {
    const id = (paymentIntentId ?? "").trim();
    if (!id) return;

    const all = await affiliateStore.listAllCommissions();
    const target = all.find((c) => c.id === id);
    if (!target) return;

    if (target.status === "reversed") {
      console.info("[affiliate] commission already reversed:", id);
      return;
    }

    const why = (reason ?? "").trim().slice(0, 200) || "refund";

    if (target.status === "pending" || target.status === "available") {
      await affiliateStore.putCommission({
        ...target,
        status: "reversed",
        reversedReason: why,
      });

      // The customer stops counting towards the level only if this was their
      // only purchase — somebody who bought three times and returned one is
      // still a customer the partner brought.
      const others = all.filter(
        (c) =>
          c.id !== target.id &&
          !isReversal(c) &&
          c.status !== "reversed" &&
          c.affiliateEmail === target.affiliateEmail &&
          c.customerEmail === target.customerEmail,
      );

      await affiliateStore.bumpSummary(target.affiliateEmail, {
        revenueCents: -target.grossCents,
        earnedCents: -target.amountCents,
        payingCustomers: others.length === 0 ? -1 : 0,
      });

      console.info("[affiliate] reversed commission", id, "-", why);
      return;
    }

    const revId = `${REVERSAL_PREFIX}${id}`;
    const now = Date.now();
    const compensation: Commission = {
      ...target,
      id: revId,
      // Both amounts carry the original's magnitude with the opposite sign,
      // so every consumer can keep summing without a special case: revenue
      // and earnings both fall by exactly what the refund took back.
      grossCents: -target.grossCents,
      baseCents: -target.baseCents,
      amountCents: -target.amountCents,
      createdAt: now,
      // No hold: the money is already gone, and delaying the correction
      // would let a payout go out that the refund has already emptied.
      maturesAt: now,
      status: "pending",
      payoutId: null,
      reversedReason: why,
    };

    const written = await affiliateStore.putCommissionIfAbsent(compensation);
    if (!written) {
      console.info("[affiliate] reversal line already exists:", revId);
      return;
    }

    await affiliateStore.bumpSummary(target.affiliateEmail, {
      revenueCents: -target.grossCents,
      earnedCents: -target.amountCents,
    });

    console.info(
      `[affiliate] wrote compensating line ${revId} for a ${target.status} commission - ${why}`,
    );
  } catch (err) {
    console.error("[affiliate] reversing a commission failed:", err);
  }
}

/* -------------------------------------------------------------------------- */
/* 4. Repair                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Rebuild `affsum:<email>` from the commission lines.
 *
 * The counters are a cache — cheap to read for the admin partner list, and
 * the only thing in this system that can drift, because it is written by
 * increments rather than derived. The lines themselves are the truth. This
 * is what the admin's "Neu berechnen" button calls, and it is the reason a
 * lost increment is an inconvenience rather than a dispute.
 *
 * Throws on a store failure: the caller is an admin action that has to be
 * told it did not work, unlike everything above which runs beside a payment.
 */
export async function recomputeSummary(affEmail: string): Promise<AffiliateSummary> {
  const email = normalizeEmail(affEmail);
  const rows = await affiliateStore.listCommissions(email);

  let revenueCents = 0;
  let earnedCents = 0;
  let paidCents = 0;
  const payers = new Set<string>();

  for (const c of rows) {
    if (c.status === "reversed") continue;
    revenueCents += c.grossCents;
    earnedCents += c.amountCents;
    if (c.status === "paid") paidCents += c.amountCents;
    if (!isReversal(c)) payers.add(normalizeEmail(c.customerEmail));
  }

  const bindings = await affiliateStore.listBindings();
  const signups = bindings.filter((b) => normalizeEmail(b.affiliateEmail) === email).length;

  const aff = await affiliateStore.getAffiliate(email);
  const clicks = aff ? await affiliateStore.clicksFor(aff.code) : 0;

  const summary: AffiliateSummary = {
    clicks,
    signups,
    payingCustomers: payers.size,
    revenueCents,
    earnedCents,
    paidCents,
    updatedAt: Date.now(),
  };

  await affiliateStore.putSummary(email, summary);
  return summary;
}
