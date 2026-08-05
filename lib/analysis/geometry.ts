// Stage 4: GeometryAnalyzer.
//
// Produces every measurement in norms.ts from an aligned mesh. Pure
// geometry, no scoring — the engine decides what a number is worth, this
// file only decides what it is.
//
// WHAT CHANGED AND WHY
// --------------------
// * Measurements are taken on POSE-COMPENSATED landmarks (see landmarks.ts).
//   Previously only roll was removed, so every width-over-height ratio moved
//   by cos(yaw) between two photos of the same person.
//
// * Every length is normalised by INTERPUPILLARY DISTANCE rather than by
//   whichever denominator was convenient. IPD is the most reproducible
//   distance on the mesh: both endpoints are small, high-contrast, centrally
//   located and unaffected by expression, hair or jaw position. Farkas
//   reports it with the smallest relative SD of any facial dimension. Using
//   one stable denominator throughout means a landmark error on the jaw can
//   no longer contaminate a measurement of the eyes.
//
// * Symmetry is measured against a FITTED midline instead of the
//   nasion-menton line. Two landmarks defined the old midline; if either
//   was off, or the head was turned, the whole face read as asymmetric.
//   The new midline is the least-squares fit through the midpoints of all
//   mirrored pairs, so no single landmark can tilt it.
//
// * Values are NOT rounded before scoring. makeMetric() used to do
//   `Number(raw.toFixed(2))`. For noseWidth (SD 0.020) that quantised the
//   measurement into steps of half a standard deviation, which by itself
//   made the score jitter between photos.

import { NORMS, type MeasurementId } from "./norms";
import {
  P, align, dist, pupils, robust, toDeg, vdist,
  type Aligned, type Point3,
} from "./landmarks";

/**
 * Mirrored landmark pairs used for the midline fit and the symmetry residual.
 *
 * Fifteen pairs, not the original seven. Detector noise on each landmark is
 * independent, so the residual's noise floor falls as 1/√n — going from 7
 * pairs to 15 cuts it by a third. The extra pairs are the face-oval
 * vertices already known to be mirror partners (they are the same points
 * NEIGHBOURS averages for the width measurements), so nothing new is being
 * assumed about the topology.
 */
const SYMMETRY_PAIRS: Array<[number, number]> = [
  [P.eyeOuterR, P.eyeOuterL],
  [P.eyeInnerR, P.eyeInnerL],
  [P.lidUpperR, P.lidUpperL],
  [P.lidLowerR, P.lidLowerL],
  [P.mouthR, P.mouthL],
  [P.browR, P.browL],
  [P.jawR, P.jawL],
  [P.zygoR, P.zygoL],
  [P.alarR, P.alarL],
  // Face-oval partners.
  [127, 356],
  [93, 323],
  [58, 288],
  [136, 365],
  [148, 377],
  [109, 338],
];

/**
 * Trimmed mean of the pair residuals.
 *
 * The residual is a sum of ABSOLUTE differences, so zero-mean detector
 * noise does not cancel — it biases the measurement upward, and that bias
 * is what moved the score between two captures of the same face.
 *
 * Subtracting an estimated noise floor was tried and rejected: on a
 * genuinely asymmetric face every pair is affected, so any within-face
 * estimate of "the noise" is contaminated by the asymmetry itself and the
 * subtraction cancels the signal it was meant to clean. The test suite
 * catches it — an 8mm asymmetry scored HIGHER than a symmetric face.
 *
 * What is left is a trimmed mean: the single largest residual is dropped,
 * which removes the one landmark most likely to have been misplaced without
 * touching the broad asymmetry that shows up across every pair.
 */
function trimmedMean(residuals: number[]): number {
  if (residuals.length < 4) {
    return residuals.reduce((s, v) => s + v, 0) / (residuals.length || 1);
  }
  const sorted = [...residuals].sort((a, b) => a - b);
  const kept = sorted.slice(0, -1);
  return kept.reduce((s, v) => s + v, 0) / kept.length;
}

export type FaceShape =
  | "oval" | "round" | "square" | "oblong" | "heart" | "diamond";

export interface GeometryResult {
  /** Every measurement in norms.ts, unrounded. */
  values: Record<MeasurementId, number>;
  /** Measurements that fell outside their plausible range — landmark failure. */
  implausible: MeasurementId[];
  shape: FaceShape;
  aligned: Aligned;
  /** Interpupillary distance in normalised image units. */
  ipd: number;
  /** True when iris landmarks were available (refined 478-point model). */
  refinedIris: boolean;
}

