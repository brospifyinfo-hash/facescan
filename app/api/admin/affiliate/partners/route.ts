import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { normalizeEmail } from "@/lib/auth/store";
import { recomputeSummary } from "@/lib/affiliate/commission";
import {
  sendApplicationApproved,
  sendApplicationRejected,
  siteOrigin,
} from "@/lib/affiliate/email";
import { maskIban } from "@/lib/affiliate/iban";
import { effectiveMinCents } from "@/lib/affiliate/payouts";
import { affiliateStore } from "@/lib/affiliate/store";
import {
  EMPTY_SUMMARY,
  levelFor,
  maskEmail,
  payableCents,
  pendingCents,
  percentFor,
  requestedCents,
  type Affiliate,
  type AffiliateConfig,
  type AffiliateSummary,
  type Commission,
  type LevelNumber,
} from "@/lib/affiliate/model";

export const runtime = "nodejs";

// The partner list and the single-partner file behind it.
//
// WHERE EACH NUMBER COMES FROM — one rule, applied everywhere in this file:
//
//   money            from the commission lines. They are the ledger; a payout
//                    is defended with them, so the admin has to see the same
//                    thing the payout code sums.
//   level / percent  from affsum:<email>.payingCustomers. NOT from the lines,
//                    even though the lines would be more accurate — that
//                    counter is what create-payment-intent reads when it
//                    freezes a rate, so it is the rate the NEXT sale will
//                    actually pay. Showing a nicer number here would be a
//                    promise nobody keeps. "recalc" rewrites the counter from
//                    the lines when the two have drifted apart.
//   clicks/signups   from the counter in the list (one cheap read per row) and
//                    from their exact sources in the detail view, where a
//                    single partner can afford the extra scans.
//
// The admin sees real customer addresses here. That is the difference between
// this route and /api/affiliate/me, which never does — a partner has no
// business holding our customer list, an operator handling a dispute does.

/** A reversal line: negative amounts booked beside an already-claimed sale. */
const isReversal = (c: Commission) => c.id.startsWith("rev_");

/** Summary reads cost one store round trip each; a wide list would stampede. */
const SUMMARY_CONCURRENCY = 8;

const MAX_NOTE = 2000;
const MAX_REASON = 300;

interface Money {
  revenueCents: number;
  earnedCents: number;
  availableCents: number;
  pendingCents: number;
  requestedCents: number;
  paidCents: number;
}

function moneyFor(lines: Commission[], now: number): Money {
  let revenueCents = 0;
  let earnedCents = 0;
  let paidCents = 0;
  for (const c of lines) {
    // The reversed original is dropped and its negative "rev_" twin is kept,
    // so a refund lowers both revenue and earnings by exactly what it took.
    if (c.status === "reversed") continue;
    revenueCents += c.grossCents;
    earnedCents += c.amountCents;
    if (c.status === "paid") paidCents += c.amountCents;
  }
  return {
    revenueCents,
    earnedCents,
    paidCents,
    availableCents: payableCents(lines, now),
    pendingCents: pendingCents(lines, now),
    requestedCents: requestedCents(lines, now),
  };
}

function displayName(aff: Affiliate): string {
  const name = `${aff.firstName} ${aff.lastName}`.trim();
  return name || aff.accountHolder.trim();
}

function groupByPartner(lines: Commission[]): Map<string, Commission[]> {
  const map = new Map<string, Commission[]>();
  for (const c of lines) {
    const key = normalizeEmail(c.affiliateEmail);
    const list = map.get(key);
    if (list) list.push(c);
    else map.set(key, [c]);
  }
  return map;
}

/** The stored status is what was written; this is what it is worth today. */
function statusNow(c: Commission, now: number) {
  return c.status === "pending" && now >= c.maturesAt ? "available" : c.status;
}

/**
 * The masked IBAN for a partner row.
 *
 * Rebuilt from the two fields that are stored in the clear (country and last
 * four) rather than by decrypting the real one: the plaintext exists in
 * exactly one place in this admin area, behind a deliberate click on
 * /api/admin/affiliate/reveal-iban. The middle of the string is dots anyway.
 */
function maskedIban(aff: Affiliate): string {
  if (!aff.ibanLast4) return "";
  const country = (aff.ibanCountry || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2);
  // maskIban drops everything that is not alphanumeric, so a missing country
  // would silently turn into two zeroes that read like a real prefix.
  if (country.length !== 2) return `•••• •••• ${aff.ibanLast4}`;
  return maskIban(`${country}00000000${aff.ibanLast4}`);
}

