// Single one-time unlock. No subscription, no auto-renewal — and the copy
// says so because it's true.
//
// The amount is 4.95 in the viewer's own currency (not a converted figure),
// which is standard per-market pricing. Formatting goes through Intl so the
// separator and symbol placement are right per locale: "$4.95" for English,
// "4,95 €" for German.
//
// ⚠️ Whatever is charged at checkout must match what is displayed here. When
// Stripe is wired up, create the Price objects in these same currencies
// rather than converting at charge time.

import type { Locale } from "./i18n/types";

export const AMOUNT = 4.95;

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

export function formatPrice(locale: Locale): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], {
    style: "currency",
    currency: CURRENCY[locale],
  }).format(AMOUNT);
}

export function currencyFor(locale: Locale): string {
  return CURRENCY[locale];
}
