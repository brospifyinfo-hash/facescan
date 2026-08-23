// The programme's settings: the defaults, and the gate every admin edit passes.
//
// Pure by design — no store access. The store owns reading and writing
// (lib/affiliate/store.ts); this file owns what a valid setting IS. Keeping
// them apart is what lets the validator run in a test script without a
// spreadsheet behind it.
//
// TWO JOBS, DELIBERATELY DIFFERENT
//
//   validateConfig  — for admin input. Strict, refuses the whole object on the
//                     first bad field, and answers in German because its
//                     messages are rendered straight into the admin form.
//                     There is no partial save: half-applied money rules are
//                     worse than a rejected form.
//
//   normalizeConfig — for stored data. Never throws, never rejects. A row that
//                     predates a new field, or that somebody hand-edited in the
//                     spreadsheet, must still produce a usable config, because
//                     the alternative is a checkout that 500s on a settings typo.

import type { AffiliateConfig, LevelNumber, LevelRule } from "@/lib/affiliate/model";

/** The ladder the owner asked for: 20 / 50 / 100 / 250 paying customers. */
export const DEFAULT_LEVELS: LevelRule[] = [
  { level: 1, label: "Starter", minReferrals: 0, percent: 10 },
  { level: 2, label: "Bronze", minReferrals: 20, percent: 15 },
  { level: 3, label: "Silber", minReferrals: 50, percent: 20 },
  { level: 4, label: "Gold", minReferrals: 100, percent: 25 },
  { level: 5, label: "Legende", minReferrals: 250, percent: 30 },
];

export const DEFAULT_TERMS =
  "Provisionen entstehen auf bezahlte Käufe geworbener Kunden. Sie reifen für die " +
  "eingestellte Haltefrist und können danach ab dem Mindestbetrag ausgezahlt werden. " +
  "Stornierte oder erstattete Käufe werden zurückgebucht. Eigenkäufe und Käufe von " +
  "Bestandskunden zählen nicht. Auszahlungen erfolgen manuell auf das angegebene Konto.";

export const DEFAULT_CONFIG: AffiliateConfig = {
  enabled: true,
  joinMode: "open",
  requireApproval: false,
  levels: DEFAULT_LEVELS,
  commissionScope: "lifetime",
  commissionBase: "gross",
  vatPercent: 19,
  cookieDays: 60,
  holdDays: 10,
  payoutMinCents: 2500,
  currency: "eur",
  selfReferralBlocked: true,
  terms: DEFAULT_TERMS,
  updatedAt: 0,
};