function baseRow(
  aff: Affiliate,
  cfg: AffiliateConfig,
  summary: AffiliateSummary,
  money: Money,
  counts: { clicks: number; signups: number },
) {
  const rule = levelFor(summary.payingCustomers, cfg, aff.levelOverride);
  return {
    email: aff.email,
    name: displayName(aff),
    code: aff.code,
    status: aff.status,
    level: rule.level,
    levelLabel: rule.label,
    percent: percentFor(aff, cfg, summary.payingCustomers),
    clicks: counts.clicks,
    payingCustomers: summary.payingCustomers,
    signups: counts.signups,
    revenueCents: money.revenueCents,
    earnedCents: money.earnedCents,
    availableCents: money.availableCents,
    pendingCents: money.pendingCents,
    paidCents: money.paidCents,
    createdAt: aff.createdAt,
  };
}

async function summariesFor(emails: string[]): Promise<Map<string, AffiliateSummary>> {
  const out = new Map<string, AffiliateSummary>();
  for (let i = 0; i < emails.length; i += SUMMARY_CONCURRENCY) {
    const slice = emails.slice(i, i + SUMMARY_CONCURRENCY);
    const rows = await Promise.all(slice.map((email) => affiliateStore.getSummary(email)));
    slice.forEach((email, index) => out.set(email, rows[index]));
  }
  return out;
}

/** Everything on one partner: money, referred customers, commissions, payouts. */
async function partnerDetail(aff: Affiliate, cfg: AffiliateConfig) {
  const [summary, lines, bindings, payouts, clicks] = await Promise.all([
    affiliateStore.getSummary(aff.email),
    affiliateStore.listCommissions(aff.email),
    affiliateStore.listBindings(),
    affiliateStore.listPayoutsFor(aff.email),
    affiliateStore.clicksFor(aff.code),
  ]);

  const now = Date.now();
  const partner = normalizeEmail(aff.email);
  const mine = bindings.filter((b) => normalizeEmail(b.affiliateEmail) === partner);

  const byCustomer = new Map<string, Commission[]>();
  for (const c of lines) {
    const key = normalizeEmail(c.customerEmail);
    const list = byCustomer.get(key);
    if (list) list.push(c);
    else byCustomer.set(key, [c]);
  }

  // Built from the bindings rather than from the commissions, so a customer
  // who has been bound for weeks without buying still appears — that is
  // exactly the row an operator needs when a partner asks why nothing arrives.
  const referrals = mine
    .map((b) => {
      const customer = normalizeEmail(b.customerEmail);
      const own = byCustomer.get(customer) ?? [];
      let purchases = 0;
      let spentCents = 0;
      let commissionCents = 0;
      for (const c of own) {
        if (c.status === "reversed") continue;
        spentCents += c.grossCents;
        commissionCents += c.amountCents;
        if (!isReversal(c)) purchases += 1;
      }
      return {
        email: b.customerEmail,
        masked: maskEmail(b.customerEmail),
        boundAt: b.boundAt,
        firstPurchaseAt: b.firstPurchaseAt,
        source: b.source,
        purchases,
        spentCents,
        commissionCents,
      };
    })
    .sort((a, b) => b.boundAt - a.boundAt);

  const row = baseRow(aff, cfg, summary, moneyFor(lines, now), {
    clicks,
    // The bindings are the exact source; the counter is only the shortcut the
    // list view uses.
    signups: mine.length,
  });

  return {
    ...row,
    address: aff.address,
    accountHolder: aff.accountHolder,
    ibanMasked: maskedIban(aff),
    note: aff.note,
    percentOverride: aff.percentOverride,
    levelOverride: aff.levelOverride,
    payoutMinOverrideCents: aff.payoutMinOverrideCents,
    minCents: effectiveMinCents(aff, cfg),
    history: aff.history,
    approvedAt: aff.approvedAt,
    invitedWithCode: aff.invitedWithCode,
    commissions: lines
      .map((c) => ({
        id: c.id,
        at: c.createdAt,
        customer: c.customerEmail,
        masked: maskEmail(c.customerEmail),
        plan: c.plan,
        grossCents: c.grossCents,
        amountCents: c.amountCents,
        percent: c.percent,
        level: c.level,
        status: statusNow(c, now),
        maturesAt: c.maturesAt,
        payoutId: c.payoutId,
        reversedReason: c.reversedReason,
      }))
      .sort((a, b) => b.at - a.at),
    referrals,
    payouts: payouts
      .map((p) => ({
        ...p,
        // From the snapshot, like the payouts route: what the request was
        // made against, not what the partner's file says today.
        name: p.snapshot.accountHolder,
        ibanMasked: p.snapshot.ibanLast4 ? `•••• •••• ${p.snapshot.ibanLast4}` : "",
      }))
      .sort((a, b) => b.requestedAt - a.requestedAt),
  };
}

