// Display specs for the fifteen dashboard metrics.
//
// WHAT THIS FILE USED TO BE, AND WHY IT CHANGED
// ---------------------------------------------
// It held hand-cut `ideal` bands, a `tol` constant and a `dir` flag per
// metric — 60 numbers, none with a source, which together were the scoring
// model. Scoring now lives in lib/analysis/{norms,modules}.ts and is driven
// by published means and standard deviations.
//
// So this file no longer DEFINES anything. It DERIVES the presentation from
// the norms:
//
//   ideal = reference ± 0.5 SD   the middle ~38% of the population, which
//                                is what a dial can honestly call "typical"
//   scale = mean ± 3 SD          the dial's track, covering ~99.7%
//
// Both follow from the norm, so a dial can no longer disagree with the
// score behind it — the class of bug where the UI said "in range" while the
// scorer applied a penalty.

import { NORMS, type MeasurementId } from "./analysis/norms";
import { referenceOf, scoreMeasurement } from "./analysis/modules";
import type { CategoryId, Metric, MetricId } from "./metrics";

export interface Spec {
  category: CategoryId;
  unit: string;
  ideal: [number, number];
  scale: [number, number];
  fmt: (v: number) => string;
  /**
   * Which way the reference sits relative to the population mean, derived
   * from the norm's documented shift. "band" = scored against the measured
   * mean with no preference at all. Shown in the raw diagnostic view; it no
   * longer affects scoring, which is symmetric in z.
   */
  dir: "up" | "down" | "band";
  /** Plausible draw range for the dev demo generator: mean ± 1.5 SD. */
  demo: [number, number];
}

const deg = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}°`;
const plain = (v: number) => v.toFixed(2);
const times = (v: number) => `${v.toFixed(2)}×`;
const toOne = (v: number) => `${v.toFixed(2)}:1`;
const pct = (v: number) => `${v.toFixed(1)}%`;
const rawDeg = (v: number) => `${v.toFixed(1)}°`;

/** The fifteen metrics the dashboard renders, and how each is written. */
const DISPLAY: Record<MetricId, { category: CategoryId; unit: string; fmt: (v: number) => string }> = {
  canthalTilt: { category: "eyes", unit: "°", fmt: deg },
  esr: { category: "eyes", unit: "", fmt: plain },
  eyeAspect: { category: "eyes", unit: "", fmt: plain },
  browPosition: { category: "eyes", unit: "×", fmt: times },
  gonialAngle: { category: "jaw", unit: "°", fmt: rawDeg },
  jawWidth: { category: "jaw", unit: "", fmt: plain },
  chinRatio: { category: "jaw", unit: ":1", fmt: toOne },
  thirds: { category: "proportions", unit: "%", fmt: pct },
  fifths: { category: "proportions", unit: "×", fmt: times },
  fwhr: { category: "proportions", unit: "", fmt: plain },
  facialIndex: { category: "proportions", unit: "", fmt: plain },
  mouthNose: { category: "midface", unit: "×", fmt: times },
  noseWidth: { category: "midface", unit: "", fmt: plain },
  lipRatio: { category: "midface", unit: ":1", fmt: toOne },
  midface: { category: "midface", unit: "", fmt: plain },
};

function buildSpec(id: MetricId): Spec {
  const norm = NORMS[id as MeasurementId];
  const ref = referenceOf(norm);
  const d = DISPLAY[id];
  return {
    category: d.category,
    unit: d.unit,
    ideal: [ref - 0.5 * norm.sd, ref + 0.5 * norm.sd],
    scale: [norm.mean - 3 * norm.sd, norm.mean + 3 * norm.sd],
    fmt: d.fmt,
    dir: norm.shift > 0 ? "up" : norm.shift < 0 ? "down" : "band",
    demo: [norm.mean - 1.5 * norm.sd, norm.mean + 1.5 * norm.sd],
  };
}

export const SPECS: Record<MetricId, Spec> = Object.fromEntries(
  (Object.keys(DISPLAY) as MetricId[]).map((id) => [id, buildSpec(id)]),
) as Record<MetricId, Spec>;

export const METRIC_ORDER = Object.keys(DISPLAY) as MetricId[];

/**
 * Build a display metric from a raw measurement.
 *
 * The value is NOT rounded before scoring. The previous implementation did
 * `Number(raw.toFixed(2))`, which for noseWidth (SD 0.020) quantised the
 * measurement into steps of half a standard deviation and made the score
 * jitter between two photos of the same face. Rounding now happens only for
 * the display string.
 */
export function makeMetric(id: MetricId, raw: number): Metric {
  const s = SPECS[id];
  const scored = scoreMeasurement(id as MeasurementId, raw);
  return {
    id,
    category: s.category,
    value: raw,
    display: s.fmt(raw),
    unit: s.unit,
    ideal: s.ideal,
    scale: s.scale,
    score: Math.round(scored.score),
    position:
      Math.abs(scored.z) <= 0.5 ? "in" : scored.z > 0 ? "above" : "below",
  };
}
