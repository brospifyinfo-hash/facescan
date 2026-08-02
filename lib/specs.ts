// Single source of truth for every measurement's reference band, display
// scale, decay tolerance, deviation direction and number formatting.
//
// Both the real analyzer and the dev demo build their metrics from this
// table, so the two can never drift apart.
//
// `dir` is what stops the scorer from measuring plain averageness. For most
// ratios both directions away from the band are worse ("band"), but several
// measurements have a direction the aesthetics literature consistently
// prefers, and deviating THAT way must not cost points — otherwise a
// striking face scores below a merely average one. See scoreBand().

import {
  scoreBand,
  type CategoryId,
  type Direction,
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
  dir: Direction;
  fmt: (v: number) => string;
  /** Plausible min/max for the dev demo generator. */
  demo: [number, number];
}

const deg = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}°`;
const plain = (v: number) => v.toFixed(2);
const times = (v: number) => `${v.toFixed(2)}×`;
const toOne = (v: number) => `${v.toFixed(2)}:1`;

export const SPECS: Record<MetricId, Spec> = {
  // More positive tilt is the preferred direction.
  canthalTilt: {
    category: "eyes", unit: "°", ideal: [3, 8], scale: [-8, 16],
    tol: 9, dir: "up", fmt: deg, demo: [-3, 11],
  },
  esr: {
    category: "eyes", unit: "", ideal: [0.42, 0.48], scale: [0.34, 0.56],
    tol: 0.08, dir: "band", fmt: plain, demo: [0.4, 0.5],
  },
  // A larger palpebral aperture is preferred.
  eyeAspect: {
    category: "eyes", unit: "", ideal: [0.28, 0.38], scale: [0.14, 0.52],
    tol: 0.16, dir: "up", fmt: plain, demo: [0.24, 0.42],
  },
  // A lower, more hooded brow is the preferred direction in male aesthetics.
  browPosition: {
    category: "eyes", unit: "×", ideal: [1.4, 2.4], scale: [0.6, 3.6],
    tol: 1.2, dir: "down", fmt: times, demo: [1.0, 2.8],
  },
  // NOT the cephalometric gonial angle (118–130° on an X-ray) — this is the
  // surface contour angle cheek→jaw→chin, which reads ~157° on a canonical
  // face and RISES as the jaw narrows, so more taper means a higher value.
  gonialAngle: {
    category: "jaw", unit: "°", ideal: [150, 164], scale: [130, 190],
    tol: 20, dir: "up", fmt: (v) => `${v.toFixed(1)}°`, demo: [144, 175],
  },
  // Lower ratio = more taper from cheekbone to jaw = preferred.
  jawWidth: {
    category: "jaw", unit: "", ideal: [0.72, 0.84], scale: [0.55, 1.0],
    tol: 0.16, dir: "down", fmt: plain, demo: [0.64, 0.9],
  },
  chinRatio: {
    category: "jaw", unit: ":1", ideal: [1.55, 2.35], scale: [1.0, 3.6],
    tol: 0.9, dir: "band", fmt: toOne, demo: [1.35, 2.8],
  },
  // Deviation from equal thirds; zero is perfect, so only overshoot costs.
  thirds: {
    category: "proportions", unit: "%", ideal: [0, 7], scale: [0, 30],
    tol: 18, dir: "down", fmt: (v) => `${v.toFixed(1)}%`, demo: [1, 14],
  },
  fifths: {
    category: "proportions", unit: "×", ideal: [4.1, 4.85], scale: [3.4, 6.0],
    tol: 1.0, dir: "band", fmt: times, demo: [3.9, 5.1],
  },
  fwhr: {
    category: "proportions", unit: "", ideal: [1.55, 1.9], scale: [1.2, 2.4],
    tol: 0.4, dir: "band", fmt: plain, demo: [1.45, 2.0],
  },
  facialIndex: {
    category: "proportions", unit: "", ideal: [1.26, 1.48], scale: [1.0, 1.8],
    tol: 0.28, dir: "band", fmt: plain, demo: [1.18, 1.55],
  },
  // A wider mouth relative to the nose is the preferred direction.
  mouthNose: {
    category: "midface", unit: "×", ideal: [1.4, 1.65], scale: [1.0, 2.2],
    tol: 0.4, dir: "up", fmt: times, demo: [1.25, 1.85],
  },
  // A narrower nose relative to face width is preferred.
  noseWidth: {
    category: "midface", unit: "", ideal: [0.23, 0.28], scale: [0.15, 0.38],
    tol: 0.08, dir: "down", fmt: plain, demo: [0.19, 0.32],
  },
  // A fuller lower lip is preferred.
  lipRatio: {
    category: "midface", unit: ":1", ideal: [1.05, 1.65], scale: [0.6, 2.6],
    tol: 0.8, dir: "up", fmt: toOne, demo: [0.9, 2.0],
  },
  midface: {
    category: "midface", unit: "", ideal: [0.78, 1.0], scale: [0.6, 1.3],
    tol: 0.25, dir: "band", fmt: plain, demo: [0.72, 1.08],
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
    ...scoreBand(value, s.ideal, s.tol, s.dir),
  };
}