export async function GET(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const wanted = normalizeEmail(new URL(request.url).searchParams.get("email") ?? "");

  try {
    const cfg = await affiliateStore.getConfig();

    if (wanted) {
      const aff = await affiliateStore.getAffiliate(wanted);
      if (!aff) return NextResponse.json({ error: "not_found" }, { status: 404 });
      return NextResponse.json({ partner: await partnerDetail(aff, cfg) });
    }

    const [affiliates, commissions] = await Promise.all([
      affiliateStore.listAffiliates(),
      affiliateStore.listAllCommissions(),
    ]);

    const now = Date.now();
    const grouped = groupByPartner(commissions);
    const summaries = await summariesFor(affiliates.map((a) => normalizeEmail(a.email)));

    const partners = affiliates
      .map((aff) => {
        const key = normalizeEmail(aff.email);
        // A partner the counter has never seen still belongs in the list, at zero.
        const summary = summaries.get(key) ?? EMPTY_SUMMARY;
        return baseRow(aff, cfg, summary, moneyFor(grouped.get(key) ?? [], now), {
          clicks: summary.clicks,
          signups: summary.signups,
        });
      })
      .sort((a, b) => b.revenueCents - a.revenueCents || b.createdAt - a.createdAt);

    return NextResponse.json({ partners });
  } catch (err) {
    console.error("[affiliate] admin partner list failed:", err);
    return NextResponse.json({ error: "store_unavailable" }, { status: 503 });
  }
}

/* -------------------------------------------------------------------------- */
/* PATCH - the eleven actions                                                  */
/* -------------------------------------------------------------------------- */

type Action =
  | "approve"
  | "reject"
  | "block"
  | "unblock"
  | "set-percent"
  | "set-level"
  | "set-min"
  | "note"
  | "recalc"
  | "bind"
  | "unbind";

