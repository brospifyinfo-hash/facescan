import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { currentSession } from "@/lib/auth/session";
import { affiliateBacking, affiliatePersistent, affiliateStore } from "@/lib/affiliate/store";
import { siteOrigin } from "@/lib/affiliate/email";
import { effectiveMinCents } from "@/lib/affiliate/payouts";
import {
  affiliateLink,
  effectiveStatus,
  levelFor,
  maskEmail,
  nextLevel,
  percentFor,
  sortedLevels,
  type Affiliate,
  type AffiliateConfig,
  type Commission,
  type Payout,
} from "@/lib/affiliate/model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Everything the partner page renders, in one request.
//
// THE IDENTITY IS THE SESSION, FULL STOP. There is no `?email=` and there
// never may be: this response contains a person's address, their payout
// balance and the shape of their bank details, and a route that takes the
// address from the request is a route that hands all three to anybody who
// can type. The route is deliberately thin — every rule it reports lives in
// lib/affiliate, and this file only shapes it for the client.
//
// THE LEDGER IS THE TRUTH, NOT THE COUNTER CACHE. `affsum:` is written by
// increments and can drift when one of them is lost. Every euro figure below
// is summed from the commission lines instead; only clicks and signups —
// which no line records — come from the cache. A drifting cache should cost
// the partner nothing, and a dashboard that promises a payout the payout
// route then refuses is worse than no dashboard at all.
//
// NO CUSTOMER ADDRESSES LEAVE HERE. The referred customer's e-mail is
// masked, always. The partner does not need it and it is not their data.

/** The history is a scroll-back, not an archive — an old line changes nothing. */
const MAX_COMMISSION_ROWS = 100;

/**
 * Reversal lines are booked as `rev_<paymentIntentId>` beside the original.
 * They carry a negative amount and no new customer, so they are counted in
 * the money but never in the "unique paying customers" that drive the level.
 */
const isReversal = (c: Commission) => c.id.startsWith("rev_");

/**
 * The masked IBAN, built from the two fields stored in the clear.
 *
 * Deliberately NOT `maskIban(decryptSecret(...))`: the plaintext IBAN is
 * allowed to exist in exactly two places (the admin reveal and the payout
 * export), and a dashboard that anyone's stolen session cookie can open is
 * not one of them.
 */
function maskedIban(aff: Affiliate): string {
  const country = (aff.ibanCountry || "").toUpperCase().slice(0, 2);
  const last4 = aff.ibanLast4 || "";
  if (!country && !last4) return "";
  return `${country || "??"}•• •••• ${last4 || "????"}`;
}

/**
 * The QR code for the partner's link, rendered server-side as an SVG string.
 *
 * White on transparent so it drops onto the dark page without a card around
 * it (invariant 6: no containers). A failure here returns null rather than
 * throwing — a missing QR code costs the partner a nice-to-have, while a 500
 * would cost them the whole dashboard.
 */
async function qrFor(link: string): Promise<string | null> {
  try {
    return await QRCode.toString(link, {
      type: "svg",
      margin: 1,
      color: { dark: "#ffffff", light: "#00000000" },
    });
  } catch (err) {
    console.error("[affiliate] QR code rendering failed:", err);
    return null;
  }
}

function publicPayout(p: Payout) {
  return {
    id: p.id,
    amountCents: p.amountCents,
    status: p.status,
    requestedAt: p.requestedAt,
    paidAt: p.paidAt,
    reference: p.reference,
    rejectionReason: p.rejectionReason,
    count: p.commissionIds.length,
  };
}

/** The programme-wide facts, shown whether or not the caller is a partner. */
function programme(cfg: AffiliateConfig, origin: string) {
  return {
    enabled: cfg.enabled,
    joinMode: cfg.joinMode,
    requireApproval: cfg.requireApproval,
    terms: cfg.terms,
    holdDays: cfg.holdDays,
    backing: affiliateBacking(),
    // The page uses this to say plainly that nothing is being kept yet,
    // instead of showing a balance a cold start will erase.
    persistent: affiliatePersistent(),
    levels: sortedLevels(cfg),
    origin,
  };
}

