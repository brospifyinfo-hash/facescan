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

// scoreBand(), Direction, PLATEAU and toOverall lived here. They were the
// band-and-tolerance scorer: eleven hand-chosen constants with no source,
// including a `dir` flag that awarded a flat 100 for any deviation in the
// "flattering" direction — which is how an extreme measurement came to
// outrank a normal one. Scoring is now z-distance against published means
// and SDs; see lib/analysis/norms.ts and lib/analysis/modules.ts.

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
  | "sleep"
  | "smoking"
  | "training";
