import { NextResponse } from "next/server";
import { currentSession } from "@/lib/auth/session";
import { entitlements } from "@/lib/stripe/entitlements";
import { isStripeConfigured, stripe } from "@/lib/stripe/server";
import { mayClaim } from "@/lib/stripe/claim";

export const runtime = "nodejs";

/**
 * Grant from a payment the customer can point at, when the webhook did not
 * arrive.
 *
 * WHY THIS EXISTS. The webhook is the normal grantor and stays that way, but
 * it is a PUSH: Stripe has to reach us. If the endpoint is misconfigured, in
 * the wrong mode, temporarily unreachable, or simply slower than the poll
 * window, the customer has paid and the app never finds out. Everything else
 * in the flow is correct and the person is still locked out of what they
 * bought — the worst state this product can be in.
 *
 * This is the same fact, PULLED. The intent is fetched from Stripe by id, and
 * the answer comes from Stripe rather than from the browser.
 *
 * THE INVARIANT HOLDS: THE CLIENT STILL GRANTS ITSELF NOTHING. It supplies an
 * id and nothing else. Three things are then checked against Stripe's own
 * record, and all three must hold:
 *
 *   1. the intent actually succeeded,
 *   2. its metadata names a plan we sell,
 *   3. its metadata names THIS session's address.
 *
 * Without (3) this would be a way to claim somebody else's payment by
 * guessing an id — a far worse bug than the one it fixes.
 */
export async function POST(req: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "unconfigured" }, { status: 501 });
  }

  const session = await currentSession();
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  let body: { paymentIntentId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const id = typeof body.paymentIntentId === "string" ? body.paymentIntentId.trim() : "";
  // Shape check before spending a Stripe round trip on obvious junk.
  if (!/^pi_[A-Za-z0-9_]{8,}$/.test(id)) {
    return NextResponse.json({ error: "invalid_intent" }, { status: 400 });
  }

  try {
    const intent = await stripe().paymentIntents.retrieve(id);

    const verdict = mayClaim(intent, session.email);
    if (!verdict.ok) {
      if (verdict.reason !== "not_paid") {
        console.warn(`[stripe] confirm refused (${verdict.reason})`, intent.id);
      }
      return NextResponse.json(
        { error: verdict.reason },
        { status: verdict.reason === "not_yours" ? 403 : 409 },
      );
    }
    const { plan } = verdict;

    // Both are idempotent — grant keeps the higher tier, recordPayment
    // deduplicates by intent id — so racing the webhook is harmless.
    await entitlements.grant(session.email, {
      plan,
      paymentIntentId: intent.id,
      grantedAt: Date.now(),
    });
    await entitlements.recordPayment(session.email, {
      plan,
      paymentIntentId: intent.id,
      amount: typeof intent.amount === "number" ? intent.amount : null,
      currency: intent.currency ?? null,
      at: Date.now(),
    });

    console.info(`[stripe] confirm granted ${plan} to ${session.email} (${intent.id})`);
    return NextResponse.json({ plan });
  } catch (err) {
    console.error("[stripe] confirm failed:", err);
    return NextResponse.json({ error: "stripe_error" }, { status: 502 });
  }
}
