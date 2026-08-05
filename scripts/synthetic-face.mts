// Parametric face mesh generator for the test suite.
//
// Builds the landmarks the analyzer actually reads, from anthropometric
// millimetre dimensions, with a curved depth profile so pose estimation has
// something real to work on. Then it can rotate the head in 3D and project
// it back — which is exactly the distortion the pipeline is supposed to
// undo, so the tests measure the correction rather than assuming it.
//
// This is a TEST FIXTURE, not a model of anything. It exists to answer
// "does the same face score the same from a different angle", which needs a
// known ground truth that no real photograph can provide.

import { P, type Point3 } from "../lib/analysis/landmarks";

export interface FaceParams {
  /** Millimetre dimensions. Defaults are Farkas male young-adult means. */
  bizygomatic: number;
  bigonial: number;
  faceHeight: number;
  ipd: number;
  eyeFissureWidth: number;
  eyeFissureHeight: number;
  intercanthal: number;
  browToLid: number;
  alarWidth: number;
  noseLength: number;
  mouthWidth: number;
  philtrum: number;
  upperVermillion: number;
  lowerVermillion: number;
  chinHeight: number;
  canthalTiltDeg: number;
  /**
   * Asymmetry, mm. The left half is WIDENED away from the midline and its
   * eye and mouth corner are dropped slightly.
   *
   * Translating the whole left side instead would produce no asymmetry at
   * all: a uniform shift moves every pair's midpoint by half as much, the
   * fitted midline follows it, and the residuals cancel exactly. That is
   * correct behaviour — a shifted face is a framing difference, not an
   * asymmetric one — and it is why this fixture scales rather than shifts.
   */
  asymmetryMm: number;
  /** Depth of the face relative to its width. */
  depthRatio: number;
}

export const MALE: FaceParams = {
  bizygomatic: 137, bigonial: 106, faceHeight: 187, ipd: 62.3,
  eyeFissureWidth: 31.3, eyeFissureHeight: 10.5, intercanthal: 32.5,
  browToLid: 20, alarWidth: 34, noseLength: 52.5, mouthWidth: 51,
  philtrum: 16, upperVermillion: 8.5, lowerVermillion: 9.4, chinHeight: 30,
  canthalTiltDeg: 4.1, asymmetryMm: 0, depthRatio: 0.62,
};

export const FEMALE: FaceParams = {
  ...MALE,
  bizygomatic: 129, bigonial: 97, faceHeight: 175, ipd: 60.8,
  eyeFissureHeight: 11.0, alarWidth: 31, noseLength: 48.5, mouthWidth: 47,
  chinHeight: 27, canthalTiltDeg: 5.4,
};

/**
 * Age adjustment, applied multiplicatively.
 *
 * Directions follow the ageing literature (Farkas' age series): the lower
 * third lengthens, the eye fissure narrows, the vermillion thins and the
 * canthal tilt drops. Magnitudes are approximations — this is a fixture,
 * and the test only requires that ageing moves the mesh in a realistic
 * direction, not that it does so by an exact amount.
 */
export function atAge(base: FaceParams, age: number): FaceParams {
  const t = (age - 25) / 40; // 0 at 25, 1 at 65
  return {
    ...base,
    faceHeight: base.faceHeight * (1 + 0.03 * t),
    chinHeight: base.chinHeight * (1 + 0.06 * t),
    eyeFissureHeight: base.eyeFissureHeight * (1 - 0.14 * t),
    upperVermillion: base.upperVermillion * (1 - 0.18 * t),
    lowerVermillion: base.lowerVermillion * (1 - 0.14 * t),
    canthalTiltDeg: base.canthalTiltDeg - 2.4 * t,
    bigonial: base.bigonial * (1 + 0.02 * t),
  };
}

const TOTAL_POINTS = 478;

