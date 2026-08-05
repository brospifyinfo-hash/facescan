// Landmark access, head pose and alignment.
//
// WHY THIS FILE EXISTS
// --------------------
// Two defects in the old code lived here, and together they were the main
// cause of "the same person gets a different score from a different photo":
//
// 1. THE Z CHANNEL WAS THROWN AWAY. analyzeFront() did
//    `raw.map(pt => ({x: pt.x, y: pt.y}))`. MediaPipe returns a 3D mesh;
//    discarding z made real pose estimation impossible, so yaw had to be
//    guessed from how far the nose had drifted between the cheek points —
//    a proxy that is itself distorted by the very rotation it estimates.
//
// 2. ONLY ROLL WAS CORRECTED. Yaw and pitch were computed (in quality.ts)
//    and then used for nothing but a warning. Under weak perspective a yaw
//    of θ foreshortens every horizontal distance by cos θ. At 15° — an
//    entirely ordinary selfie — that is 3.4%. Every width-over-height ratio
//    (facialIndex, fwhr, esr, noseWidth, jawWidth …) therefore moved by
//    3.4% between two photos of the same face, which is 0.7-1.7 SD on the
//    norms in norms.ts. That alone can swing the headline by several points.
//
// 3. SINGLE-POINT MEASUREMENTS. Face width came from exactly two landmark
//    indices. Per-landmark jitter propagated at full weight. Averaging a
//    landmark with its immediate neighbours along the face oval cuts that
//    variance without changing what is being measured.
//
// Everything here is pure geometry over plain arrays, so it runs in Node
// and is testable without a browser.

/** A MediaPipe landmark. `z` is relative depth, same scale as `x`. */
export interface Point3 {
  x: number;
  y: number;
  z: number;
}

export type Point = { x: number; y: number };

/**
 * Canonical MediaPipe FaceMesh indices (478-point topology).
 * Iris centres (468/473) exist only in the refined model.
 */
export const P = {
  forehead: 10, glabella: 9, subnasale: 2, menton: 152,
  noseTip: 1, nasion: 168, alarR: 129, alarL: 358,
  zygoR: 234, zygoL: 454, jawR: 172, jawL: 397,
  eyeOuterR: 33, eyeInnerR: 133, eyeInnerL: 362, eyeOuterL: 263,
  lidUpperR: 159, lidLowerR: 145, lidUpperL: 386, lidLowerL: 374,
  browR: 105, browL: 334, mouthR: 61, mouthL: 291,
  lipTop: 0, lipUpperInner: 13, lipLowerInner: 14, lipBottom: 17,
  irisR: 468, irisL: 473,
} as const;

/**
 * Immediate neighbours along the face oval / feature contours.
 *
 * Averaging a landmark with these reduces per-point jitter. The neighbours
 * are the adjacent vertices in MediaPipe's own FACE_OVAL ordering, so the
 * average stays on the same contour and does not shift the measurement —
 * it only smooths it. Points with no listed neighbours are used as-is.
 */
const NEIGHBOURS: Partial<Record<number, number[]>> = {
  [P.zygoR]: [127, 93],
  [P.zygoL]: [356, 323],
  [P.jawR]: [58, 136],
  [P.jawL]: [288, 365],
  [P.menton]: [148, 377],
  [P.forehead]: [109, 338],
};

/** Landmark `i`, averaged with its contour neighbours when it has any. */
export function robust(pts: Point3[], i: number): Point3 {
  const group = NEIGHBOURS[i];
  if (!group) return pts[i];
  let x = pts[i].x;
  let y = pts[i].y;
  let z = pts[i].z;
  let n = 1;
  for (const j of group) {
    const p = pts[j];
    if (!p) continue;
    x += p.x;
    y += p.y;
    z += p.z;
    n++;
  }
  return { x: x / n, y: y / n, z: z / n };
}

export const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export const vdist = (a: Point, b: Point) => Math.abs(a.y - b.y);

export function rotate<T extends Point3>(p: T, angle: number, origin: Point): Point3 {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = p.x - origin.x;
  const dy = p.y - origin.y;
  return {
    x: origin.x + dx * cos - dy * sin,
    y: origin.y + dx * sin + dy * cos,
    z: p.z,
  };
}

export interface Pose {
  /** Radians. Rotation about the vertical axis; + = subject's left toward camera. */
  yaw: number;
  /** Radians. Rotation about the horizontal axis; + = chin toward camera. */
  pitch: number;
  /** Radians. In-plane rotation. */
  roll: number;
}

export const toDeg = (rad: number) => (rad * 180) / Math.PI;

/**
 * Head pose from the 3D mesh.
 *
 * Each angle is the inclination of a facial axis out of the image plane,
 * read directly off the landmark coordinates. No tuned constants:
 *
 *   yaw   — the cheek-to-cheek vector rotates in the horizontal plane, so
 *           its depth component over its width component is tan(yaw).
 *   pitch — the forehead-to-chin vector does the same vertically.
 *   roll  — the interocular vector's inclination in the image plane.
 *
 * MediaPipe's z is a relative depth in roughly the same units as x, which
 * is what makes the ratio meaningful. It is not metric, so these angles are
 * estimates — good enough for a first-order foreshortening correction,
 * not good enough to report as measurements. `confidence` reflects that.
 */
