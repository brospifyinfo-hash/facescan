// Payout requests: the only place a partner's balance turns into a claim.
//
// THE SYSTEM NEVER MOVES MONEY. There is no Stripe Connect, no SEPA file, no
// automation. A payout is a request that an operator reads, checks and then
// pays from their own bank — the code's job is to make the amount defensible
// and to stop the same money being claimed twice. Everything here is built
// around that second part.
//
// WHY THE AMOUNT IS RECOMPUTED FROM THE LINES
// -------------------------------------------
// `affsum:<email>` is a counter cache written by increments, and an
// increment that is lost in a cold start or a spreadsheet timeout is
// invisible. The commission lines are the ledger. A payout amount is
// therefore always the sum of the lines that are actually available right
// now, never the cached total — a drifting cache should cost the operator a
// wrong-looking dashboard number, never a wrong bank transfer.
//
// WHY THE PAYOUT CARRIES A SNAPSHOT
// ---------------------------------
// A partner may edit their address or IBAN at any time, including while a
// request is open. The transfer was prepared against the data of the moment
// it was requested, so that data is frozen into the request. Otherwise a
// dispute six months later ("you sent it to the wrong account") would have
// no record of where it was actually sent.

import { normalizeEmail } from "@/lib/auth/store";
import { affiliateStore } from "@/lib/affiliate/store";
import { randomCode } from "@/lib/affiliate/codes";
import {
  sendPayoutPaid,
  sendPayoutRejected,
  sendPayoutRequestedAdmin,
  sendPayoutRequestedPartner,
  siteOrigin,
} from "@/lib/affiliate/email";
import {
  effectiveStatus,
  payableCents,
  type Affiliate,
  type AffiliateConfig,
  type Payout,
} from "@/lib/affiliate/model";

/** Partner mails have no locale to read yet — Profile and Session carry none. */
const PARTNER_LOCALE = "de" as const;

const partnerLink = () => `${siteOrigin()}/partner`;
const adminLink = () => `${siteOrigin()}/admin/affiliate/auszahlungen`;

/**
 * What this partner has to reach before they may request a payout.
 *
 * `0` is a legitimate override and means "no minimum" — some partners are
 * paid whatever has accrued. `null` means the global rule applies, which is
 * why the check is against `null` and not against falsiness: `?? ` here and
 * `||` would quietly turn an override of 0 back into the global minimum.
 */
export function effectiveMinCents(aff: Affiliate, cfg: AffiliateConfig): number {
  const own = aff.payoutMinOverrideCents;
  if (typeof own === "number" && Number.isFinite(own) && own >= 0) return Math.round(own);
  return Math.max(0, Math.round(cfg.payoutMinCents));
}

export type PayoutResult =
  | { ok: true; payout: Payout }
  | {
      ok: false;
      error:
        | "not_active"
        | "below_minimum"
        | "open_payout"
        | "no_commissions"
        | "invalid_payout_info"
        | "store_unavailable"
        | "not_found"
        | "bad_state";
      status: number;
      availableCents?: number;
      minCents?: number;
    };

/**
 * The masked form the operator sees in the alert mail.
 *
 * Built from the two fields that are stored in the clear (country and last
 * four) rather than by decrypting: an IBAN belongs in the admin screen after
 * a deliberate click, never in a mailbox.
 */
function maskedIban(aff: Affiliate): string {
  const country = (aff.ibanCountry || "").toUpperCase().slice(0, 2);
  const last4 = aff.ibanLast4 || "";
  if (!country && !last4) return "";
  return `${country || "??"}•• •••• ${last4 || "????"}`;
}

/**
 * Is there enough on file to actually make a transfer?
 *
 * The checksum is NOT re-verified here, and that is deliberate: verifying it
 * would mean decrypting the IBAN, and the plaintext is allowed to exist in
 * exactly two places (the admin reveal and the payout export). It cannot be
 * invalid anyway — `applyForAffiliate`/`updatePayoutInfo` are the only
 * writers and both refuse a failing mod-97 before anything is stored.
 */
function payoutInfoComplete(aff: Affiliate): boolean {
  const filled = (v: string | undefined, min: number) =>
    typeof v === "string" && v.trim().length >= min;
  return (
    filled(aff.ibanEnc, 8) &&
    filled(aff.ibanLast4, 4) &&
    filled(aff.ibanCountry, 2) &&
    filled(aff.accountHolder, 2) &&
    filled(aff.address?.street, 2) &&
    filled(aff.address?.postalCode, 2) &&
    filled(aff.address?.city, 2) &&
    filled(aff.address?.country, 2)
  );
}

/** "po_" + 12 characters, checked against the store so two requests cannot share an id. */
async function newPayoutId(): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const id = `po_${randomCode(12)}`;
    if (!(await affiliateStore.getPayout(id))) return id;
  }
  throw new Error("could not generate a free payout id");
}