/** Build the mesh in normalised image space with a curved depth profile. */
export function buildFace(params: FaceParams): Point3[] {
  const p = params;
  // Millimetres → normalised units: put the face at a plausible framing.
  const s = 0.52 / p.bizygomatic;
  const mm = (v: number) => v * s;

  const cx = 0.5;
  const top = 0.12;
  const yMenton = top + mm(p.faceHeight);
  const yPupil = top + mm(p.faceHeight * 0.46);
  const ySubnasale = yPupil + mm(p.noseLength * 0.72);
  const yGlabella = top + mm(p.faceHeight / 3);
  const yLipTop = ySubnasale + mm(p.philtrum);
  const yLipUpperInner = yLipTop + mm(p.upperVermillion);
  const yLipLowerInner = yLipUpperInner + mm(1.5);
  const yLipBottom = yLipLowerInner + mm(p.lowerVermillion);
  const yCheek = yPupil + mm(p.faceHeight * 0.10);
  const yJaw = yMenton - mm(p.faceHeight * 0.19);

  // Asymmetry: the left half is scaled away from the midline, and its eye
  // and mouth corner drop slightly. Both are genuine asymmetries; a plain
  // translation would cancel against the fitted midline.
  const asymK = p.asymmetryMm / p.bizygomatic;
  const asymDrop = mm(p.asymmetryMm * 0.35);
  const L = (offsetMm: number) => mm(offsetMm) * (1 + asymK);

  // Depth: an ellipsoid over the face, so points near the midline sit
  // forward and the cheeks fall away. Gives estimatePose() a real signal.
  const halfW = mm(p.bizygomatic) / 2;
  const halfH = mm(p.faceHeight) / 2;
  const maxDepth = halfW * 2 * p.depthRatio;
  const depthAt = (x: number, y: number) => {
    const u = (x - cx) / halfW;
    const v = (y - (top + halfH)) / halfH;
    const r = Math.min(1, u * u + v * v);
    return -maxDepth * Math.sqrt(1 - r);
  };
  const at = (x: number, y: number, extra = 0): Point3 => ({
    x, y, z: depthAt(x, y) + extra,
  });

  const pts: Point3[] = Array.from({ length: TOTAL_POINTS }, () =>
    at(cx, top + halfH),
  );
  const set = (i: number, x: number, y: number, extra = 0) => {
    pts[i] = at(x, y, extra);
  };

  const halfIpd = mm(p.ipd) / 2;
  const halfInter = mm(p.intercanthal) / 2;
  const fissure = mm(p.eyeFissureWidth);
  const tilt = Math.tan((p.canthalTiltDeg * Math.PI) / 180);

  // Face oval
  set(P.forehead, cx, top);
  set(P.glabella, cx, yGlabella);
  set(P.menton, cx, yMenton);
  set(P.zygoR, cx - halfW, yCheek);
  set(P.zygoL, cx + halfW * (1 + asymK), yCheek);
  set(P.jawR, cx - mm(p.bigonial) / 2, yJaw);
  set(P.jawL, cx + L(p.bigonial / 2), yJaw);
  // Oval neighbours the robust() accessor averages in.
  set(127, cx - halfW * 0.99, yCheek - mm(6));
  set(93, cx - halfW * 0.97, yCheek + mm(6));
  set(356, cx + halfW * 0.99 * (1 + asymK), yCheek - mm(6));
  set(323, cx + halfW * 0.97 * (1 + asymK), yCheek + mm(6));
  set(58, cx - mm(p.bigonial) / 2 * 1.02, yJaw - mm(6));
  set(136, cx - mm(p.bigonial) / 2 * 0.98, yJaw + mm(6));
  set(288, cx + L(p.bigonial / 2) * 1.02, yJaw - mm(6));
  set(365, cx + L(p.bigonial / 2) * 0.98, yJaw + mm(6));
  set(148, cx - mm(8), yMenton - mm(2));
  set(377, cx + mm(8), yMenton - mm(2));
  set(109, cx - mm(14), top + mm(3));
  set(338, cx + mm(14), top + mm(3));

  // Eyes — inner canthi sit lower than outer when the tilt is positive.
  const yInner = yPupil + (fissure / 2) * tilt;
  const yOuter = yPupil - (fissure / 2) * tilt;
  set(P.eyeInnerR, cx - halfInter, yInner);
  set(P.eyeInnerL, cx + halfInter * (1 + asymK), yInner + asymDrop);
  set(P.eyeOuterR, cx - halfInter - fissure, yOuter);
  set(P.eyeOuterL, cx + (halfInter + fissure) * (1 + asymK), yOuter + asymDrop);
  const lid = mm(p.eyeFissureHeight) / 2;
  set(P.lidUpperR, cx - halfIpd, yPupil - lid);
  set(P.lidLowerR, cx - halfIpd, yPupil + lid);
  set(P.lidUpperL, cx + halfIpd * (1 + asymK), yPupil - lid + asymDrop);
  set(P.lidLowerL, cx + halfIpd * (1 + asymK), yPupil + lid + asymDrop);
  set(P.irisR, cx - halfIpd, yPupil);
  set(P.irisL, cx + halfIpd * (1 + asymK), yPupil + asymDrop);
  set(P.browR, cx - halfIpd, yPupil - lid - mm(p.browToLid));
  set(P.browL, cx + halfIpd * (1 + asymK), yPupil - lid - mm(p.browToLid) + asymDrop);

  // Nose — the tip protrudes beyond the ellipsoid.
  set(P.nasion, cx, yPupil - mm(2));
  set(P.subnasale, cx, ySubnasale);
  set(P.noseTip, cx, ySubnasale - mm(6), -mm(18));
  set(P.alarR, cx - mm(p.alarWidth) / 2, ySubnasale - mm(2));
  set(P.alarL, cx + L(p.alarWidth / 2), ySubnasale - mm(2));

  // Mouth
  set(P.mouthR, cx - mm(p.mouthWidth) / 2, yLipUpperInner);
  set(P.mouthL, cx + L(p.mouthWidth / 2), yLipUpperInner + asymDrop);
  set(P.lipTop, cx, yLipTop);
  set(P.lipUpperInner, cx, yLipUpperInner);
  set(P.lipLowerInner, cx, yLipLowerInner);
  set(P.lipBottom, cx, yLipBottom);

  return pts;
}