const LEVEL_NUMBERS: LevelNumber[] = [1, 2, 3, 4, 5];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** One decimal place, so 12.5 % is allowed and 12.345 % is not. */
function hasAtMostOneDecimal(n: number): boolean {
  return Math.round(n * 10) === Number((n * 10).toFixed(6));
}

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function str(v: unknown, fallback: string): string {
  return typeof v === "string" ? v : fallback;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * Admin input → a config, or a list of reasons why not.
 *
 * The level rules get the strictest treatment because they are the only place
 * where a typo silently changes what everybody earns: five rungs, thresholds
 * strictly increasing, rung 1 always starting at zero (somebody has to be
 * level 1 on their first day).
 */
export function validateConfig(
  input: unknown,
): { ok: true; config: AffiliateConfig } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!isRecord(input)) {
    return { ok: false, errors: ["Die Konfiguration ist kein Objekt."] };
  }

  const joinMode = input.joinMode;
  if (joinMode !== "open" && joinMode !== "code") {
    errors.push('Anmeldung muss "open" oder "code" sein.');
  }

  const scope = input.commissionScope;
  if (scope !== "first" && scope !== "lifetime") {
    errors.push('Provisionsumfang muss "first" oder "lifetime" sein.');
  }

  const base = input.commissionBase;
  if (base !== "gross" && base !== "net") {
    errors.push('Berechnungsbasis muss "gross" oder "net" sein.');
  }

  for (const [key, label, min, max] of [
    ["vatPercent", "MwSt.-Satz", 0, 30],
    ["cookieDays", "Cookie-Laufzeit in Tagen", 1, 365],
    ["holdDays", "Haltefrist in Tagen", 0, 90],
    ["payoutMinCents", "Mindestauszahlung in Cent", 0, 100000],
  ] as const) {
    const value = input[key];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      errors.push(`${label} muss eine Zahl sein.`);
    } else if (value < min || value > max) {
      errors.push(`${label} muss zwischen ${min} und ${max} liegen.`);
    } else if (key !== "vatPercent" && !Number.isInteger(value)) {
      errors.push(`${label} muss eine ganze Zahl sein.`);
    }
  }

  const terms = input.terms;
  if (typeof terms !== "string" || terms.trim().length < 10) {
    errors.push("Die Teilnahmebedingungen dürfen nicht leer sein (mindestens 10 Zeichen).");
  } else if (terms.length > 4000) {
    errors.push("Die Teilnahmebedingungen sind zu lang (maximal 4000 Zeichen).");
  }

  const rawLevels = input.levels;
  const levels: LevelRule[] = [];
  if (!Array.isArray(rawLevels) || rawLevels.length !== 5) {
    errors.push("Es müssen genau 5 Level konfiguriert sein.");
  } else {
    rawLevels.forEach((raw, index) => {
      const expected = LEVEL_NUMBERS[index];
      if (!isRecord(raw)) {
        errors.push(`Level ${expected}: kein gültiger Datensatz.`);
        return;
      }
      if (raw.level !== expected) {
        errors.push(`Level ${expected}: die Level-Nummer muss ${expected} sein.`);
      }
      const label = raw.label;
      if (typeof label !== "string" || label.trim().length === 0) {
        errors.push(`Level ${expected}: der Name darf nicht leer sein.`);
      } else if (label.length > 40) {
        errors.push(`Level ${expected}: der Name ist zu lang (maximal 40 Zeichen).`);
      }

      const minReferrals = raw.minReferrals;
      if (typeof minReferrals !== "number" || !Number.isInteger(minReferrals) || minReferrals < 0) {
        errors.push(`Level ${expected}: die Schwelle muss eine ganze Zahl ab 0 sein.`);
      } else if (index === 0 && minReferrals !== 0) {
        errors.push("Level 1 muss bei 0 geworbenen Kunden beginnen.");
      } else if (minReferrals > 1000000) {
        errors.push(`Level ${expected}: die Schwelle ist unrealistisch hoch.`);
      }

      const percent = raw.percent;
      if (typeof percent !== "number" || !Number.isFinite(percent)) {
        errors.push(`Level ${expected}: die Provision muss eine Zahl sein.`);
      } else if (percent < 0 || percent > 50) {
        errors.push(`Level ${expected}: die Provision muss zwischen 0 und 50 % liegen.`);
      } else if (!hasAtMostOneDecimal(percent)) {
        errors.push(`Level ${expected}: die Provision darf höchstens eine Nachkommastelle haben.`);
      }

      if (
        typeof label === "string" &&
        typeof minReferrals === "number" &&
        typeof percent === "number"
      ) {
        levels.push({
          level: expected,
          label: label.trim(),
          minReferrals,
          percent: Math.round(percent * 10) / 10,
        });
      }
    });

    // Strictly increasing, checked across the whole ladder rather than pairwise
    // in the loop: "Level 3 ab 20, Level 4 ab 20" is the mistake that would let
    // a partner sit on two rungs at once.
    if (levels.length === 5) {
      for (let i = 1; i < levels.length; i += 1) {
        if (levels[i].minReferrals <= levels[i - 1].minReferrals) {
          errors.push(
            `Level ${levels[i].level}: die Schwelle muss größer sein als die von Level ${levels[i - 1].level}.`,
          );
        }
      }
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    config: {
      enabled: bool(input.enabled, true),
      joinMode: joinMode as "open" | "code",
      requireApproval: bool(input.requireApproval, false),
      levels,
      commissionScope: scope as "first" | "lifetime",
      commissionBase: base as "gross" | "net",
      vatPercent: num(input.vatPercent, 19),
      cookieDays: num(input.cookieDays, 60),
      holdDays: num(input.holdDays, 10),
      payoutMinCents: num(input.payoutMinCents, 2500),
      currency: "eur",
      selfReferralBlocked: bool(input.selfReferralBlocked, true),
      terms: (terms as string).trim(),
      updatedAt: Date.now(),
    },
  };
}

