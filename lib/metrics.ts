// Metric descriptors + scoring.
//
// Every entry here is computed from the real 478-point landmark mesh. Ideal
// bands come from published facial-anthropometry reference ranges (neoclassical
// canons, Farkas anthropometry, fWHR literature). They are population
// references, not verdicts — the UI says so.

export type CategoryId = "core" | "eyes" | "jaw" | "proportions" | "midface";

export interface Category {
  id: CategoryId;
  emoji: string;
  label: string;
  blurb: string;
}

export const CATEGORIES: Category[] = [
  {
    id: "eyes",
    emoji: "👁️",
    label: "Eye Region",
    blurb: "Tilt, spacing and aperture — the highest-signal area of the face.",
  },
  {
    id: "jaw",
    emoji: "🗿",
    label: "Jaw & Chin",
    blurb: "Lower-third structure. The area most responsive to body fat.",
  },
  {
    id: "proportions",
    emoji: "📐",
    label: "Proportions",
    blurb: "How the face divides vertically and horizontally.",
  },
  {
    id: "midface",
    emoji: "👃",
    label: "Nose & Mouth",
    blurb: "Central-third relationships and lip balance.",
  },
];

export interface Metric {
  id: string;
  emoji: string;
  label: string;
  category: CategoryId;
  /** Raw measured value. */
  value: number;
  /** How the raw value is rendered (e.g. "1.92", "+3.4°", "0.46"). */
  display: string;
  unit: string;
  /** Reference band [lo, hi] in the same units as `value`. */
  ideal: [number, number];
  /** Scale bounds for the meter track. */
  scale: [number, number];
  /** 0–100, 100 = inside the reference band. */
  score: number;
  /** "in" | "below" | "above" relative to the reference band. */
  position: "in" | "below" | "above";
  note: string;
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
 * Sitting inside a canon band on every one of ~16 independent measurements
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
 * A straight `harmony / 10` looks right but isn't: the composite of ~16
 * band-scored measurements realistically lives in roughly [55, 95], so every
 * user would land between 5.5 and 9.5 and the bottom half of the scale would
 * never be used. Spreading that real window across [3.5, 9.5] makes a point
 * of difference actually mean something.
 */
export function toOverall(harmony: number): number {
  const spread = ((harmony - 55) / 40) * 6 + 3.5;
  return Number(clamp(spread, 1, 10).toFixed(1));
}

export const POSITION_LABEL: Record<Metric["position"], string> = {
  in: "In reference range",
  below: "Below reference range",
  above: "Above reference range",
};

// Status encoding always ships icon + label, never colour alone.
export const POSITION_ICON: Record<Metric["position"], string> = {
  in: "✓",
  below: "↓",
  above: "↑",
};
