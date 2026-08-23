import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { decidePayout } from "@/lib/affiliate/payouts";
import { affiliateStore } from "@/lib/affiliate/store";
import type { Payout } from "@/lib/affiliate/model";

export const runtime = "nodejs";

// The payout queue.
//
// THE SYSTEM NEVER MOVES MONEY. Marking a request as paid records that the
// operator made a transfer in their own bank; it does not make one. That is
// why "paid" takes a reference — the line in the bank statement is the proof,
// and this route only keeps the ledger next to it.
//
// EVERY DISPLAYED DETAIL COMES FROM payout.snapshot. The partner may edit
// their name, address and IBAN at any time, including while a request is open.
// The transfer was prepared against the details of the moment it was
// requested, so those are the details this list shows — a payout history that
// silently follows the current record would be unable to answer the one
// question a dispute asks: where did the money actually go?
//
// The full IBAN is deliberately NOT here. It is one deliberate click away at
// /api/admin/affiliate/reveal-iban, so that opening this list does not put
// every partner's bank details through a log or a cache.

type AdminPayoutRow = Payout & { name: string; ibanMasked: string };

function toRow(p: Payout): AdminPayoutRow {
  return {
    ...p,
    name: (p.snapshot?.accountHolder ?? "").trim(),
    ibanMasked: p.snapshot?.ibanLast4 ? `•••• •••• ${p.snapshot.ibanLast4}` : "",
  };
}

const ACTIONS = ["approve", "paid", "reject"] as const;
type Action = (typeof ACTIONS)[number];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const payouts = await affiliateStore.listPayouts();
    return NextResponse.json({
      // Newest first; the open ones are the newest in practice, and the
      // filtering itself belongs in the admin view, not in the data.
      payouts: payouts.sort((a, b) => b.requestedAt - a.requestedAt).map(toRow),
    });
  } catch (err) {
    console.error("[affiliate] admin payout list failed:", err);
    return NextResponse.json({ error: "store_unavailable" }, { status: 503 });
  }
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

  const id = String(body.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "id_required" }, { status: 400 });

  const action = String(body.action ?? "") as Action;
  if (!ACTIONS.includes(action)) {
    return NextResponse.json({ error: "unknown_action" }, { status: 400 });
  }

  const reference = typeof body.reference === "string" ? body.reference : undefined;
  const reason = typeof body.reason === "string" ? body.reason : undefined;

  // decidePayout owns the state machine, the commission lines, the counters
  // and the partner mail. This route only carries its verdict out, status code
  // and all — a second opinion here would be a second place where a payout can
  // be marked paid twice.
  const result = await decidePayout(id, action, { reference, reason });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, payout: toRow(result.payout) });
}