/**
 * Stored data → a usable config. Never throws.
 *
 * Every field falls back to its default independently, so a row written before
 * a field existed keeps working. The levels are all-or-nothing: a partially
 * broken ladder is not something to patch up silently, because the patched
 * version would be a rate nobody agreed to.
 */
export function normalizeConfig(raw: unknown): AffiliateConfig {
  if (!isRecord(raw)) return { ...DEFAULT_CONFIG, levels: DEFAULT_LEVELS.map((l) => ({ ...l })) };

  const levels = normalizeLevels(raw.levels);

  return {
    enabled: bool(raw.enabled, DEFAULT_CONFIG.enabled),
    joinMode: raw.joinMode === "code" ? "code" : "open",
    requireApproval: bool(raw.requireApproval, DEFAULT_CONFIG.requireApproval),
    levels,
    commissionScope: raw.commissionScope === "first" ? "first" : "lifetime",
    commissionBase: raw.commissionBase === "net" ? "net" : "gross",
    vatPercent: clamp(num(raw.vatPercent, DEFAULT_CONFIG.vatPercent), 0, 30),
    cookieDays: clamp(Math.round(num(raw.cookieDays, DEFAULT_CONFIG.cookieDays)), 1, 365),
    holdDays: clamp(Math.round(num(raw.holdDays, DEFAULT_CONFIG.holdDays)), 0, 90),
    payoutMinCents: clamp(
      Math.round(num(raw.payoutMinCents, DEFAULT_CONFIG.payoutMinCents)),
      0,
      100000,
    ),
    currency: "eur",
    selfReferralBlocked: bool(raw.selfReferralBlocked, DEFAULT_CONFIG.selfReferralBlocked),
    terms: str(raw.terms, DEFAULT_CONFIG.terms),
    updatedAt: num(raw.updatedAt, 0),
  };
}

function normalizeLevels(raw: unknown): LevelRule[] {
  if (!Array.isArray(raw) || raw.length !== 5) return DEFAULT_LEVELS.map((l) => ({ ...l }));

  const levels: LevelRule[] = [];
  for (let i = 0; i < 5; i += 1) {
    const entry = raw[i];
    const fallback = DEFAULT_LEVELS[i];
    if (!isRecord(entry)) return DEFAULT_LEVELS.map((l) => ({ ...l }));
    const percent = num(entry.percent, fallback.percent);
    const minReferrals = num(entry.minReferrals, fallback.minReferrals);
    levels.push({
      level: LEVEL_NUMBERS[i],
      label: str(entry.label, fallback.label),
      minReferrals: clamp(Math.round(minReferrals), 0, 1000000),
      percent: Math.round(clamp(percent, 0, 50) * 10) / 10,
    });
  }

  // A stored ladder whose thresholds are not increasing cannot be repaired
  // without inventing numbers, so it is discarded wholesale for the defaults —
  // and the admin sees the defaults, which is a visible state, not a silent one.
  for (let i = 1; i < levels.length; i += 1) {
    if (levels[i].minReferrals <= levels[i - 1].minReferrals) {
      return DEFAULT_LEVELS.map((l) => ({ ...l }));
    }
  }
  return levels;
}
