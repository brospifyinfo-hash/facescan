import { NextResponse } from "next/server";
import { currentSession } from "@/lib/auth/session";
import { isAdmin } from "@/lib/admin";
import { entitlements } from "@/lib/stripe/entitlements";

export const runtime = "nodejs";

/**
 * What the signed-in customer owns.
 *
 * The client polls this after confirming payment. Stripe's client-side
 * confirmation resolving is not proof of purchase — the webhook is the
 * authority, and this endpoint reports what the webhook actually granted.
 *
 * It is also fetched on loading /results, so a paying customer who reloads
 * gets their unlock back — the plan otherwise lives only in browser memory.
 *
 * `admin` is a SEPARATE field rather than a fake plan, so the post-payment
 * poll cannot mistake the owner's review cookie for a purchase landing.
 */
export async function GET() {
  const session = await currentSession();
  if (!session) {
    return NextResponse.json({ plan: null }, { status: 401 });
  }
  const ent = await entitlements.get(session.email);
  return NextResponse.json({ plan: ent?.plan ?? null, admin: await isAdmin() });
}