export function estimatePose(pts: Point3[]): Pose {
  const zr = robust(pts, P.zygoR);
  const zl = robust(pts, P.zygoL);
  const top = robust(pts, P.forehead);
  const bottom = robust(pts, P.menton);

  const width = zl.x - zr.x;
  const yaw = Math.atan2(zl.z - zr.z, Math.abs(width) || 1e-6);

  const height = bottom.y - top.y;
  const pitch = Math.atan2(bottom.z - top.z, Math.abs(height) || 1e-6);

  const roll = Math.atan2(
    pts[P.eyeInnerL].y - pts[P.eyeInnerR].y,
    pts[P.eyeInnerL].x - pts[P.eyeInnerR].x,
  );

  return { yaw, pitch, roll };
}

export interface Aligned {
  /** Landmarks rotated into a canonical frontal frame. */
  points: Point3[];
  pose: Pose;
  /** False when z was degenerate and only roll could be removed. */
  poseCompensated: boolean;
  /** Residual foreshortening left after compensation, 1.0 = none. */
  residualScale: number;
}

/**
 * Beyond this rotation the planar-face assumption behind the correction
 * breaks down: self-occlusion hides the far side and its landmarks are
 * inferred rather than observed, so de-rotating them invents geometry.
 * The angle is still removed, but the capture is flagged and confidence
 * drops — it is not silently trusted.
 */
export const MAX_RELIABLE_ANGLE = (28 * Math.PI) / 180;

/** Rotate about the vertical (y) axis through `c`. */
function yawRotate(p: Point3, c: Point3, a: number): Point3 {
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const dx = p.x - c.x;
  const dz = p.z - c.z;
  return { x: c.x + dx * cos + dz * sin, y: p.y, z: c.z - dx * sin + dz * cos };
}

/** Rotate about the horizontal (x) axis through `c`. */
function pitchRotate(p: Point3, c: Point3, a: number): Point3 {
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const dy = p.y - c.y;
  const dz = p.z - c.z;
  return { x: p.x, y: c.y + dy * cos + dz * sin, z: c.z - dy * sin + dz * cos };
}

/**
 * Bring the mesh into a canonical frontal frame.
 *
 * This is the pose compensation the stability requirement rests on. Rather
 * than scaling measured distances by cos(θ) — which only works for a planar
 * object and cannot fix the ASYMMETRY that yaw introduces — the landmarks
 * are de-rotated in 3D using MediaPipe's own depth channel. Under
 * orthographic projection that inversion is exact; under the real weak
 * perspective of a phone camera it is a very good first-order correction.
 *
 * Fixing the asymmetry is what matters most: a yawed head reads as an
 * asymmetric face to any midline-based measure. That is precisely why
 * "very symmetric faces" were scoring 3-5 — they were being photographed
 * slightly turned, and the symmetry module was measuring the turn.
 *
 * If z is degenerate (all landmarks at the same depth, which happens with
 * synthetic input and with some older model builds) de-rotation would
 * amplify noise instead of removing pose, so only roll is corrected and
 * `poseCompensated` reports false. Callers lower confidence rather than
 * pretending the correction happened.
 */
export function align(raw: Point3[]): Aligned {
  const pose = estimatePose(raw);
  const origin = {
    x: (raw[P.eyeInnerR].x + raw[P.eyeInnerL].x) / 2,
    y: (raw[P.eyeInnerR].y + raw[P.eyeInnerL].y) / 2,
  };
  let points = raw.map((p) => rotate(p, -pose.roll, origin));

  // Is there usable depth? Compare the spread of z against the spread of x.
  const zs = points.map((p) => p.z);
  const xs = points.map((p) => p.x);
  const spread = (a: number[]) => Math.max(...a) - Math.min(...a);
  const zSpread = spread(zs);
  const xSpread = spread(xs) || 1e-6;
  const poseCompensated = zSpread / xSpread > 0.05;

  if (poseCompensated) {
    const centre: Point3 = {
      x: points.reduce((s, p) => s + p.x, 0) / points.length,
      y: points.reduce((s, p) => s + p.y, 0) / points.length,
      z: points.reduce((s, p) => s + p.z, 0) / points.length,
    };
    // SIGN CONVENTION — the correction applies +yaw, not -yaw, and this is
    // not a typo. estimatePose reads the angle off the PROJECTED mesh: a
    // head rotated by θ shows a cheek-to-cheek depth difference whose
    // arctangent is −θ. So the estimate is already the inverse rotation,
    // and negating it would apply the turn a second time. The test suite
    // pins this down: without it a 10° yaw moved the headline by 3.9
    // points, which is the whole complaint about instability.
    points = points.map((p) => yawRotate(p, centre, pose.yaw));
    points = points.map((p) => pitchRotate(p, centre, pose.pitch));
  }

  // Without depth, the best available correction is the planar cos factor.
  const residualScale = poseCompensated
    ? 1
    : Math.cos(pose.yaw) * Math.cos(pose.pitch);

  return { points, pose, poseCompensated, residualScale };
}

/**
 * Pupil centres, with a documented fallback.
 *
 * The published norms for eye separation and midface height are defined
 * PUPIL-to-pupil. Measuring them canthus-to-canthus shifts both by well
 * over one SD. Iris landmarks exist only in the refined 478-point model;
 * without them the fissure midpoint is the closest available substitute
 * and is roughly 1mm off, which is inside the norm's SD.
 */
export function pupils(p: Point3[]): { r: Point3; l: Point3; refined: boolean } {
  const refined = Boolean(p[P.irisR] && p[P.irisL]);
  if (refined) return { r: p[P.irisR], l: p[P.irisL], refined };
  const mid = (a: Point3, b: Point3): Point3 => ({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: (a.z + b.z) / 2,
  });
  return {
    r: mid(p[P.eyeOuterR], p[P.eyeInnerR]),
    l: mid(p[P.eyeOuterL], p[P.eyeInnerL]),
    refined,
  };
}
