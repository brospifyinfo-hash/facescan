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
  pro: 4.95,
  blueprint: 18.95,
};

/** Capability flags — the UI asks these, never the plan id directly. */
export const CAPABILITIES = {
  raw: { metrics: true, actionPlan: false, history: false, blueprint: false },
  pro: { metrics: true, actionPlan: true, history: true, blueprint: false },
  blueprint: { metrics: true, actionPlan: true, history: true, blueprint: true },
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
