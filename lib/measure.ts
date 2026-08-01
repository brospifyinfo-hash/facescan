// Pure facial geometry — no MediaPipe import, so this module runs (and is
// testable) in plain Node. `analysis.ts` supplies the landmark array from
// the browser; everything numeric happens here.

import { clamp, toOverall, type CategoryId, type Metric } from "./metrics";
import { makeMetric } from "./specs";

export type Point = { x: number; y: number };

// Canonical MediaPipe FaceMesh indices (478-point topology).
export const P = {
  forehead: 10, glabella: 9, subnasale: 2, menton: 152,
  noseTip: 1, nasion: 168, alarR: 129, alarL: 358,
  zygoR: 234, zygoL: 454, jawR: 172, jawL: 397,
  eyeOuterR: 33, eyeInnerR: 133, eyeInnerL: 362, eyeOuterL: 263,
  lidUpperR: 159, lidLowerR: 145, lidUpperL: 386, lidLowerL: 374,
  browR: 105, browL: 334, mouthR: 61, mouthL: 291,
  lipTop: 0, lipUpperInner: 13, lipLowerInner: 14, lipBottom: 17,
  // Iris centres, present only in the 478-point (refined) model.
  irisR: 468, irisL: 473,
} as const;

const SYMMETRY_PAIRS: Array<[number, number]> = [
  [P.eyeOuterR, P.eyeOuterL],
  [P.eyeInnerR, P.eyeInnerL],
  [P.mouthR, P.mouthL],
  [P.browR, P.browL],
  [P.jawR, P.jawL],
  [P.zygoR, P.zygoL],
  [P.alarR, P.alarL],
];

export const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export const vdist = (a: Point, b: Point) => Math.abs(a.y - b.y);

export function rotate(p: Point, angle: number, origin: Point): Point {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = p.x - origin.x;
  const dy = p.y - origin.y;
  return { x: origin.x + dx * cos - dy * sin, y: origin.y + dx * sin + dy * cos };
}

function angleAt(vertex: Point, a: Point, b: Point) {
  const v1 = { x: a.x - vertex.x, y: a.y - vertex.y };
  const v2 = { x: b.x - vertex.x, y: b.y - vertex.y };
  const cos =
    (v1.x * v2.x + v1.y * v2.y) /
    (Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y) || 1);
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
}

export interface Measured {
  metrics: Metric[];
  symmetry: number;
  eyesScore: number;
  jawScore: number;
  proportionsScore: number;
  midfaceScore: number;
  harmony: number;
  overall: number;
  weakest: Metric["id"][];
  intercanthal: number;
}

/** Composite the per-category and overall scores from a metric set. */
function composite(metrics: Metric[], symmetry: number) {
  const avg = (cat: CategoryId) => {
    const picked = metrics.filter((m) => m.category === cat);
    return Math.round(
      picked.reduce((s, m) => s + m.score, 0) / (picked.length || 1),
    );
  };
  const eyesScore = avg("eyes");
  const jawScore = avg("jaw");
  const proportionsScore = avg("proportions");
  const midfaceScore = avg("midface");
  const harmony = Math.round(
    clamp(
      0.26 * symmetry +
        0.22 * eyesScore +
        0.2 * jawScore +
        0.2 * proportionsScore +
        0.12 * midfaceScore,
      30,
      99,
    ),
  );
  return {
    eyesScore,
    jawScore,
    proportionsScore,
    midfaceScore,
    harmony,
    overall: toOverall(harmony),
    weakest: [...metrics].sort((a, b) => a.score - b.score).slice(0, 3).map((m) => m.id),
  };
}

/**
 * Turn a raw landmark array into the full measurement + score set.
 * `flat` must be in normalized image space (x, y in 0..1).
 */
