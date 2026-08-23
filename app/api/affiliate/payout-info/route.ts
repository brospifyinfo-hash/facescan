import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { currentSession } from "@/lib/auth/session";
import { normalizeEmail } from "@/lib/auth/store";
import { updatePayoutInfo } from "@/lib/affiliate/apply";
import { affiliateStore } from "@/lib/affiliate/store";
import { siteOrigin } from "@/lib/affiliate/email";
import { effectiveMinCents } from "@/lib/affiliate/payouts";
import {
  affiliateLink,
  levelFor,
  percentFor,
  type Affiliate,
  type AffiliateConfig,
} from "@/lib/affiliate/model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Changing where the money goes.
//
// The IBAN field is OPTIONAL here, and it has to be: the client is never
// given the stored IBAN, so it cannot send it back. An empty field therefore
// means "leave the account alone", and lib/affiliate/apply.ts treats it that
// way. Everything else is re-validated exactly as on the application, mod-97
// included.
//
// AN OPEN PAYOUT IS NOT AFFECTED. It carries its own snapshot of the details
// it was requested against, so a change here cannot rewrite where a transfer
// that is already being prepared was meant to go. The change itself is
// stamped into `aff.history` — last four digits only — so a dispute months
// later can be answered.

/** Built from the fields stored in the clear; the plaintext is never decrypted here. */
function maskedIban(aff: Affiliate): string {
  const country = (aff.ibanCountry || "").toUpperCase().slice(0, 2);
  const last4 = aff.ibanLast4 || "";
  if (!country && !last4) return "";
  return `${country || "??"}•• •••• ${last4 || "????"}`;
}

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

/** The same shape as `affiliate` in GET /api/affiliate/me. */
async function publicAffiliate(aff: Affiliate, cfg: AffiliateConfig) {
  const link = affiliateLink(siteOrigin(), aff.code);
  const summary = await affiliateStore.getSummary(aff.email);
  const current = levelFor(summary.payingCustomers, cfg, aff.levelOverride);

  return {
    code: aff.code,
    status: aff.status,
    link,
    qrSvg: aff.status === "active" ? await qrFor(link) : null,
    firstName: aff.firstName,
    lastName: aff.lastName,
    address: aff.address,
    accountHolder: aff.accountHolder,
    ibanMasked: maskedIban(aff),
    createdAt: aff.createdAt,
    level: current.level,
    levelLabel: current.label,
    percent: percentFor(aff, cfg, summary.payingCustomers),
    minCents: effectiveMinCents(aff, cfg),
  };
}

export async function PATCH(req: Request) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_input", field: "body" }, { status: 400 });
  }

  // The session names the record. A body-supplied address here would let one
  // partner redirect another partner's payouts to their own bank account.
  const result = await updatePayoutInfo(normalizeEmail(session.email), body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error, field: result.field }, { status: result.status });
  }

  try {
    const cfg = await affiliateStore.getConfig();
    return NextResponse.json({ ok: true, affiliate: await publicAffiliate(result.affiliate, cfg) });
  } catch (err) {
    // The change is stored; only the echo failed. Answering with an error
    // would invite the partner to submit it a second time and add a second
    // entry to their history for a change that already happened.
    console.error("[affiliate] could not render the updated partner record:", err);
    return NextResponse.json({ ok: true, affiliate: null });
  }
}
