// Three one-time unlocks. No subscription, no auto-renewal.
//
// Amounts are the same figure in the viewer's own currency (not converted),
// which is standard per-market pricing. Formatting goes through Intl so the
// separator and symbol placement are right per locale.
//
// ⚠️ Whatever is charged at checkout must match what is displayed. When
// Stripe is wired up, create Price objects in these same currencies rather
// than converting at charge time.
//
// ⚠️ `blueprint` advertises AI-generated projection images that DO NOT EXIST
// yet — see components/dashboard/GlowUpProjection.tsx. Either ship an image
// model behind it or remove that line before taking real money, because
// advertising an undelivered feature is misleading under EU consumer law.

import type { Locale } from "./i18n/types";

export type PlanId = "raw" | "pro" | "blueprint";

export const PLAN_ORDER: PlanId[] = ["raw", "pro", "blueprint"];

export const AMOUNTS: Record<PlanId, number> = {
  raw: 1.95,
  pro: 5.95,
  blueprint: 18.95,
};

/**
 * How many further scans the purchase includes.
 *
 * A number rather than a capability flag, because "included" is a quantity
 * and the two lower tiers genuinely differ from the top one by amount, not
 * by kind. Enforced server-side against the scan history — a client-side
 * count is a suggestion.
 */
export const SCAN_QUOTA: Record<PlanId, number> = {
  raw: 1,
  pro: 1,
  blueprint: 10,
};

/**
 * Capability flags — the UI asks these, never the plan id directly.
 *
 * `products` is the affiliate recommendation block. It rides with the action
 * plan and above, because the recommendations ARE the action plan pointed at
 * things you can buy: the ranking comes from the same buildPlan() weights, so
 * a tier that cannot see the plan has nothing to hang them on. Expressed here
 * rather than as `plan === "pro"` in the component, so adding a tier later is
 * still a change to this file and nothing else.
 */
export const CAPABILITIES = {
  // 1.95 — the analysis, and nothing else.
  raw: {
    metrics: true,
    actionPlan: false,
    history: false,
    products: false,
    simulation: false,
    monthly: false,
    hairstyle: false,
    projection: false,
    blueprint: false,
    download: false,
  },
  // 5.95 — everything above, plus the product recommendations and the
  // re-scan simulation that plays once the purchase lands.
  pro: {
    metrics: true,
    actionPlan: true,
    history: true,
    products: true,
    simulation: true,
    monthly: false,
    hairstyle: false,
    projection: false,
    blueprint: false,
    download: true,
  },
  // 18.95 — everything.
  blueprint: {
    metrics: true,
    actionPlan: true,
    history: true,
    products: true,
    simulation: true,
    monthly: true,
    hairstyle: true,
    projection: true,
    blueprint: true,
    download: true,
  },
} as const satisfies Record<PlanId, Record<string, boolean>>;

export type Capability = keyof (typeof CAPABILITIES)["raw"];

export function can(plan: PlanId | undefined, capability: Capability): boolean {
  if (!plan) return false;
  return CAPABILITIES[plan][capability];
}

const CURRENCY: Record<Locale, string> = {
  en: "USD",
  de: "EUR",
  es: "EUR",
  fr: "EUR",
};

const INTL_LOCALE: Record<Locale, string> = {
  en: "en-US",
  de: "de-DE",
  es: "es-ES",
  fr: "fr-FR",
};

export function formatPrice(locale: Locale, plan: PlanId = "pro"): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], {
    style: "currency",
    currency: CURRENCY[locale],
  }).format(AMOUNTS[plan]);
}

export function currencyFor(locale: Locale): string {
  return CURRENCY[locale];
}
