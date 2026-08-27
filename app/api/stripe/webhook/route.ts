import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { bookCommission, reverseCommission } from "@/lib/affiliate/commission";
import { entitlements } from "@/lib/stripe/entitlements";
import { sendPurchaseReceipt } from "@/lib/stripe/receipt";
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
/**
 * The signing secrets, comma-separated.
 *
 * ONE VARIABLE, POSSIBLY SEVERAL SECRETS. A signing secret belongs to exactly
 * one endpoint, so anyone running more than one — test mode beside live, or a
 * second URL during a migration — has more than one secret and only one place
 * to put it. With a single value the other endpoint's deliveries all fail
 * signature verification, which looks identical to an attack in the logs and
 * identical to "nothing happened" to the customer.
 *
 * It is also how Stripe's own documented secret ROTATION works: add the new
 * secret, wait for the old endpoint to drain, remove the old one.
 *
 * Empty entries are dropped so a trailing comma cannot produce a secret of ""
 * — which would otherwise be handed to constructEvent as a real candidate.
 */
function signingSecrets(): string[] {
  return (process.env.STRIPE_WEBHOOK_SECRET ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export async function POST(req: Request) {
  const secrets = signingSecrets();
  if (secrets.length === 0) {
    console.error("[stripe] STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "unconfigured" }, { status: 501 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  // Must be the untouched bytes — parsing first invalidates the signature.
  const raw = await req.text();

  // Try each secret and take the first that verifies. Every one has to fail
  // before the request is refused — returning early on the first mismatch
  // would make a second configured endpoint useless.
  let event: Stripe.Event | null = null;
  let lastError: unknown = null;
  for (const secret of secrets) {
    try {
      event = stripe().webhooks.constructEvent(raw, signature, secret);
      break;
    } catch (err) {
      lastError = err;
    }
  }

  if (!event) {
    // A bad signature is either a misconfigured secret or a forgery attempt.
    console.error(
      `[stripe] signature verification failed against ${secrets.length} secret(s):`,
      lastError,
    );
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

        // Together, not in sequence: two spreadsheet round trips that do
        // not depend on each other. Stripe times its webhook deliveries out,
        // so halving the work here is also what keeps a slow spreadsheet
        // from turning into a retried delivery.
        await Promise.all([
          entitlements.grant(email, {
            plan,
            paymentIntentId: intent.id,
            grantedAt: Date.now(),
          }),
          // The receipt line. Separate from the grant because an upgrade
          // overwrites what you own but must never overwrite what you paid.
          entitlements.recordPayment(email, {
            plan,
            paymentIntentId: intent.id,
            amount: typeof intent.amount === "number" ? intent.amount : null,
            currency: intent.currency ?? null,
            at: Date.now(),
          }),
        ]);
        console.info(`[stripe] granted ${plan} to ${email} (${intent.id})`);

        // Der Beleg. Nach der Freischaltung, weil der Kunde auf sein Produkt
        // wartet und nicht auf seine Quittung — und ausserhalb des
        // Promise.all oben aus demselben Grund. sendPurchaseReceipt faengt
        // jeden Fehler selbst ab: eine Ausnahme hier wuerde mit 500
        // beantwortet, Stripe wuerde erneut zustellen, und die
        // Freischaltung liefe ein zweites Mal — wegen einer E-Mail.
        await sendPurchaseReceipt({
          email,
          plan,
          amountMinor: typeof intent.amount === "number" ? intent.amount : null,
          currency: intent.currency ?? null,
          paymentIntentId: intent.id,
          locale: intent.metadata?.locale ?? null,
        });

        // AFTER the grant, and deliberately not inside the Promise.all above.
        // The customer is waiting on their product, not on a partner's
        // commission line, so the two round trips that actually deliver it
        // must not be slowed down by a third that only moves money between
        // our own books. bookCommission swallows every error itself — it may
        // never throw here, because a throw would be answered with a 500,
        // Stripe would redeliver, and the entitlement would be reprocessed.
        await bookCommission({
          id: intent.id,
          amount: intent.amount ?? null,
          currency: intent.currency ?? null,
          metadata: intent.metadata ?? {},
        });
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

        // The commission, however, is reversed automatically: unlike an
        // entitlement it is a claim on our bank account, and paying it out
        // on money we have handed back is a loss no manual review catches
        // reliably.
        //
        // `payment_intent` arrives either as an id or, when the charge was
        // fetched with an expansion, as the whole object — both shapes are
        // normal, so both are unwrapped rather than assumed.
        const charge = event.data.object;
        const pi = charge.payment_intent;
        const piId = typeof pi === "string" ? pi : (pi?.id ?? "");
        if (piId) {
          // WITH THE AMOUNTS, because this event fires for a partial refund
          // too — five euros of goodwill on a nineteen euro sale arrives here
          // as the same `charge.refunded`. Without them every refund cancelled
          // the whole commission, which took the partner's entire share for a
          // fraction of the money. `amount_refunded` is cumulative, so a second
          // partial refund corrects the same line rather than stacking onto it.
          await reverseCommission(piId, "refund", {
            refundedCents: charge.amount_refunded ?? charge.amount ?? 0,
            chargedCents: charge.amount ?? 0,
          });
        }
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
