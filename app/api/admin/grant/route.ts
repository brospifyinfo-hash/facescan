import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { entitlements } from "@/lib/stripe/entitlements";
import { normalizeEmail, isEmail } from "@/lib/auth/store";
import { PLAN_ORDER, type PlanId } from "@/lib/pricing";

export const runtime = "nodejs";

/**
 * Grant a plan by hand — support cases, comps, the owner's own account.
 *
 * The Stripe webhook stays the only writer for PAID entitlements; this is
 * the deliberate second writer for UNPAID ones, and it marks its grants
 * with an "admin-" payment intent so the receipt trail can always tell the
 * two apart. The rank guard in the store still applies: granting raw to a
 * blueprint customer downgrades nobody.
 */
export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { email?: unknown; plan?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const email = normalizeEmail(typeof body.email === "string" ? body.email : "");
  const plan = body.plan as PlanId;
  if (!isEmail(email) || !PLAN_ORDER.includes(plan)) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  await entitlements.grant(email, {
    plan,
    paymentIntentId: `admin-${Date.now()}`,
    grantedAt: Date.now(),
  });

  return NextResponse.json({ ok: true, email, plan });
}
