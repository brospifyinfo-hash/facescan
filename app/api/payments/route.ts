import { NextResponse } from "next/server";
import { currentSession } from "@/lib/auth/session";
import { entitlements } from "@/lib/stripe/entitlements";

export const runtime = "nodejs";

/** The signed-in customer's receipts, and what they currently own. */
export async function GET() {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [payments, entitlement] = await Promise.all([
    entitlements.payments(session.email),
    entitlements.get(session.email),
  ]);

  return NextResponse.json({
    email: session.email,
    plan: entitlement?.plan ?? null,
    payments,
  });
}
