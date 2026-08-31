"use client";

// Browser-side Stripe wiring: the publishable-key loader and the Elements
// appearance so Stripe's iframes match the rest of the product instead of
// looking like a bolted-on payment box.

import { loadStripe, type Appearance, type Stripe } from "@stripe/stripe-js";
import type { PlanId } from "@/lib/pricing";
import { alpha, BRAND } from "../theme";

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
 * and the brand accent for focus and accents.
 */
export const appearance: Appearance = {
  theme: "night",
  variables: {
    colorPrimary: BRAND.accent,
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
      // EXPLICIT, not inherited. The card fields render inside Stripe own
      // iframe, where none of this page CSS reaches and the only styling is
      // this object. Relying on the theme to hand the right colour down left
      // the typed digits invisible; naming the colour here cannot be
      // overridden by a theme default.
      color: "#fafafa",
      fontSize: "16px",
    },
    ".Input::placeholder": { color: "#6b7280" },
    ".Input:focus": {
      border: `1px solid ${alpha(BRAND.accent, 0.6)}`,
      boxShadow: `0 0 0 3px ${alpha(BRAND.accent, 0.12)}`,
    },
    ".Input--invalid": { border: "1px solid rgba(248,113,113,0.6)" },
    // AUTOFILL — die gelbe Zeile mit der unsichtbaren Kartennummer.
    //
    // Fuellt Safari oder Chrome die Kartennummer automatisch aus, malen sie
    // den Feldhintergrund in ihrem eigenen Gelb und lassen die Schriftfarbe
    // stehen. Die steht hier auf #fafafa. Weiss auf Gelb ist nicht schlecht
    // lesbar, sondern gar nicht: der Kunde sieht eine leere gelbe Zeile und
    // haelt sie fuer einen Fehler.
    //
    // Diese Felder liegen in Stripes eigenem iframe, den app/globals.css
    // nicht erreicht — die Appearance ist der einzige Weg hinein. Das
    // Gegenstueck fuer unsere eigenen Felder steht dort unter
    // `input:-webkit-autofill`.
    ".Input--webkit-autofill": {
      backgroundColor: "#0d0d0f",
      color: "#fafafa",
    },
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
      backgroundColor: alpha(BRAND.accent, 0.08),
      border: `1px solid ${alpha(BRAND.accent, 0.5)}`,
      color: BRAND.accent,
    },
    ".TabIcon--selected": { fill: BRAND.accent },
    ".Error": { fontSize: "12px" },
  },
};

export interface IntentResponse {
  clientSecret: string;
  amounts: Amounts;
}

export type IntentResult =
  | { ok: true; data: IntentResponse }
  | {
      ok: false;
      error:
        | "unauthenticated"
        | "unconfigured"
        | "invalid_plan"
        // Die Adresse gehoert schon jemandem — Gastkauf ist dafuer gesperrt,
        // siehe die Begruendung in der Route.
        | "account_exists"
        | "invalid_email"
        | "failed";
    };

export async function createPaymentIntent(
  plan: PlanId,
  currency: "eur" | "usd",
  locale: string,
  /** Leer, wenn angemeldet — dann entscheidet die Sitzung. */
  email: string,
): Promise<IntentResult> {
  try {
    const res = await fetch("/api/stripe/create-payment-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan, currency, locale, email }),
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

/**
 * A payment that has been charged but not yet acknowledged.
 *
 * Written the instant confirmPayment resolves, read when the checkout mounts
 * again. It exists because the `charged` latch in PaymentForm lives in React
 * state, and every way out of the sheet — the backdrop, Escape, the X, the
 * "choose a plan" link — unmounts that state. Reopening then asked for a brand
 * new PaymentIntent on a card that had already paid, and the customer could
 * enter it a second time.
 *
 * sessionStorage rather than localStorage: this is about the current tab and
 * the current purchase, and it must not outlive the browser session.
 */
export const IN_FLIGHT_KEY = "facescan.payment.inflight";

export interface InFlightPayment {
  id: string;
  plan: string;
  at: number;
}

/** Ten minutes. Past that, Stripe's own record is the only sensible source. */
const IN_FLIGHT_TTL_MS = 10 * 60 * 1000;

export function readInFlight(): InFlightPayment | null {
  try {
    const raw = sessionStorage.getItem(IN_FLIGHT_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as InFlightPayment;
    if (!value?.id || typeof value.at !== "number") return null;
    if (Date.now() - value.at > IN_FLIGHT_TTL_MS) {
      clearInFlight();
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

export function clearInFlight(): void {
  try {
    sessionStorage.removeItem(IN_FLIGHT_KEY);
  } catch {
    /* nothing to clean up if storage is unavailable */
  }
}