/** Rotate the head and re-project — i.e. photograph it from another angle. */
export function pose(
  pts: Point3[],
  { yawDeg = 0, pitchDeg = 0, rollDeg = 0 } = {},
): Point3[] {
  const c = {
    x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
    y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
    z: pts.reduce((s, p) => s + p.z, 0) / pts.length,
  };
  const rad = (d: number) => (d * Math.PI) / 180;
  const [ya, pa, ra] = [rad(yawDeg), rad(pitchDeg), rad(rollDeg)];

  return pts.map((p) => {
    let { x, y, z } = p;
    // Yaw about the vertical axis.
    let dx = x - c.x;
    let dz = z - c.z;
    x = c.x + dx * Math.cos(ya) + dz * Math.sin(ya);
    z = c.z - dx * Math.sin(ya) + dz * Math.cos(ya);
    // Pitch about the horizontal axis.
    let dy = y - c.y;
    dz = z - c.z;
    y = c.y + dy * Math.cos(pa) + dz * Math.sin(pa);
    z = c.z - dy * Math.sin(pa) + dz * Math.cos(pa);
    // Roll in the image plane.
    dx = x - c.x;
    dy = y - c.y;
    x = c.x + dx * Math.cos(ra) - dy * Math.sin(ra);
    y = c.y + dx * Math.sin(ra) + dy * Math.cos(ra);
    return { x, y, z };
  });
}

/** Landmark jitter, standing in for detector noise between two captures. */
export function jitter(pts: Point3[], sigma: number, seed = 1): Point3[] {
  let s = seed >>> 0 || 1;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const g = () =>
    Math.sqrt(-2 * Math.log(rnd() || 1e-9)) * Math.cos(2 * Math.PI * rnd());
  return pts.map((p) => ({
    x: p.x + g() * sigma,
    y: p.y + g() * sigma,
    z: p.z + g() * sigma,
  }));
}

/** Scale about the frame centre — the subject standing closer or further. */
export function rescale(pts: Point3[], factor: number): Point3[] {
  return pts.map((p) => ({
    x: 0.5 + (p.x - 0.5) * factor,
    y: 0.5 + (p.y - 0.5) * factor,
    z: p.z * factor,
  }));
}