/**
 * Request the payout of everything currently available.
 *
 * The six checks run in the order of the specification, and the order
 * matters: the caller is shown the FIRST reason it cannot proceed, and
 * "you have an open request" is more useful than "you are 3 € short".
 */
export async function requestPayout(email: string): Promise<PayoutResult> {
  const partner = normalizeEmail(email ?? "");
  if (!partner) return { ok: false, error: "not_found", status: 404 };

  try {
    // 1. The partner exists and is allowed to earn.
    const aff = await affiliateStore.getAffiliate(partner);
    if (!aff) return { ok: false, error: "not_found", status: 404 };
    if (aff.status !== "active") return { ok: false, error: "not_active", status: 403 };

    const cfg = await affiliateStore.getConfig();

    // 2. Nothing else is open. Two open requests over the same lines is how
    //    a balance gets paid twice.
    const existing = await affiliateStore.listPayoutsFor(partner);
    if (existing.some((p) => p.status === "requested" || p.status === "approved")) {
      return { ok: false, error: "open_payout", status: 409 };
    }

    // 3. The amount, from the ledger. Negative reversal lines are part of
    //    the sum, so a refund reduces the very next request.
    const now = Date.now();
    const lines = await affiliateStore.listCommissions(partner);
    const available = lines.filter((c) => effectiveStatus(c, now) === "available");
    if (available.length === 0) {
      return { ok: false, error: "no_commissions", status: 409, availableCents: 0 };
    }
    const amountCents = payableCents(lines, now);

    // 4. The minimum. A non-positive balance is refused here too — a refund
    //    can leave the available sum at or below zero while lines exist.
    const minCents = effectiveMinCents(aff, cfg);
    if (amountCents <= 0 || amountCents < minCents) {
      return { ok: false, error: "below_minimum", status: 409, availableCents: amountCents, minCents };
    }

    // 5. Somewhere to send it.
    if (!payoutInfoComplete(aff)) {
      return { ok: false, error: "invalid_payout_info", status: 400 };
    }

    // 6. Write the request first, then claim the lines. If the second half
    //    fails the request still exists and the operator can reject it,
    //    which returns every claimed line — the other order would leave
    //    lines pointing at a request nobody can see or cancel.
    const payout: Payout = {
      id: await newPayoutId(),
      affiliateEmail: partner,
      amountCents,
      commissionIds: available.map((c) => c.id),
      status: "requested",
      requestedAt: now,
      decidedAt: null,
      paidAt: null,
      reference: "",
      rejectionReason: null,
      snapshot: {
        accountHolder: aff.accountHolder,
        ibanLast4: aff.ibanLast4,
        address: { ...aff.address },
      },
    };
    await affiliateStore.putPayout(payout);

    // READ-AFTER-WRITE GUARD against a doubled request.
    //
    // Step 2 above is a READ, and two requests milliseconds apart — a
    // double-click, two tabs, a retried fetch — both pass it. Both would then
    // claim the same commission lines, and the operator would see two
    // identical requests for one balance and could pay both. There is no lock
    // to take here: the store is a spreadsheet behind serverless functions.
    //
    // So the request is written FIRST and then checked against the list it is
    // now part of. The older one wins, ties break on the id, and both sides
    // reach the same verdict because the comparison is total — exactly one
    // withdraws, and it withdraws before it has claimed a single line.
    //
    // Not airtight, and deliberately not sold as such: if both reads land
    // before both writes, both survive. That window is a fraction of the one
    // it closes, and the loser leaves a visibly rejected record rather than a
    // silent second claim.
    const others = (await affiliateStore.listPayoutsFor(partner)).filter(
      (p) => p.id !== payout.id && (p.status === "requested" || p.status === "approved"),
    );
    const earlier = others.find(
      (p) =>
        p.requestedAt < payout.requestedAt ||
        (p.requestedAt === payout.requestedAt && p.id < payout.id),
    );
    if (earlier) {
      await affiliateStore.putPayout({
        ...payout,
        status: "rejected",
        decidedAt: Date.now(),
        rejectionReason: "Doppelter Antrag — der frühere Antrag gilt.",
      });
      console.warn(`[affiliate] concurrent payout request withdrawn: ${payout.id} lost to ${earlier.id}`);
      return { ok: false, error: "open_payout", status: 409 };
    }

    for (const c of available) {
      await affiliateStore.putCommission({ ...c, status: "requested", payoutId: payout.id });
    }

    await notifyRequested(aff, cfg, payout, available.length);
    return { ok: true, payout };
  } catch (err) {
    // The partner is told the store is unavailable rather than shown a
    // stack trace, and no half-written request is reported as a success.
    console.error("[affiliate] payout request failed:", err);
    return { ok: false, error: "store_unavailable", status: 503 };
  }
}

