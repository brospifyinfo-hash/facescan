import { NextResponse } from "next/server";
import { currentSession } from "@/lib/auth/session";
import { entitlements } from "@/lib/stripe/entitlements";

export const runtime = "nodejs";

/**
 * What the signed-in customer owns.
 *
 * The client polls this after confirming payment. Stripe's client-side
 * confirmation resolving is not proof of purchase — the webhook is the
 * authority, and this endpoint reports what the webhook actually granted.
 */
export async function GET() {
  const session = await currentSession();
  if (!session) {
    return NextResponse.json({ plan: null }, { status: 401 });
  }
  const ent = await entitlements.get(session.email);
  return NextResponse.json({ plan: ent?.plan ?? null });
}