export async function GET() {
  const session = await currentSession();
  if (!session) {
    // The page treats this as "not signed in" and shows the explainer, so it
    // is a normal answer rather than an error worth logging.
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  try {
    const origin = siteOrigin();
    const cfg = await affiliateStore.getConfig();
    const aff = await affiliateStore.getAffiliate(session.email);

    if (!aff) {
      const first = levelFor(0, cfg);
      const upcoming = nextLevel(first, cfg);
      return NextResponse.json({
        ...programme(cfg, origin),
        affiliate: null,
        summary: {
          clicks: 0,
          signups: 0,
          payingCustomers: 0,
          revenueCents: 0,
          earnedCents: 0,
          paidCents: 0,
          pendingCents: 0,
          availableCents: 0,
          requestedCents: 0,
        },
        // Shown on the application form: what the first rung pays, and what
        // the second one is worth. Real numbers from the live config, never
        // an example.
        progress: {
          current: first,
          next: upcoming,
          need: upcoming ? upcoming.minReferrals : 0,
        },
        commissions: [],
        payouts: [],
        openPayout: false,
      });
    }

    const now = Date.now();
    const [lines, payouts, cached] = await Promise.all([
      affiliateStore.listCommissions(aff.email),
      affiliateStore.listPayoutsFor(aff.email),
      affiliateStore.getSummary(aff.email),
    ]);

    // One pass over the ledger for every figure on the page. `status` here is
    // the EFFECTIVE one: a line ripens by the clock, not by a cron job.
    let revenueCents = 0;
    let earnedCents = 0;
    let paidCents = 0;
    let pendingCents = 0;
    let availableCents = 0;
    let requestedCents = 0;
    const payers = new Set<string>();

    for (const c of lines) {
      const status = effectiveStatus(c, now);
      if (status === "reversed") continue;
      revenueCents += c.grossCents;
      earnedCents += c.amountCents;
      if (status === "paid") paidCents += c.amountCents;
      if (status === "pending") pendingCents += c.amountCents;
      if (status === "available") availableCents += c.amountCents;
      if (status === "requested") requestedCents += c.amountCents;
      if (!isReversal(c)) payers.add(c.customerEmail.toLowerCase());
    }

    // A refund can push a bucket negative through its compensating line. The
    // partner owes us nothing in that case; they simply have nothing to
    // claim, which is what a floor of zero says.
    const clamp = (n: number) => Math.max(0, n);

    const payingCustomers = payers.size;
    const current = levelFor(payingCustomers, cfg, aff.levelOverride);
    const upcoming = nextLevel(current, cfg);
    const link = affiliateLink(origin, aff.code);

    const rows = [...lines]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, MAX_COMMISSION_ROWS)
      .map((c) => ({
        id: c.id,
        at: c.createdAt,
        plan: c.plan,
        customer: maskEmail(c.customerEmail),
        grossCents: c.grossCents,
        amountCents: c.amountCents,
        percent: c.percent,
        level: c.level,
        status: effectiveStatus(c, now),
        maturesAt: c.maturesAt,
      }));

    return NextResponse.json({
      ...programme(cfg, origin),
      affiliate: {
        code: aff.code,
        status: aff.status,
        link,
        // Only an active partner has a link worth spreading; a pending or
        // blocked one gets no printable code to hand out.
        qrSvg: aff.status === "active" ? await qrFor(link) : null,
        firstName: aff.firstName,
        lastName: aff.lastName,
        address: aff.address,
        accountHolder: aff.accountHolder,
        ibanMasked: maskedIban(aff),
        createdAt: aff.createdAt,
        level: current.level,
        levelLabel: current.label,
        percent: percentFor(aff, cfg, payingCustomers),
        minCents: effectiveMinCents(aff, cfg),
      },
      summary: {
        // Clicks and signups are the two figures no commission line records,
        // so these alone come from the counter cache.
        clicks: cached.clicks,
        signups: cached.signups,
        payingCustomers,
        revenueCents: clamp(revenueCents),
        earnedCents: clamp(earnedCents),
        paidCents: clamp(paidCents),
        pendingCents: clamp(pendingCents),
        availableCents: clamp(availableCents),
        requestedCents: clamp(requestedCents),
      },
      progress: {
        current,
        next: upcoming,
        need: upcoming ? Math.max(0, upcoming.minReferrals - payingCustomers) : 0,
      },
      commissions: rows,
      payouts: [...payouts]
        .sort((a, b) => b.requestedAt - a.requestedAt)
        .map(publicPayout),
      // Drives the disabled state of the request button, and matches exactly
      // the condition lib/affiliate/payouts.ts refuses a second request on.
      openPayout: payouts.some((p) => p.status === "requested" || p.status === "approved"),
    });
  } catch (err) {
    console.error("[affiliate] loading the partner dashboard failed:", err);
    return NextResponse.json({ error: "store_unavailable" }, { status: 503 });
  }
}
