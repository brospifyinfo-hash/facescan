// Single source of truth for every measurement's reference band, display
// scale, decay tolerance and number formatting.
//
// Both the real analyzer and the dev demo build their metrics from this
// table, so the two can never drift apart — an earlier revision duplicated
// all 16 definitions in two places, which is exactly how reference bands
// end up disagreeing with themselves.

import {
  scoreBand,
  type CategoryId,
  type Metric,
  type MetricId,
} from "./metrics";

export interface Spec {
  category: CategoryId;
  unit: string;
  ideal: [number, number];
  scale: [number, number];
  /** Distance outside the band at which the score bottoms out. */
  tol: number;
  fmt: (v: number) => string;
  /** Plausible min/max for the dev demo generator. */
  demo: [number, number];
}

const deg = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}°`;
const plain = (v: number) => v.toFixed(2);
const times = (v: number) => `${v.toFixed(2)}×`;
const toOne = (v: number) => `${v.toFixed(2)}:1`;

export const SPECS: Record<MetricId, Spec> = {
  canthalTilt: {
    category: "eyes", unit: "°", ideal: [3, 8], scale: [-8, 14],
    tol: 9, fmt: deg, demo: [-3, 9],
  },
  esr: {
    category: "eyes", unit: "", ideal: [0.43, 0.47], scale: [0.34, 0.56],
    tol: 0.08, fmt: plain, demo: [0.4, 0.5],
  },
  eyeSpacing: {
    category: "eyes", unit: "×", ideal: [0.92, 1.08], scale: [0.6, 1.4],
    tol: 0.3, fmt: times, demo: [0.82, 1.15],
  },
  eyeAspect: {
    category: "eyes", unit: "", ideal: [0.28, 0.38], scale: [0.14, 0.52],
    tol: 0.16, fmt: plain, demo: [0.24, 0.4],
  },
  browPosition: {
    category: "eyes", unit: "×", ideal: [1.4, 2.4], scale: [0.6, 3.6],
    tol: 1.2, fmt: times, demo: [1.1, 2.8],
  },
  gonialAngle: {
    category: "jaw", unit: "°", ideal: [118, 130], scale: [100, 150],
    tol: 22, fmt: (v) => `${v.toFixed(1)}°`, demo: [112, 140],
  },
  jawWidth: {
    category: "jaw", unit: "", ideal: [0.74, 0.84], scale: [0.58, 1.0],
    tol: 0.16, fmt: plain, demo: [0.68, 0.9],
  },
  chinRatio: {
    category: "jaw", unit: ":1", ideal: [1.8, 2.4], scale: [1.0, 3.6],
    tol: 0.9, fmt: toOne, demo: [1.4, 2.8],
  },
  thirds: {
    category: "proportions", unit: "%", ideal: [0, 6], scale: [0, 30],
    tol: 18, fmt: (v) => `${v.toFixed(1)}%`, demo: [1, 14],
  },
  fifths: {
    category: "proportions", unit: "×", ideal: [4.6, 5.4], scale: [3.6, 6.6],
    tol: 1.2, fmt: times, demo: [4.2, 5.9],
  },
  fwhr: {
    category: "proportions", unit: "", ideal: [1.75, 2.05], scale: [1.3, 2.6],
    tol: 0.45, fmt: plain, demo: [1.6, 2.2],
  },
  facialIndex: {
    category: "proportions", unit: "", ideal: [1.28, 1.45], scale: [1.0, 1.8],
    tol: 0.28, fmt: plain, demo: [1.18, 1.55],
  },
  mouthNose: {
    category: "midface", unit: "×", ideal: [1.4, 1.65], scale: [1.0, 2.2],
    tol: 0.4, fmt: times, demo: [1.25, 1.8],
  },
  noseWidth: {
    category: "midface", unit: "", ideal: [0.23, 0.28], scale: [0.15, 0.38],
    tol: 0.08, fmt: plain, demo: [0.2, 0.32],
  },
  lipRatio: {
    category: "midface", unit: ":1", ideal: [1.3, 1.9], scale: [0.6, 3.0],
    tol: 0.9, fmt: toOne, demo: [1.0, 2.3],
  },
  midface: {
    category: "midface", unit: "", ideal: [0.95, 1.12], scale: [0.7, 1.5],
    tol: 0.28, fmt: plain, demo: [0.85, 1.25],
  },
};

export const METRIC_ORDER = Object.keys(SPECS) as MetricId[];

export function makeMetric(id: MetricId, raw: number): Metric {
  const s = SPECS[id];
  const value = Number(raw.toFixed(2));
  return {
    id,
    category: s.category,
    value,
    display: s.fmt(value),
    unit: s.unit,
    ideal: s.ideal,
    scale: s.scale,
    ...scoreBand(value, s.ideal, s.tol),
  };
}
