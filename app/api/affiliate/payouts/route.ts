import { NextResponse } from "next/server";
import { currentSession } from "@/lib/auth/session";
import { normalizeEmail } from "@/lib/auth/store";
import { affiliateStore } from "@/lib/affiliate/store";
import type { Payout } from "@/lib/affiliate/model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The partner's own payout history.
//
// Scoped by the session, newest first. The stored payout also holds a
// snapshot of the address and the last four IBAN digits it was requested
// against — that snapshot is for the operator's audit trail and is NOT
// echoed here: the partner already knows their own bank details, and every
// field left out of a response is a field a stolen session cookie cannot
// collect.

function publicPayout(p: Payout) {
  return {
    id: p.id,
    amountCents: p.amountCents,
    status: p.status,
    requestedAt: p.requestedAt,
    paidAt: p.paidAt,
    reference: p.reference,
    rejectionReason: p.rejectionReason,
    /** How many commission lines this request covers. */
    count: p.commissionIds.length,
  };
}

export async function GET() {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  try {
    const payouts = await affiliateStore.listPayoutsFor(normalizeEmail(session.email));
    return NextResponse.json({
      payouts: [...payouts].sort((a, b) => b.requestedAt - a.requestedAt).map(publicPayout),
    });
  } catch (err) {
    console.error("[affiliate] loading the payout history failed:", err);
    return NextResponse.json({ error: "store_unavailable" }, { status: 503 });
  }
}
