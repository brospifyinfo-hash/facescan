// Two one-time unlocks. No subscription, no auto-renewal.
//
// Amounts are the same figure in the viewer's own currency (not converted),
// which is standard per-market pricing. Formatting goes through Intl so the
// separator and symbol placement are right per locale.
//
// ⚠️ Whatever is charged at checkout must match what is displayed here. When
// Stripe is wired up, create the Price objects in these same currencies
// rather than converting at charge time.

import type { Locale } from "./i18n/types";

export type PlanId = "standard" | "complete";

export const PLAN_ORDER: PlanId[] = ["standard", "complete"];

export const AMOUNTS: Record<PlanId, number> = {
  standard: 4.95,
  complete: 6.95,
};

/** Features are keyed so the copy lives in the dictionaries. */
export const PLAN_FEATURES: Record<PlanId, string[]> = {
  standard: ["measurements", "categories", "tier", "actionPlan"],
  complete: ["everything", "monthlyProgram", "aiReport", "pdf"],
};

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

export function formatPrice(locale: Locale, plan: PlanId = "standard"): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], {
    style: "currency",
    currency: CURRENCY[locale],
  }).format(AMOUNTS[plan]);
}

export function currencyFor(locale: Locale): string {
  return CURRENCY[locale];
}
