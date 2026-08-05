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
import { offsetOf } from "./calibration";

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
 * How much wider the kernel is on a measurement's favoured side.
 *
 * THE REASON THIS EXISTS. A symmetric kernel measures TYPICALITY, and
 * typicality cannot rank attractiveness — it is a mathematical property,
 * not a tuning problem. A lean, tapered face sits far below the population
 * mean on every width measurement. A heavy, soft one sits far above. |z| is
 * the same for both, so both score the same. Measured on real photographs:
 * a face rated 10/10 scored 5.9 and one rated 1/10 scored 5.8.
 *
 * At 1.6 this is now a secondary effect: the reference itself sits at the
 * attractive end of each trait (see norms.ts), so most of the separation
 * comes from where the target is rather than from how the penalty leans.
 * What the asymmetry still does is keep the far side of the target from
 * costing as much as falling short of it — being leaner than the target is
 * a smaller problem than being heavier.
 *
 * There is no plateau and no free ceiling. The previous directional scorer
 * granted a flat 100 for any deviation up to 0.75 tolerances, which let an
 * extreme value outrank a normal one; here the score still falls in both
 * directions, just at different rates. Monotone either way, one constant,
 * and every direction it applies to carries a citation in norms.ts.
 */
export const FAVOURED_RATIO = 3.0;

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

/**
 * The reference value a measurement is scored against.
 *
 * Three terms: the published population mean, the documented literature
 * shift, and the mesh-vs-caliper calibration offset. The third is what
 * stops a definitional difference between "measured with calipers" and
 * "measured between mesh vertices" from being read as a property of the
 * face. It is zero until /calibrate has produced real numbers.
 */
export function referenceOf(norm: Norm, id?: MeasurementId): number {
  const calibration = id ? offsetOf(id) * norm.sd : 0;
  return norm.mean + norm.shift * norm.sd + calibration;
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
  const ref = referenceOf(norm, id);
  let z = (value - ref) / norm.sd;
  if (norm.oneSided === "lower" && z < 0) z = 0;

  // Asymmetric kernel: wider on the side the rating literature favours.
  const favoured =
    (norm.direction === "up" && z > 0) || (norm.direction === "down" && z < 0);
  const kappa = TOLERANCE_SD * (favoured ? FAVOURED_RATIO : 1);

  const score = 100 * Math.exp(-0.5 * (z / kappa) ** 2);
  return { id, value, z, score, used: true };
}

/**
 * Recover the mean SD-distance that produced a composite.
 *
 * The composite is a mean of `100·exp(−½(z/κ)²)`, so inverting the kernel
 * gives the z that a single measurement would need to produce that value —
 * an interpretable "this face sits N standard deviations from the reference
 * proportions, on average".
 *
 * This is the anchor the headline uses, and it replaces anchoring on a
 * simulated population percentile. The reason is a defect that made the
 * product useless: the population was simulated from the SAME norms that do
 * the scoring, so it could only ever contain faces that already conform.
 * Real measurements carry a systematic offset from caliper anthropometry,
 * landed below the modelled 1st percentile, and every single one of them —
 * from any face — was clamped to the same floor. The score carried no
 * information at all.
 *
 * SD-distance has no such floor. It is defined for any input, degrades
 * smoothly, and preserves ordering even while the norms' absolute
 * calibration is still wrong.
 */
export function meanAbsZFromComposite(composite: number): number {
  const c = Math.max(1e-6, Math.min(100, composite));
  return TOLERANCE_SD * Math.sqrt(Math.max(0, -2 * Math.log(c / 100)));
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
 * ONLY MEASUREMENTS THAT CARRY A DIRECTION ARE SCORED. A measurement with
 * no defensible direction cannot say whether a face is more or less
 * attractive — it can only say how unusual the face is. Averaging nine such
 * measurements in alongside the sixteen that do carry direction diluted the
 * signal by more than a third and was a large part of why two very
 * different faces landed within 0.1 of each other.
 *
 * The directionless ones (esr, eyeSpacing, fifths, lowerThird, noseLength,
 * chinRatio, browPosition, goldenRatio, chinProjection) are still measured
 * and still reported in full. Reporting a number and scoring it are
 * different decisions, and the raw view shows all of them.
 */
export const MODULE_MEASUREMENTS: Record<ModuleId, MeasurementId[]> = {
  symmetry: ["symmetryDeviation"],
  proportions: [
    "thirds", "fwhr", "facialIndex", "faceLength", "bizygomaticRatio", "midface",
  ],
  jaw: ["gonialAngle", "jawWidth", "bigonialRatio"],
  eyes: ["canthalTilt", "eyeAspect"],
  nose: ["noseWidth"],
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
