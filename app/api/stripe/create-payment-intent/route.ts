import { NextResponse } from "next/server";
import { currentSession } from "@/lib/auth/session";
import { referralMetadataFor } from "@/lib/affiliate/commission";
import { isPlanId, isStripeConfigured, priceFor, stripe } from "@/lib/stripe/server";

export const runtime = "nodejs";

/**
 * Create (or reuse) a PaymentIntent for the signed-in customer.
 *
 * The client sends only a plan id and currency. The amount is looked up
 * server-side — a client-supplied price is the single most common way these
 * endpoints get exploited.
 *
 * Requires a session: the purchase has to attach to a verified address, and
 * that address is what the webhook grants the entitlement to.
 */
export async function POST(req: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "unconfigured" }, { status: 501 });
  }

  const session = await currentSession();
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  let body: { plan?: unknown; currency?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (!isPlanId(body.plan)) {
    return NextResponse.json({ error: "invalid_plan" }, { status: 400 });
  }
  const currency = body.currency === "usd" ? "usd" : "eur";
  const price = priceFor(body.plan, currency);

  // Who gets credited for this sale is decided HERE and frozen into the
  // intent, because the webhook that books the commission arrives without a
  // browser: the referral cookie is long gone by the time Stripe calls back,
  // and after a redirect-based method (Klarna, PayPal) it may be a different
  // device entirely. The metadata is the only carrier that survives.
  //
  // `.catch` on top of a function that already swallows everything is
  // deliberate belt-and-braces: this line sits in the checkout path, and no
  // shape of failure in the partner programme may cost a sale.
  const refMeta = await referralMetadataFor(session.email).catch(() => ({}));

  try {
    const intent = await stripe().paymentIntents.create({
      amount: price.amountMinor,
      currency: price.currency,
      // Lets Stripe surface card, wallets, Klarna, PayPal etc. according to
      // what is enabled in the dashboard and what the buyer can actually use.
      automatic_payment_methods: { enabled: true },
      receipt_email: session.email,
      // The webhook reads these back — it must never trust client input.
      metadata: {
        // Spread first so the four fields below always win. They are what
        // the entitlement is granted from; nothing derived from a partner
        // record may shadow them, however the affiliate code changes later.
        ...refMeta,
        email: session.email,
        plan: body.plan,
        grossMinor: String(price.grossMinor),
        vatMinor: String(price.vatMinor),
      },
    });

    return NextResponse.json({
      clientSecret: intent.client_secret,
      amountMinor: price.amountMinor,
      netMinor: price.netMinor,
      vatMinor: price.vatMinor,
      currency: price.currency,
    });
  } catch (err) {
    console.error("[stripe] createPaymentIntent failed:", err);
    return NextResponse.json({ error: "stripe_error" }, { status: 502 });
  }
}