async function notifyRequested(
  aff: Affiliate,
  cfg: AffiliateConfig,
  payout: Payout,
  count: number,
): Promise<void> {
  const name = `${aff.firstName} ${aff.lastName}`.trim();
  try {
    await sendPayoutRequestedPartner(aff.email, {
      locale: PARTNER_LOCALE,
      amountCents: payout.amountCents,
      payoutId: payout.id,
      holdDays: cfg.holdDays,
      link: partnerLink(),
    });
  } catch (err) {
    console.error("[affiliate] payout receipt mail failed:", err);
  }
  try {
    await sendPayoutRequestedAdmin({
      affiliateEmail: aff.email,
      name,
      amountCents: payout.amountCents,
      commissionCount: count,
      accountHolder: aff.accountHolder,
      ibanMasked: maskedIban(aff),
      payoutId: payout.id,
      link: adminLink(),
    });
  } catch (err) {
    console.error("[affiliate] payout alert mail failed:", err);
  }
}

/**
 * Move a payout along: approve it, mark it paid, or reject it.
 *
 * Every transition is checked against the current status rather than assumed
 * from the button that was pressed. Two admin tabs open on the same request
 * is an ordinary Tuesday, and the second click must not pay the same lines a
 * second time — it gets a 409 instead.
 */
export async function decidePayout(
  id: string,
  action: "approve" | "paid" | "reject",
  opts: { reference?: string; reason?: string },
): Promise<PayoutResult> {
  const payoutId = (id ?? "").trim();
  if (!payoutId) return { ok: false, error: "not_found", status: 404 };

  try {
    const payout = await affiliateStore.getPayout(payoutId);
    if (!payout) return { ok: false, error: "not_found", status: 404 };

    const now = Date.now();
    const aff = await affiliateStore.getAffiliate(payout.affiliateEmail);

    if (action === "approve") {
      // Approval is a note to the operator ("checked, ready to transfer"),
      // so it only makes sense on a fresh request.
      if (payout.status !== "requested") {
        return { ok: false, error: "bad_state", status: 409 };
      }
      const next: Payout = { ...payout, status: "approved", decidedAt: now };
      await affiliateStore.putPayout(next);
      return { ok: true, payout: next };
    }

    if (payout.status !== "requested" && payout.status !== "approved") {
      return { ok: false, error: "bad_state", status: 409 };
    }

    const lines = await affiliateStore.listCommissions(payout.affiliateEmail);
    const claimed = lines.filter((c) => payout.commissionIds.includes(c.id));

    if (action === "paid") {
      for (const c of claimed) {
        // Only lines that still belong to THIS payout. A line the operator
        // moved by hand, or one that a rejected request already released,
        // must not be dragged into "paid" by an unrelated transfer.
        if (c.status !== "requested" || c.payoutId !== payout.id) continue;
        await affiliateStore.putCommission({ ...c, status: "paid", payoutId: payout.id });
      }

      // The frozen amount, not a fresh sum: this is what was transferred.
      await affiliateStore.bumpSummary(payout.affiliateEmail, { paidCents: payout.amountCents });

      const reference = (opts.reference ?? payout.reference ?? "").trim().slice(0, 140);
      const next: Payout = {
        ...payout,
        status: "paid",
        reference,
        decidedAt: payout.decidedAt ?? now,
        paidAt: now,
      };
      await affiliateStore.putPayout(next);

      if (aff) {
        try {
          await sendPayoutPaid(aff.email, {
            locale: PARTNER_LOCALE,
            amountCents: next.amountCents,
            reference,
            link: partnerLink(),
          });
        } catch (err) {
          console.error("[affiliate] payout paid mail failed:", err);
        }
      }
      return { ok: true, payout: next };
    }

    // reject
    for (const c of claimed) {
      if (c.status !== "requested" || c.payoutId !== payout.id) continue;
      // Back to "pending", not to "available": the stored status only ever
      // holds the written states, and effectiveStatus turns a matured
      // pending line back into an available one on the next read. The lines
      // are long past their hold, so nothing is delayed by this.
      await affiliateStore.putCommission({ ...c, status: "pending", payoutId: null });
    }

    const reason = (opts.reason ?? "").trim().slice(0, 300);
    const next: Payout = {
      ...payout,
      status: "rejected",
      decidedAt: now,
      rejectionReason: reason || null,
    };
    await affiliateStore.putPayout(next);

    if (aff) {
      try {
        await sendPayoutRejected(aff.email, {
          locale: PARTNER_LOCALE,
          amountCents: next.amountCents,
          reason,
          link: partnerLink(),
        });
      } catch (err) {
        console.error("[affiliate] payout rejected mail failed:", err);
      }
    }
    return { ok: true, payout: next };
  } catch (err) {
    console.error("[affiliate] payout decision failed:", err);
    return { ok: false, error: "store_unavailable", status: 503 };
  }
}