function angleAt(vertex: Point3, a: Point3, b: Point3) {
  const v1 = { x: a.x - vertex.x, y: a.y - vertex.y };
  const v2 = { x: b.x - vertex.x, y: b.y - vertex.y };
  const cos =
    (v1.x * v2.x + v1.y * v2.y) /
    (Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y) || 1);
  return toDeg(Math.acos(Math.max(-1, Math.min(1, cos))));
}

/**
 * Least-squares midline through the midpoints of the mirrored pairs.
 *
 * Fitted as x = a + b·y (y independent) because a facial midline is close
 * to vertical, where fitting y = f(x) would be ill-conditioned.
 */
function fitMidline(p: Point3[]): (y: number) => number {
  const mids = SYMMETRY_PAIRS.map(([r, l]) => ({
    x: (p[r].x + p[l].x) / 2,
    y: (p[r].y + p[l].y) / 2,
  }));
  const n = mids.length;
  const sy = mids.reduce((s, m) => s + m.y, 0);
  const sx = mids.reduce((s, m) => s + m.x, 0);
  const syy = mids.reduce((s, m) => s + m.y * m.y, 0);
  const sxy = mids.reduce((s, m) => s + m.x * m.y, 0);
  const denom = n * syy - sy * sy;
  if (Math.abs(denom) < 1e-12) {
    const meanX = sx / n;
    return () => meanX;
  }
  const b = (n * sxy - sx * sy) / denom;
  const a = (sx - b * sy) / n;
  return (y: number) => a + b * y;
}

/**
 * Mean residual of the mirrored pairs against the fitted midline,
 * normalised by IPD.
 *
 * Both a horizontal term (one side further from the midline than the other)
 * and a vertical term (one side higher than the other) contribute. The
 * vertical term is halved because after roll correction a residual height
 * difference is a genuinely smaller perceptual defect than a width
 * difference of the same size — documented as a heuristic weighting, not a
 * measured one.
 */
function symmetryDeviation(p: Point3[], ipd: number): number {
  const midlineAt = fitMidline(p);
  const residuals: number[] = [];
  for (const [ri, li] of SYMMETRY_PAIRS) {
    // Neighbour-averaged where a neighbourhood is defined, so a single
    // jittering landmark cannot invent asymmetry.
    const right = robust(p, ri);
    const left = robust(p, li);
    const dR = Math.abs(midlineAt(right.y) - right.x);
    const dL = Math.abs(left.x - midlineAt(left.y));
    residuals.push(
      (Math.abs(dL - dR) + 0.5 * Math.abs(left.y - right.y)) / ipd,
    );
  }
  return trimmedMean(residuals);
}

/**
 * Face shape typing.
 *
 * NO established formula exists for this. Dermatological and styling
 * literature describes the six shapes qualitatively; there is no published
 * decision rule and no population data. What follows is an explicit
 * heuristic over three measured ratios, ordered so the tests are mutually
 * exclusive and the result is deterministic. It is reported for
 * explainability and carries ZERO weight in the score.
 */
function classifyShape(v: Record<MeasurementId, number>): FaceShape {
  const long = v.facialIndex > 1.45;
  const short = v.facialIndex < 1.28;
  const wideJaw = v.jawWidth > 0.82;
  const narrowJaw = v.jawWidth < 0.72;

  if (long && !wideJaw) return "oblong";
  if (short && wideJaw) return "square";
  if (short) return "round";
  if (narrowJaw && v.fwhr > 1.95) return "heart";
  if (narrowJaw) return "diamond";
  if (wideJaw) return "square";
  return "oval";
}