export function measure(flat: Point[]): Measured {
  // Normalize head roll so vertical/horizontal measurements are comparable.
  const roll = Math.atan2(
    flat[P.eyeInnerL].y - flat[P.eyeInnerR].y,
    flat[P.eyeInnerL].x - flat[P.eyeInnerR].x,
  );
  const origin: Point = {
    x: (flat[P.eyeInnerR].x + flat[P.eyeInnerL].x) / 2,
    y: (flat[P.eyeInnerR].y + flat[P.eyeInnerL].y) / 2,
  };
  const p: Point[] = flat.map((pt) => rotate(pt, -roll, origin));

  const bizygomatic = dist(p[P.zygoR], p[P.zygoL]);
  const bigonial = dist(p[P.jawR], p[P.jawL]);
  const faceHeight = vdist(p[P.forehead], p[P.menton]);
  const intercanthal = dist(p[P.eyeInnerR], p[P.eyeInnerL]);
  const eyeWidth =
    (dist(p[P.eyeOuterR], p[P.eyeInnerR]) + dist(p[P.eyeInnerL], p[P.eyeOuterL])) / 2;
  const eyeHeight =
    (vdist(p[P.lidUpperR], p[P.lidLowerR]) + vdist(p[P.lidUpperL], p[P.lidLowerL])) / 2;
  const noseW = dist(p[P.alarR], p[P.alarL]);
  const mouthWidth = dist(p[P.mouthR], p[P.mouthL]);

  // Interpupillary distance. The published reference values for eye
  // separation and midface ratio are defined PUPIL-to-PUPIL, not
  // canthus-to-canthus — using the intercanthal distance against those
  // bands pinned both metrics to the floor for every real face.
  // Iris centres exist only in the refined 478-point model; fall back to
  // the midpoint of each eye fissure when they are absent.
  const hasIris = Boolean(p[P.irisR] && p[P.irisL]);
  const pupilR = hasIris
    ? p[P.irisR]
    : { x: (p[P.eyeOuterR].x + p[P.eyeInnerR].x) / 2, y: (p[P.eyeOuterR].y + p[P.eyeInnerR].y) / 2 };
  const pupilL = hasIris
    ? p[P.irisL]
    : { x: (p[P.eyeOuterL].x + p[P.eyeInnerL].x) / 2, y: (p[P.eyeOuterL].y + p[P.eyeInnerL].y) / 2 };
  const interpupillary = dist(pupilR, pupilL);

  // Canthal tilt — image y grows downward, so a higher outer corner has the
  // smaller y.
  const tiltOf = (inner: Point, outer: Point) =>
    (Math.atan2(inner.y - outer.y, Math.abs(outer.x - inner.x)) * 180) / Math.PI;
  const canthalTiltDeg =
    (tiltOf(p[P.eyeInnerR], p[P.eyeOuterR]) + tiltOf(p[P.eyeInnerL], p[P.eyeOuterL])) / 2;

  const gonialAngle =
    (angleAt(p[P.jawR], p[P.zygoR], p[P.menton]) +
      angleAt(p[P.jawL], p[P.zygoL], p[P.menton])) / 2;

  const t1 = vdist(p[P.forehead], p[P.glabella]);
  const t2 = vdist(p[P.glabella], p[P.subnasale]);
  const t3 = vdist(p[P.subnasale], p[P.menton]);
  const tAvg = (t1 + t2 + t3) / 3 || 1e-6;
  const thirdsDev =
    ((Math.abs(t1 - tAvg) + Math.abs(t2 - tAvg) + Math.abs(t3 - tAvg)) / 3 / tAvg) * 100;

  const browMidY = (p[P.browR].y + p[P.browL].y) / 2;
  const fwhrHeight = Math.abs(p[P.lipUpperInner].y - browMidY) || 1e-6;
  const browGap =
    (vdist(p[P.browR], p[P.lidUpperR]) + vdist(p[P.browL], p[P.lidUpperL])) / 2;
  const philtrum = vdist(p[P.subnasale], p[P.lipTop]);
  const chinHeight = vdist(p[P.lipBottom], p[P.menton]);
  const upperLip = vdist(p[P.lipTop], p[P.lipUpperInner]);
  const lowerLip = vdist(p[P.lipLowerInner], p[P.lipBottom]);
  const pupilY = (p[P.eyeInnerR].y + p[P.eyeInnerL].y) / 2;

  const metrics: Metric[] = [
    makeMetric("canthalTilt", canthalTiltDeg),
    makeMetric("esr", interpupillary / bizygomatic),
    makeMetric("eyeSpacing", intercanthal / (eyeWidth || 1e-6)),
    makeMetric("eyeAspect", eyeHeight / (eyeWidth || 1e-6)),
    makeMetric("browPosition", browGap / (eyeHeight || 1e-6)),
    makeMetric("gonialAngle", gonialAngle),
    makeMetric("jawWidth", bigonial / bizygomatic),
    makeMetric("chinRatio", chinHeight / (philtrum || 1e-6)),
    makeMetric("thirds", thirdsDev),
    makeMetric("fifths", bizygomatic / (eyeWidth || 1e-6)),
    makeMetric("fwhr", bizygomatic / fwhrHeight),
    makeMetric("facialIndex", faceHeight / bizygomatic),
    makeMetric("mouthNose", mouthWidth / (noseW || 1e-6)),
    makeMetric("noseWidth", noseW / bizygomatic),
    makeMetric("lipRatio", lowerLip / (upperLip || 1e-6)),
    makeMetric("midface", Math.abs(p[P.lipUpperInner].y - pupilY) / (interpupillary || 1e-6)),
  ];

  // Symmetry — mirrored landmark pairs against the facial midline.
  const midX = (p[P.nasion].x + p[P.menton].x) / 2;
  let err = 0;
  for (const [ri, li] of SYMMETRY_PAIRS) {
    const dR = Math.abs(midX - p[ri].x);
    const dL = Math.abs(p[li].x - midX);
    err += (Math.abs(dL - dR) + 0.5 * Math.abs(p[li].y - p[ri].y)) / bizygomatic;
  }
  err /= SYMMETRY_PAIRS.length;
  const symmetry = Math.round(clamp(100 - err * 340, 40, 99));

  return { ...composite(metrics, symmetry), symmetry, metrics, intercanthal };
}