const ACTIONS: Action[] = [
  "approve",
  "reject",
  "block",
  "unblock",
  "set-percent",
  "set-level",
  "set-min",
  "note",
  "recalc",
  "bind",
  "unbind",
];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * A number in range, `null` for "clear the override", or `undefined` for
 * "that is not a valid value".
 *
 * `null` and `0` must not collapse into each other: an override of 0 % or a
 * minimum of 0 cents are real settings ("this partner is paid whatever has
 * accrued"), while null means the global rule applies again.
 */
function overrideNumber(
  value: unknown,
  opts: { min: number; max: number; integer: boolean },
): number | null | undefined {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  if (value < opts.min || value > opts.max) return undefined;
  if (opts.integer && !Number.isInteger(value)) return undefined;
  return opts.integer ? value : Math.round(value * 10) / 10;
}

function customerFrom(value: unknown): string {
  if (typeof value === "string") return normalizeEmail(value);
  if (isRecord(value)) return normalizeEmail(String(value.customerEmail ?? ""));
  return "";
}

function reasonFrom(value: unknown): string {
  if (typeof value === "string") return value.trim().slice(0, MAX_REASON);
  if (isRecord(value) && typeof value.reason === "string") {
    return value.reason.trim().slice(0, MAX_REASON);
  }
  return "";
}

export async function PATCH(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!isRecord(body)) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const email = normalizeEmail(String(body.email ?? ""));
  const action = String(body.action ?? "") as Action;
  const value = body.value;

  if (!email) return NextResponse.json({ error: "email_required" }, { status: 400 });
  if (!ACTIONS.includes(action)) {
    return NextResponse.json({ error: "unknown_action" }, { status: 400 });
  }

  try {
    const cfg = await affiliateStore.getConfig();
    const aff = await affiliateStore.getAffiliate(email);
    if (!aff) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const now = Date.now();

    switch (action) {
      case "approve": {
        // Only an application can be approved. Re-approving an active partner
        // would move approvedAt and re-send the welcome mail; a blocked one
        // has to be unblocked, which is a different decision.
        if (aff.status !== "pending") {
          return NextResponse.json({ error: "bad_state" }, { status: 409 });
        }
        const next: Affiliate = { ...aff, status: "active", approvedAt: now };
        await affiliateStore.putAffiliate(next);
        try {
          await sendApplicationApproved(next.email, {
            locale: "de",
            code: next.code,
            link: `${siteOrigin()}/partner`,
          });
        } catch (err) {
          // The partner is active either way; a mail that failed to send is
          // not a reason to roll that back.
          console.error("[affiliate] approval mail failed:", err);
        }
        break;
      }

      case "reject": {
        if (aff.status !== "pending") {
          return NextResponse.json({ error: "bad_state" }, { status: 409 });
        }
        // "blocked", not deleted: the record keeps the code out of circulation
        // and documents that the application was seen and answered.
        const next: Affiliate = { ...aff, status: "blocked" };
        await affiliateStore.putAffiliate(next);
        try {
          await sendApplicationRejected(next.email, {
            locale: "de",
            reason: reasonFrom(value),
          });
        } catch (err) {
          console.error("[affiliate] rejection mail failed:", err);
        }
        break;
      }

      case "block": {
        if (aff.status === "blocked") {
          return NextResponse.json({ error: "bad_state" }, { status: 409 });
        }
        await affiliateStore.putAffiliate({ ...aff, status: "blocked" });
        break;
      }

      case "unblock": {
        if (aff.status !== "blocked") {
          return NextResponse.json({ error: "bad_state" }, { status: 409 });
        }
        // An unblocked partner is active, not back in the application queue —
        // they were approved once and that decision stands.
        await affiliateStore.putAffiliate({
          ...aff,
          status: "active",
          approvedAt: aff.approvedAt ?? now,
        });
        break;
      }

      case "set-percent": {
        const percent = overrideNumber(value, { min: 0, max: 50, integer: false });
        if (percent === undefined) {
          return NextResponse.json({ error: "invalid_value" }, { status: 400 });
        }
        await affiliateStore.putAffiliate({ ...aff, percentOverride: percent });
        break;
      }

      case "set-level": {
        const level = overrideNumber(value, { min: 1, max: 5, integer: true });
        if (level === undefined) {
          return NextResponse.json({ error: "invalid_value" }, { status: 400 });
        }
        await affiliateStore.putAffiliate({
          ...aff,
          levelOverride: level === null ? null : (level as LevelNumber),
        });
        break;
      }

      case "set-min": {
        const min = overrideNumber(value, { min: 0, max: 100000, integer: true });
        if (min === undefined) {
          return NextResponse.json({ error: "invalid_value" }, { status: 400 });
        }
        await affiliateStore.putAffiliate({ ...aff, payoutMinOverrideCents: min });
        break;
      }

      case "note": {
        if (typeof value !== "string") {
          return NextResponse.json({ error: "invalid_value" }, { status: 400 });
        }
        await affiliateStore.putAffiliate({ ...aff, note: value.trim().slice(0, MAX_NOTE) });
        break;
      }

      case "recalc": {
        // Rebuilds affsum:<email> from the commission lines — the repair for
        // an increment lost to a timeout, and the reason a drifting counter is
        // an inconvenience rather than a dispute.
        await recomputeSummary(email);
        break;
      }

      case "bind": {
        const customer = customerFrom(value);
        if (!customer || !customer.includes("@")) {
          return NextResponse.json({ error: "invalid_value" }, { status: 400 });
        }
        if (cfg.selfReferralBlocked && customer === email) {
          return NextResponse.json({ error: "self_referral" }, { status: 400 });
        }
        const existing = await affiliateStore.getBinding(customer);
        await affiliateStore.putBinding({
          customerEmail: customer,
          affiliateEmail: aff.email,
          code: aff.code,
          boundAt: existing?.boundAt ?? now,
          source: "manual",
          // Carried over even when the customer is moved to another partner:
          // it records that this customer has already bought, and dropping it
          // would let a "first purchase only" commission be booked twice.
          firstPurchaseAt: existing?.firstPurchaseAt ?? null,
        });
        break;
      }

      case "unbind": {
        const customer = customerFrom(value);
        if (!customer) {
          return NextResponse.json({ error: "invalid_value" }, { status: 400 });
        }
        const existing = await affiliateStore.getBinding(customer);
        // A binding is only removable from the screen of the partner it
        // belongs to; deleting a foreign one from here would be an unrelated
        // side effect of an action that names this partner.
        if (!existing || normalizeEmail(existing.affiliateEmail) !== email) {
          return NextResponse.json({ error: "not_bound" }, { status: 409 });
        }
        await affiliateStore.deleteBinding(customer);
        break;
      }
    }

    // Always the fresh file, read back through the same path GET uses, so the
    // caller never has to guess what a successful action left behind.
    const saved = await affiliateStore.getAffiliate(email);
    if (!saved) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ ok: true, partner: await partnerDetail(saved, cfg) });
  } catch (err) {
    console.error(`[affiliate] admin partner action "${action}" failed:`, err);
    return NextResponse.json({ error: "store_unavailable" }, { status: 503 });
  }
}
