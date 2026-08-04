// Server-side Stripe client and the authoritative price table.
//
// THE PRICE NEVER COMES FROM THE CLIENT. The browser sends a plan id; this
// module decides what that costs. Anything else lets a user open devtools
// and buy the Blueprint for a cent.

import Stripe from "stripe";
import { AMOUNTS, type PlanId } from "@/lib/pricing";

let client: Stripe | null = null;

export function stripe(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    // Pinned so a future SDK bump can't silently change request/response
    // shapes underneath the webhook handler.
    client = new Stripe(key, { apiVersion: "2026-07-29.dahlia" });
  }
  return client;
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/** German consumer VAT. Displayed prices are gross, as EU B2C law requires. */
export const VAT_RATE = 0.19;

export interface PriceBreakdown {
  /** Minor units (cents) — what Stripe is actually charged. */
  amountMinor: number;
  grossMinor: number;
  netMinor: number;
  vatMinor: number;
  currency: "eur" | "usd";
}

/**
 * Break a gross price into net + VAT.
 *
 * ⚠️ Fixed at the German rate. Selling digital services across the EU means
 * the customer's country rate applies under OSS, and the US amount carries
 * no VAT at all. Enable Stripe Tax and read the rate off the calculation
 * before this goes live outside Germany — the arithmetic here is correct,
 * the assumption that everyone is German is not.
 */
export function priceFor(plan: PlanId, currency: "eur" | "usd"): PriceBreakdown {
  const grossMinor = Math.round(AMOUNTS[plan] * 100);
  if (currency === "usd") {
    return { amountMinor: grossMinor, grossMinor, netMinor: grossMinor, vatMinor: 0, currency };
  }
  const netMinor = Math.round(grossMinor / (1 + VAT_RATE));
  return {
    amountMinor: grossMinor,
    grossMinor,
    netMinor,
    vatMinor: grossMinor - netMinor,
    currency,
  };
}

export function isPlanId(value: unknown): value is PlanId {
  return value === "raw" || value === "pro" || value === "blueprint";
}
