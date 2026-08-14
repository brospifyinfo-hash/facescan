import { NextResponse } from "next/server";
import { currentSession } from "@/lib/auth/session";
import { history, type HistoryInput } from "@/lib/history/store";

export const runtime = "nodejs";

/** The signed-in customer's scans. */
export async function GET() {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ scans: await history.list(session.email) });
}

/**
 * Store one scan result under the customer's address.
 *
 * THE SESSION IS THE GATE, and it decides WHOSE history this is: the address
 * comes from the signed cookie and never from the body, or anyone could write
 * into anyone's history.
 *
 * It used to also require an entitlement, which is why nothing was ever
 * stored — Stripe is not configured in production, so no entitlement can
 * exist, so every save was refused with a 403 that nothing surfaced. Signing
 * in is the meaningful consent here: somebody who created an account and
 * proved an inbox is asking for their results to be kept. A scan by a visitor
 * who never signed in is still never stored, which is the promise that
 * actually matters.
 *
 * The numbers are re-clamped here rather than trusted. They arrive from the
 * client because that is where the analyser runs, so a hand-written request
 * could otherwise put a 9.9 into someone's history.
 */
export async function POST(request: Request) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const num = (v: unknown, max: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(0, v)) : 0;

  const entry: HistoryInput = {
    overall: num(body.overall, 10),
    band: typeof body.band === "string" ? body.band.slice(0, 32) : "",
    symmetry: num(body.symmetry, 100),
    eyesScore: num(body.eyesScore, 100),
    jawScore: num(body.jawScore, 100),
    proportionsScore: num(body.proportionsScore, 100),
    midfaceScore: num(body.midfaceScore, 100),
    source: body.source === "vision" ? "vision" : "geometry",
  };

  return NextResponse.json({ scan: await history.add(session.email, entry) }, { status: 201 });
}