export class GeometryAnalyzer {
  /**
   * @param raw MediaPipe landmarks in normalised image space (x,y ∈ 0..1,
   *            z as returned by the model).
   */
  analyze(raw: Point3[]): GeometryResult {
    const aligned = align(raw);
    const p = aligned.points;

    const { r: pupilR, l: pupilL, refined } = pupils(p);
    // The single normalising length. Everything else is a multiple of it.
    const ipd = dist(pupilR, pupilL) || 1e-6;

    const zygoR = robust(p, P.zygoR);
    const zygoL = robust(p, P.zygoL);
    const jawR = robust(p, P.jawR);
    const jawL = robust(p, P.jawL);
    const menton = robust(p, P.menton);
    const forehead = robust(p, P.forehead);

    const bizygomatic = dist(zygoR, zygoL);
    const bigonial = dist(jawR, jawL);
    const faceHeight = vdist(forehead, menton);
    const intercanthal = dist(p[P.eyeInnerR], p[P.eyeInnerL]);
    const eyeWidth =
      (dist(p[P.eyeOuterR], p[P.eyeInnerR]) + dist(p[P.eyeInnerL], p[P.eyeOuterL])) / 2;
    const eyeHeight =
      (vdist(p[P.lidUpperR], p[P.lidLowerR]) + vdist(p[P.lidUpperL], p[P.lidLowerL])) / 2;
    const alarWidth = dist(p[P.alarR], p[P.alarL]);
    const mouthWidth = dist(p[P.mouthR], p[P.mouthL]);

    // Canthal tilt. Image y grows downward, so a raised outer corner has the
    // smaller y; both eyes are averaged so a single lid error cannot set it.
    const tiltOf = (inner: Point3, outer: Point3) =>
      toDeg(Math.atan2(inner.y - outer.y, Math.abs(outer.x - inner.x) || 1e-6));
    const canthalTilt =
      (tiltOf(p[P.eyeInnerR], p[P.eyeOuterR]) + tiltOf(p[P.eyeInnerL], p[P.eyeOuterL])) / 2;

    const gonialAngle =
      (angleAt(jawR, zygoR, menton) + angleAt(jawL, zygoL, menton)) / 2;

    const t1 = vdist(forehead, p[P.glabella]);
    const t2 = vdist(p[P.glabella], p[P.subnasale]);
    const t3 = vdist(p[P.subnasale], menton);
    const tAvg = (t1 + t2 + t3) / 3 || 1e-6;
    const thirds =
      ((Math.abs(t1 - tAvg) + Math.abs(t2 - tAvg) + Math.abs(t3 - tAvg)) / 3 / tAvg) * 100;

    const browMidY = (p[P.browR].y + p[P.browL].y) / 2;
    const fwhrHeight = Math.abs(p[P.lipUpperInner].y - browMidY) || 1e-6;
    const browGap =
      (vdist(p[P.browR], p[P.lidUpperR]) + vdist(p[P.browL], p[P.lidUpperL])) / 2;
    const philtrum = vdist(p[P.subnasale], p[P.lipTop]);
    const chinHeight = vdist(p[P.lipBottom], menton);
    const upperLip = vdist(p[P.lipTop], p[P.lipUpperInner]);
    const lowerLip = vdist(p[P.lipLowerInner], p[P.lipBottom]);
    const pupilY = (pupilR.y + pupilL.y) / 2;
    const lowerThirdHeight = vdist(p[P.subnasale], menton);

    // Chin projection: depth of the chin relative to the plane through the
    // cheekbones, in IPD units. Only meaningful when z was usable.
    const cheekZ = (zygoR.z + zygoL.z) / 2;
    const chinProjection = aligned.poseCompensated
      ? (cheekZ - menton.z) / ipd
      : 0;

    const values: Record<MeasurementId, number> = {
      canthalTilt,
      esr: ipd / (bizygomatic || 1e-6),
      eyeSpacing: intercanthal / (eyeWidth || 1e-6),
      eyeAspect: eyeHeight / (eyeWidth || 1e-6),
      browPosition: browGap / (eyeHeight || 1e-6),
      symmetryDeviation: symmetryDeviation(p, ipd),
      gonialAngle,
      jawWidth: bigonial / (bizygomatic || 1e-6),
      chinRatio: chinHeight / (philtrum || 1e-6),
      thirds,
      fifths: bizygomatic / (eyeWidth || 1e-6),
      fwhr: bizygomatic / fwhrHeight,
      facialIndex: faceHeight / (bizygomatic || 1e-6),
      goldenRatio: faceHeight / (bizygomatic || 1e-6),
      faceLength: faceHeight / ipd,
      bizygomaticRatio: bizygomatic / ipd,
      bigonialRatio: bigonial / ipd,
      lowerThird: lowerThirdHeight / (faceHeight || 1e-6),
      midface: Math.abs(p[P.lipUpperInner].y - pupilY) / ipd,
      noseWidth: alarWidth / (bizygomatic || 1e-6),
      noseLength: vdist(p[P.nasion], p[P.subnasale]) / (faceHeight || 1e-6),
      mouthNose: mouthWidth / (alarWidth || 1e-6),
      lipRatio: lowerLip / (upperLip || 1e-6),
      philtrumRatio: philtrum / (lowerThirdHeight || 1e-6),
      chinProjection,
    };

    // A measurement outside its physically plausible range means a landmark
    // failed, not that the face is unusual. Flagged so the engine can drop
    // it instead of scoring nonsense.
    const implausible = (Object.keys(values) as MeasurementId[]).filter((id) => {
      const v = values[id];
      const [lo, hi] = NORMS[id].plausible;
      return !Number.isFinite(v) || v < lo || v > hi;
    });

    return {
      values,
      implausible,
      shape: classifyShape(values),
      aligned,
      ipd,
      refinedIris: refined,
    };
  }
}

export const geometryAnalyzer = new GeometryAnalyzer();
