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
  // NOT the cephalometric gonial angle (118–130° on an X-ray) — this is the
  // surface contour angle cheek→jaw→chin, which reads ~157° on a canonical
  // face. Band centred on what the proxy actually measures.
  gonialAngle: {
    category: "jaw", unit: "°", ideal: [150, 164], scale: [130, 185],
    tol: 20, fmt: (v) => `${v.toFixed(1)}°`, demo: [144, 172],
  },
  jawWidth: {
    category: "jaw", unit: "", ideal: [0.74, 0.84], scale: [0.58, 1.0],
    tol: 0.16, fmt: plain, demo: [0.68, 0.9],
  },
  chinRatio: {
    category: "jaw", unit: ":1", ideal: [1.65, 2.35], scale: [1.0, 3.6],
    tol: 0.9, fmt: toOne, demo: [1.4, 2.8],
  },
  thirds: {
    category: "proportions", unit: "%", ideal: [0, 6], scale: [0, 30],
    tol: 18, fmt: (v) => `${v.toFixed(1)}%`, demo: [1, 14],
  },
  // The "five equal fifths" canon is an idealisation: a real average face is
  // ~4.4 eye-widths wide, not 5. Band brackets the anthropometric mean.
  fifths: {
    category: "proportions", unit: "×", ideal: [4.15, 4.75], scale: [3.4, 6.0],
    tol: 1.0, fmt: times, demo: [3.9, 5.1],
  },
  // Measured against the mid-brow landmark, which sits higher than the brow
  // line used in the fWHR literature — hence a lower band than the published
  // 1.9 mean.
  fwhr: {
    category: "proportions", unit: "", ideal: [1.58, 1.86], scale: [1.2, 2.4],
    tol: 0.4, fmt: plain, demo: [1.45, 2.0],
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
  // 1.6:1 is the aesthetic ideal; the anatomical mean is nearer 1.25.
  lipRatio: {
    category: "midface", unit: ":1", ideal: [1.05, 1.65], scale: [0.6, 2.6],
    tol: 0.8, fmt: toOne, demo: [0.9, 2.0],
  },
  midface: {
    category: "midface", unit: "", ideal: [0.8, 0.98], scale: [0.6, 1.3],
    tol: 0.25, fmt: plain, demo: [0.72, 1.08],
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
