// Metric descriptors + scoring.
//
// Every entry is computed from the real 478-point landmark mesh. Ideal bands
// come from published facial-anthropometry reference ranges (neoclassical
// canons, Farkas anthropometry, fWHR literature). They are population
// references, not verdicts — the UI says so.
//
// NOTE: no human-readable strings live here. A metric carries an `id`; its
// label and explanation come from the active dictionary (lib/i18n). That is
// what makes the whole dashboard translatable.

export type CategoryId = "eyes" | "jaw" | "proportions" | "midface";

// 15 metrics, not 16: `eyeSpacing` (intercanthal / eye width) measured
// essentially the same thing as `esr` (interpupillary / face width) with a
// weaker reference basis, and 15 fills a 3- or 5-column grid exactly.
export type MetricId =
  | "canthalTilt"
  | "esr"
  | "eyeAspect"
  | "browPosition"
  | "gonialAngle"
  | "jawWidth"
  | "chinRatio"
  | "thirds"
  | "fifths"
  | "fwhr"
  | "facialIndex"
  | "mouthNose"
  | "noseWidth"
  | "lipRatio"
  | "midface";

export const CATEGORY_ORDER: CategoryId[] = [
  "eyes",
  "jaw",
  "proportions",
  "midface",
];

export const CATEGORY_EMOJI: Record<CategoryId, string> = {
  eyes: "👁️",
  jaw: "🗿",
  proportions: "📐",
  midface: "👃",
};

export const METRIC_EMOJI: Record<MetricId, string> = {
  canthalTilt: "👁️",
  esr: "🎯",
  eyeAspect: "🌙",
  browPosition: "🪶",
  gonialAngle: "📐",
  jawWidth: "🔷",
  chinRatio: "🧱",
  thirds: "📊",
  fifths: "🖐️",
  fwhr: "🔶",
  facialIndex: "📏",
  mouthNose: "👄",
  noseWidth: "👃",
  lipRatio: "💋",
  midface: "🎭",
};

export interface Metric {
  id: MetricId;
  category: CategoryId;
  /** Raw measured value. */
  value: number;
  /** Rendered value (e.g. "1.92", "+3.4°", "0.46"). Locale-independent. */
  display: string;
  unit: string;
  /** Reference band [lo, hi] in the same units as `value`. */
  ideal: [number, number];
  /** Scale bounds for the dial track. */
  scale: [number, number];
  /** 0–100, 100 = dead centre of the reference band. */
  score: number;
  position: "in" | "below" | "above";
}

export const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

/**
 * Score a measurement by distance from its reference band.
 *
 * Calibration matters more than it looks. A flat "100 for anything inside
 * the band" plus a shallow outside decay inflates every composite — the
 * dashboard then hands out top marks to almost everyone, which is both
 * useless as feedback and a quiet form of flattery-to-sell. So:
 *
 *   - inside the band: 100 dead-centre, tapering to 86 at the edges
 *   - outside: steep decay, bottoming out at 12
 *
 * Sitting inside a canon band on every one of 16 independent measurements
 * is genuinely rare, so realistic faces land in a realistic spread.
 */
export function scoreBand(
  value: number,
  [lo, hi]: [number, number],
  tolerance: number,
): { score: number; position: Metric["position"] } {
  if (value >= lo && value <= hi) {
    const mid = (lo + hi) / 2;
    const halfWidth = (hi - lo) / 2 || 1e-6;
    const off = Math.min(1, Math.abs(value - mid) / halfWidth);
    return { score: Math.round(100 - off * 14), position: "in" };
  }
  const d = value < lo ? lo - value : value - hi;
  return {
    score: Math.round(clamp(86 - (d / tolerance) * 74, 12, 86)),
    position: value < lo ? "below" : "above",
  };
}

/**
 * Map the 0–100 composite onto the 0–10 headline figure.
 *
 * A straight `harmony / 10` looks right but isn't: the composite of 16
 * band-scored measurements realistically lives in roughly [55, 95], so every
 * user would land between 5.5 and 9.5 and the bottom half of the scale would
 * never be used. Spreading that real window across [3.5, 9.5] makes a point
 * of difference actually mean something.
 */
export function toOverall(harmony: number): number {
  const spread = ((harmony - 55) / 40) * 6 + 3.5;
  return Number(clamp(spread, 1, 10).toFixed(1));
}

// Status encoding always ships icon + label, never colour alone.
export const POSITION_ICON: Record<Metric["position"], string> = {
  in: "✓",
  below: "↓",
  above: "↑",
};

// Seven tiers so the dashboard can show a visual ladder with the user's
// position on it. Ordered low → high; TIER_ORDER drives the rendering.
export type BandId =
  | "developing"
  | "emerging"
  | "reference"
  | "solid"
  | "strong"
  | "exceptional"
  | "elite";

export const TIER_ORDER: BandId[] = [
  "developing",
  "emerging",
  "reference",
  "solid",
  "strong",
  "exceptional",
  "elite",
];

export type PlanId =
  | "bodyFat"
  | "guaSha"
  | "tonguePosture"
  | "retinoid"
  | "spf"
  | "asymmetry"
  | "depuff"
  | "proportions"
  | "hair"
  | "grooming"
  | "sleep";
