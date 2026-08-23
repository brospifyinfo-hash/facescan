import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { normalizeEmail } from "@/lib/auth/store";
import { piiKeyConfigured } from "@/lib/affiliate/crypto";
import {
  affiliateBacking,
  affiliatePersistent,
  affiliateStore,
} from "@/lib/affiliate/store";
import {
  EMPTY_SUMMARY,
  levelFor,
  payableCents,
  pendingCents,
  percentFor,
  requestedCents,
  type Affiliate,
  type AffiliateSummary,
  type Commission,
} from "@/lib/affiliate/model";

export const runtime = "nodejs";

// The programme at a glance: how much has been promised, how much has ripened,
// how much is waiting for a transfer — and who is bringing it in.
//
// EVERY NUMBER HERE COMES FROM THE COMMISSION LINES, NOT FROM affsum:*.
// The counters are written by increments and an increment lost to a cold start
// or a spreadsheet timeout leaves no trace, while the lines are the ledger. An
// overview built on the cache would show the drift as fact; built on the lines
// it shows what a payout would actually be worth today.
//
// Two things do come from the counters. Clicks, because a click leaves no
// other trace in the system at all; and the level of the top partners, because
// that same counter is what create-payment-intent reads when it freezes a
// rate. Showing a different level here than the one the next sale would
// actually pay would be a lie in the more expensive direction.

/** A reversal line: negative amounts booked beside an already-claimed sale. */
const isReversal = (c: Commission) => c.id.startsWith("rev_");

interface Money {
  revenueCents: number;
  earnedCents: number;
  pendingCents: number;
  availableCents: number;
  requestedCents: number;
  paidCents: number;
  payingCustomers: number;
  commissionCount: number;
}

function moneyFor(lines: Commission[], now: number): Money {
  let revenueCents = 0;
  let earnedCents = 0;
  let paidCents = 0;
  const payers = new Set<string>();

  for (const c of lines) {
    // A reversed line is money that was taken back; the compensating "rev_"
    // line carries the negative amounts and IS counted, which is how a refund
    // reduces the next payout instead of vanishing.
    if (c.status === "reversed") continue;
    revenueCents += c.grossCents;
    earnedCents += c.amountCents;
    if (c.status === "paid") paidCents += c.amountCents;
    if (!isReversal(c)) payers.add(normalizeEmail(c.customerEmail));
  }

  return {
    revenueCents,
    earnedCents,
    paidCents,
    pendingCents: pendingCents(lines, now),
    availableCents: payableCents(lines, now),
    requestedCents: requestedCents(lines, now),
    payingCustomers: payers.size,
    commissionCount: lines.filter((c) => !isReversal(c)).length,
  };
}

function displayName(aff: Affiliate): string {
  const name = `${aff.firstName} ${aff.lastName}`.trim();
  return name || aff.accountHolder.trim();
}

/** Summary reads cost one store round trip each; a wide list would stampede. */
const SUMMARY_CONCURRENCY = 8;

async function summariesFor(emails: string[]): Promise<Map<string, AffiliateSummary>> {
  const out = new Map<string, AffiliateSummary>();
  for (let i = 0; i < emails.length; i += SUMMARY_CONCURRENCY) {
    const slice = emails.slice(i, i + SUMMARY_CONCURRENCY);
    const rows = await Promise.all(slice.map((email) => affiliateStore.getSummary(email)));
    slice.forEach((email, index) => out.set(email, rows[index]));
  }
  return out;
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const [config, affiliates, bindings, commissions, payouts] = await Promise.all([
      affiliateStore.getConfig(),
      affiliateStore.listAffiliates(),
      affiliateStore.listBindings(),
      affiliateStore.listAllCommissions(),
      affiliateStore.listPayouts(),
    ]);

    const now = Date.now();
    const byPartner = new Map<string, Commission[]>();
    for (const c of commissions) {
      const key = normalizeEmail(c.affiliateEmail);
      const list = byPartner.get(key);
      if (list) list.push(c);
      else byPartner.set(key, [c]);
    }

    const overall = moneyFor(commissions, now);

    const open = payouts.filter((p) => p.status === "requested" || p.status === "approved");

    // The counters are read for every partner, not just the ten shown: the
    // click total has no other source (nothing writes a click into a
    // commission line) and the levels below need them anyway.
    const summaries = await summariesFor(affiliates.map((a) => normalizeEmail(a.email)));
    const clicks = [...summaries.values()].reduce((sum, s) => sum + s.clicks, 0);

    // Ranked on the lines, so the ten shown are the ten who actually brought
    // the revenue in — not the ten with the busiest counters.
    const top = affiliates
      .map((aff) => {
        const key = normalizeEmail(aff.email);
        const money = moneyFor(byPartner.get(key) ?? [], now);
        const summary = summaries.get(key) ?? EMPTY_SUMMARY;
        const rule = levelFor(summary.payingCustomers, config, aff.levelOverride);
        return {
          email: aff.email,
          name: displayName(aff),
          code: aff.code,
          status: aff.status,
          level: rule.level,
          levelLabel: rule.label,
          percent: percentFor(aff, config, summary.payingCustomers),
          clicks: summary.clicks,
          // From the counter, like the level above it: the two belong together.
          payingCustomers: summary.payingCustomers,
          revenueCents: money.revenueCents,
          earnedCents: money.earnedCents,
          availableCents: money.availableCents,
        };
      })
      .sort((a, b) => b.revenueCents - a.revenueCents || b.earnedCents - a.earnedCents)
      .slice(0, 10);

    return NextResponse.json({
      config,
      backing: affiliateBacking(),
      persistent: affiliatePersistent(),
      // Without the key no application can be accepted at all, so the admin
      // has to see it here rather than discover it through a partner's
      // failed sign-up.
      piiKey: piiKeyConfigured(),
      totals: {
        partners: affiliates.length,
        activePartners: affiliates.filter((a) => a.status === "active").length,
        pendingPartners: affiliates.filter((a) => a.status === "pending").length,
        blockedPartners: affiliates.filter((a) => a.status === "blocked").length,
        boundCustomers: bindings.length,
        payingCustomers: overall.payingCustomers,
        clicks,
        commissions: overall.commissionCount,
        revenueCents: overall.revenueCents,
        earnedCents: overall.earnedCents,
        pendingCents: overall.pendingCents,
        availableCents: overall.availableCents,
        requestedCents: overall.requestedCents,
        paidCents: overall.paidCents,
        openPayouts: open.length,
        openPayoutCents: open.reduce((sum, p) => sum + p.amountCents, 0),
      },
      top,
    });
  } catch (err) {
    console.error("[affiliate] admin overview failed:", err);
    return NextResponse.json({ error: "store_unavailable" }, { status: 503 });
  }
}
