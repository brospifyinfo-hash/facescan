import { NextResponse } from "next/server";
import { currentSession } from "@/lib/auth/session";
import { normalizeEmail } from "@/lib/auth/store";
import { requestPayout } from "@/lib/affiliate/payouts";
import type { Payout } from "@/lib/affiliate/model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Claiming the balance.
//
// Six checks decide this, all of them in lib/affiliate/payouts.ts, all of
// them server-side: the partner exists and is active, nothing else is open,
// the amount is summed from the ledger rather than the counter cache, it
// clears the minimum, the payout details are complete, and only then is the
// request written and the lines claimed.
//
// The route adds one thing: the identity. A payout request that took its
// address from the body would be a button that pays out somebody else's
// balance.
//
// `availableCents` and `minCents` are passed through on a refusal because
// "you are 7,40 € short of 25,00 €" is a sentence the partner can act on,
// and "no" is not.

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

export async function POST() {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const result = await requestPayout(normalizeEmail(session.email));
  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
        availableCents: result.availableCents,
        minCents: result.minCents,
      },
      { status: result.status },
    );
  }

  return NextResponse.json({ ok: true, payout: publicPayout(result.payout) });
}
