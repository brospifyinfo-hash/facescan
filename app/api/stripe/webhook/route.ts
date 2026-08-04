import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { entitlements } from "@/lib/stripe/entitlements";
import { isPlanId, stripe } from "@/lib/stripe/server";

// Node runtime: the signature is computed over the RAW body, and the edge
// runtime's body handling would break that.
export const runtime = "nodejs";

/**
 * Stripe webhook — the only place an entitlement is ever granted.
 *
 * Two things make this tamper-proof:
 *
 * 1. Every request is verified against STRIPE_WEBHOOK_SECRET using the raw
 *    body. Without that check the endpoint is a public "give me the product"
 *    button — anyone can POST a payment_intent.succeeded shape at it.
 * 2. What gets granted comes from the PaymentIntent's own metadata, which
 *    only our server wrote when the intent was created.
 *
 * Replays are expected: Stripe retries until it gets a 2xx, so the event id
 * is recorded and repeats are no-ops.
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[stripe] STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "unconfigured" }, { status: 501 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  // Must be the untouched bytes — parsing first invalidates the signature.
  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(raw, signature, secret);
  } catch (err) {
    // A bad signature is either a misconfigured secret or a forgery attempt.
    console.error("[stripe] signature verification failed:", err);
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  if (await entitlements.hasProcessed(event.id)) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const intent = event.data.object;
        const email = intent.metadata?.email;
        const plan = intent.metadata?.plan;

        if (!email || !isPlanId(plan)) {
          // Nothing to grant, but acknowledge so Stripe stops retrying.
          console.warn("[stripe] succeeded intent without usable metadata", intent.id);
          break;
        }

        await entitlements.grant(email, {
          plan,
          paymentIntentId: intent.id,
          grantedAt: Date.now(),
        });
        console.info(`[stripe] granted ${plan} to ${email} (${intent.id})`);
        break;
      }

      case "payment_intent.payment_failed": {
        const intent = event.data.object;
        console.info(
          `[stripe] payment failed for ${intent.metadata?.email ?? "unknown"}: ` +
            (intent.last_payment_error?.message ?? "no message"),
        );
        break;
      }

      case "charge.refunded": {
        // Refunds are handled manually for now — surfaced so they are not
        // silently ignored while entitlements stay granted.
        console.warn("[stripe] refund received, entitlement NOT revoked automatically:", event.id);
        break;
      }

      default:
        break;
    }

    await entitlements.markProcessed(event.id);
    return NextResponse.json({ received: true });
  } catch (err) {
    // 500 makes Stripe retry, which is what we want for a transient failure.
    console.error("[stripe] handler failed:", err);
    return NextResponse.json({ error: "handler_failed" }, { status: 500 });
  }
}
