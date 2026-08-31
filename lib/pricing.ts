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
// The projection image blueprint advertises is real since the style studio
// shipped (gpt-image-1, /api/style/render kind:"projection") — the warning
// that used to live here is settled.

import type { Locale } from "./i18n/types";

export type PlanId = "raw" | "pro" | "blueprint";

export const PLAN_ORDER: PlanId[] = ["raw", "pro", "blueprint"];

export const AMOUNTS: Record<PlanId, number> = {
  raw: 0.95,
  pro: 3.95,
  blueprint: 11.95,
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
 * DIE DREI STUFEN, WIE DER BETREIBER SIE FESTGELEGT HAT (31.08.2026):
 *
 *   0,95  raw        die Analyse und die Produktempfehlungen
 *   3,95  pro        alles aus raw plus den Glow-Up-Plan (actionPlan)
 *  11,95  blueprint  alles: dazu der Vier-Wochen-Plan, das Frisuren-Studio,
 *                    das Resultat-Bild (projection), die KI-Tiefenanalyse
 *                    und der Export
 *
 * The card copy in the dictionaries has to match this table LINE FOR LINE —
 * they drifted apart once (pro advertised the four-week programme its own
 * flag denied) and a plan card that promises what the gate refuses is a
 * refund waiting to happen.
 */
export const CAPABILITIES = {
  // 0,95 — die Analyse UND die Produktempfehlungen. Die Empfehlungen lagen
  // vorher eine Stufe höher; sie sind jetzt Teil des Einstiegs.
  raw: {
    metrics: true,
    actionPlan: false,
    history: false,
    products: true,
    simulation: false,
    monthly: false,
    hairstyle: false,
    projection: false,
    blueprint: false,
    download: false,
  },
  // 3,95 — alles aus der Basis plus den Glow-Up-Plan. "Glow-Up-Plan" ist in
  // diesem Code actionPlan; der Vier-Wochen-Plan (monthly) ist etwas
  // anderes und bleibt oben.
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
    download: false,
  },
  // 11,95 — alles.
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

/**
 * A bare amount in the viewer's currency.
 *
 * Exists so the checkout can price a DIFFERENCE ("13,00 € more than Pro")
 * with the same separator and symbol as the plan prices next to it. Doing
 * that inline with Intl at the call site is how two formats end up in one
 * sheet.
 */
export function formatAmount(locale: Locale, amount: number): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], {
    style: "currency",
    currency: CURRENCY[locale],
  }).format(amount);
}

/**
 * What upgrading from `plan` to the top tier costs, formatted.
 *
 * ROUNDED BEFORE FORMATTING, deliberately: 18.95 − 5.95 is 13.000000000000002
 * in binary floating point, and Intl would happily render that as 13,00 € —
 * right by luck. Rounding says it on purpose.
 *
 * Returns null when there is nothing to upgrade to, so the caller can drop
 * the row rather than render "0,00 €".
 */
export function upgradeCost(locale: Locale, plan: PlanId): string | null {
  const top = PLAN_ORDER[PLAN_ORDER.length - 1];
  if (plan === top) return null;
  const delta = Math.round((AMOUNTS[top] - AMOUNTS[plan]) * 100) / 100;
  return formatAmount(locale, delta);
}

/**
 * How many capabilities a plan actually unlocks.
 *
 * Counted from CAPABILITIES rather than from the number of bullet points in
 * a dictionary, for two reasons. The bullets are marketing copy and their
 * count is an accident of how the sentences were split — raw and pro both
 * happened to have three, which made the middle tier look like it added
 * nothing. And CAPABILITIES is the table the gate actually enforces, so a
 * number derived from it cannot advertise a door that stays locked.
 *
 * Gives 1 / 4 / 10, which is the shape of the offer.
 */
export function unlockCount(plan: PlanId): number {
  return Object.values(CAPABILITIES[plan]).filter(Boolean).length;
}
