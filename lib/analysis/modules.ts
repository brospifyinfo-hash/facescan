// Scoring modules: how measurements become category scores.
//
// WHY THIS REPLACES scoreBand()
// -----------------------------
// The old scorer had four hand-chosen constants per metric (band lo, band
// hi, tolerance, direction) plus seven global ones (centre 100, edge 86,
// plateau 0.75, favouredDecay 37, penaltyDecay 74, floor 12, ceiling 100).
// None had a derivation. Worse, `dir: "up"` awarded a flat 100 for any
// deviation up to 0.75 tolerances past the band, so a face with an extreme
// canthal tilt scored higher than one with a normal tilt — which is how
// "manche durchschnittlichen Gesichter bekommen höhere Scores" happened.
//
// The replacement has ONE global constant, TOLERANCE_SD, and everything
// else comes from the published mean and SD in norms.ts:
//
//     z     = (value − reference) / sd
//     score = 100 · exp(−½ (z / TOLERANCE_SD)²)
//
// A Gaussian kernel because it is smooth (no cliffs — the old floor of 12
// meant one bad measurement cost 88 points in a single step), monotone in
// |z| (no local maxima to game), bounded in (0, 100], and has a single
// interpretable parameter.

import type { MeasurementId, Norm } from "./norms";
import { NORMS } from "./norms";

/**
 * Half-width of the scoring kernel, in population SD.
 *
 * The one free parameter in the scoring maths. At 1.75:
 *   z = 1 SD  → 85 points. One SD from the reference is ordinary human
 *               variation — roughly a third of people — and must not read
 *               as a defect.
 *   z = 2 SD  → 60 points.
 *   z = 3 SD  → 23 points. Rarer than 1 in 300.
 *
 * Lowering it makes the product harsher, raising it flattens everyone
 * together. It is a design choice and is documented as one rather than
 * hidden inside fifteen per-metric tolerances.
 */
export const TOLERANCE_SD = 1.75;

/**
 * How far a measurement's source grade is trusted, 0–1.
 *
 * A ratio with a published mean and SD deserves more say than one estimated
 * off a synthetic mesh. This feeds module CONFIDENCE, not the score — a
 * weak source makes a reading less certain, it does not make the face worse.
 */
export const GRADE_CONFIDENCE = {
  anthropometric: 1.0,
  derived: 0.9,
  heuristic: 0.6,
} as const;

export interface MeasurementScore {
  id: MeasurementId;
  value: number;
  /** Distance from the reference in population SD. Signed. */
  z: number;
  score: number;
  /** False when the raw value was implausible and the metric was dropped. */
  used: boolean;
}

/** The reference value a measurement is scored against. */
export function referenceOf(norm: Norm): number {
  return norm.mean + norm.shift * norm.sd;
}

/**
 * Score one measurement against its norm.
 *
 * `oneSided: "lower"` measurements are deviations bounded at zero, where
 * being below the reference is definitionally better and must not cost
 * anything — otherwise a perfectly symmetric face would be penalised for
 * having less asymmetry than average, which is absurd.
 */
export function scoreMeasurement(id: MeasurementId, value: number): MeasurementScore {
  const norm = NORMS[id] as Norm;
  const ref = referenceOf(norm);
  let z = (value - ref) / norm.sd;
  if (norm.oneSided === "lower" && z < 0) z = 0;
  const score = 100 * Math.exp(-0.5 * (z / TOLERANCE_SD) ** 2);
  return { id, value, z, score, used: true };
}

export type ModuleId =
  | "symmetry" | "proportions" | "jaw" | "eyes" | "nose" | "lips"
  | "faceShape" | "skin" | "embedding";

export const MODULE_IDS: ModuleId[] = [
  "symmetry", "proportions", "jaw", "eyes", "nose", "lips",
  "faceShape", "skin", "embedding",
];

/**
 * Which measurements feed which module.
 *
 * `goldenRatio` and `chinProjection` appear in no module on purpose:
 * goldenRatio duplicates facialIndex and would double-count it, and
 * chinProjection has no calibrated scale. Both are still measured and
 * reported — reporting a number and scoring it are different decisions.
 */
export const MODULE_MEASUREMENTS: Record<ModuleId, MeasurementId[]> = {
  symmetry: ["symmetryDeviation"],
  proportions: [
    "thirds", "fifths", "fwhr", "facialIndex", "faceLength",
    "bizygomaticRatio", "lowerThird", "midface",
  ],
  jaw: ["gonialAngle", "jawWidth", "chinRatio", "bigonialRatio"],
  eyes: ["canthalTilt", "esr", "eyeSpacing", "eyeAspect", "browPosition"],
  nose: ["noseWidth", "noseLength"],
  lips: ["lipRatio", "mouthNose", "philtrumRatio"],
  // Supplied by other analyzers, not by geometry.
  faceShape: [],
  skin: [],
  embedding: [],
};

export interface ModuleResult {
  id: ModuleId;
  /** 0–100, or null when the module could not be evaluated. */
  score: number | null;
  /** 0–1. How much this module's score is worth trusting. */
  confidence: number;
  /** Its share of the composite before confidence weighting. */
  weight: number;
  /** Per-measurement detail, for explainability. */
  measurements: MeasurementScore[];
  /** Why the module is unavailable, when score is null. */
  unavailable?: string;
}

/**
 * Evaluate the geometry-driven modules.
 *
 * A measurement flagged implausible is DROPPED rather than scored: an
 * out-of-range value means a landmark failed, and scoring a landmark
 * failure as if it described the face is how a bad crop turns into a bad
 * verdict. Dropping it lowers the module's confidence instead.
 */
export function evaluateGeometryModules(
  values: Record<MeasurementId, number>,
  implausible: MeasurementId[],
  weights: Record<ModuleId, number>,
): Partial<Record<ModuleId, ModuleResult>> {
  const dropped = new Set(implausible);
  const out: Partial<Record<ModuleId, ModuleResult>> = {};

  for (const [moduleId, ids] of Object.entries(MODULE_MEASUREMENTS) as Array<
    [ModuleId, MeasurementId[]]
  >) {
    if (ids.length === 0) continue;

    const measurements: MeasurementScore[] = ids.map((id) =>
      dropped.has(id)
        ? { id, value: values[id], z: NaN, score: NaN, used: false }
        : scoreMeasurement(id, values[id]),
    );

    const used = measurements.filter((m) => m.used);
    if (used.length === 0) {
      out[moduleId] = {
        id: moduleId,
        score: null,
        confidence: 0,
        weight: weights[moduleId],
        measurements,
        unavailable: "every measurement in this module failed its plausible range",
      };
      continue;
    }

    const score = used.reduce((s, m) => s + m.score, 0) / used.length;

    // Confidence: how much of the module survived, times how well sourced
    // the surviving measurements are.
    const coverage = used.length / ids.length;
    const grade =
      used.reduce((s, m) => s + GRADE_CONFIDENCE[NORMS[m.id].grade], 0) / used.length;

    out[moduleId] = {
      id: moduleId,
      score,
      confidence: coverage * grade,
      weight: weights[moduleId],
      measurements,
    };
  }

  return out;
}
