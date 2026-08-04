"use client";

// Browser-side Stripe wiring: the publishable-key loader and the Elements
// appearance so Stripe's iframes match the rest of the product instead of
// looking like a bolted-on payment box.

import { loadStripe, type Appearance, type Stripe } from "@stripe/stripe-js";
import type { PlanId } from "@/lib/pricing";

export const VAT_RATE_PERCENT = 19;

export interface Amounts {
  amountMinor: number;
  netMinor: number;
  vatMinor: number;
  currency: string;
}

let promise: Promise<Stripe | null> | null = null;

/** Loaded once per page, never per render. */
export function stripePromise(): Promise<Stripe | null> {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!key) return Promise.resolve(null);
  if (!promise) promise = loadStripe(key);
  return promise;
}

export function isStripeAvailable(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
}

/**
 * Elements appearance.
 *
 * Stripe renders its fields in a cross-origin iframe, so they cannot inherit
 * the page's CSS — every value the form should share has to be restated here.
 * These mirror the app's tokens: zinc-950 surfaces, hairline borders, Inter,
 * and #95BF47 for focus and accents.
 */
export const appearance: Appearance = {
  theme: "night",
  variables: {
    colorPrimary: "#95BF47",
    colorBackground: "#0d0d0f",
    colorText: "#fafafa",
    colorTextSecondary: "#a1a1aa",
    colorTextPlaceholder: "#52525b",
    colorDanger: "#f87171",
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
    fontSizeBase: "14px",
    spacingUnit: "4px",
    borderRadius: "14px",
  },
  rules: {
    ".Input": {
      backgroundColor: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.10)",
      boxShadow: "none",
      padding: "12px 14px",
    },
    ".Input:focus": {
      border: "1px solid rgba(149,191,71,0.6)",
      boxShadow: "0 0 0 3px rgba(149,191,71,0.12)",
    },
    ".Input--invalid": { border: "1px solid rgba(248,113,113,0.6)" },
    ".Label": {
      color: "#a1a1aa",
      fontSize: "11px",
      letterSpacing: "0.02em",
      marginBottom: "6px",
    },
    ".Tab": {
      backgroundColor: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.09)",
      boxShadow: "none",
    },
    ".Tab:hover": { backgroundColor: "rgba(255,255,255,0.05)" },
    ".Tab--selected": {
      backgroundColor: "rgba(149,191,71,0.08)",
      border: "1px solid rgba(149,191,71,0.5)",
      color: "#95BF47",
    },
    ".TabIcon--selected": { fill: "#95BF47" },
    ".Error": { fontSize: "12px" },
  },
};

export interface IntentResponse {
  clientSecret: string;
  amounts: Amounts;
}

export type IntentResult =
  | { ok: true; data: IntentResponse }
  | { ok: false; error: "unauthenticated" | "unconfigured" | "invalid_plan" | "failed" };

export async function createPaymentIntent(
  plan: PlanId,
  currency: "eur" | "usd",
): Promise<IntentResult> {
  try {
    const res = await fetch("/api/stripe/create-payment-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan, currency }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error ?? "failed" };
    return {
      ok: true,
      data: {
        clientSecret: data.clientSecret,
        amounts: {
          amountMinor: data.amountMinor,
          netMinor: data.netMinor,
          vatMinor: data.vatMinor,
          currency: data.currency,
        },
      },
    };
  } catch {
    return { ok: false, error: "failed" };
  }
}
