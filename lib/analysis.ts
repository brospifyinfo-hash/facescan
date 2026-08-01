// Real on-device facial geometry analysis via MediaPipe FaceLandmarker.
//
// DETERMINISM: every number is deterministic by construction — the same
// photo produces the same 478 landmarks, hence the same measurements on
// every render. No Math.random(). The only hashed values are in the
// dev-only demo path at the bottom.
//
// Measurements follow standard facial anthropometry (neoclassical canons,
// Farkas landmarks, fWHR literature). Reference bands, formatting and
// scoring live in ./specs.ts; human-readable labels live in ./i18n.
//
// Import only from client components (ideally via dynamic import) — the
// MediaPipe WASM runtime is browser-only.

import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { clamp, toOverall, type CategoryId, type Metric } from "./metrics";
import { makeMetric, METRIC_ORDER, SPECS } from "./specs";
import type { ScanMetrics } from "./store";

const WASM_BASE =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

// Canonical MediaPipe FaceMesh indices (478-point topology).
const P = {
  forehead: 10, glabella: 9, subnasale: 2, menton: 152,
  noseTip: 1, nasion: 168, alarR: 129, alarL: 358,
  zygoR: 234, zygoL: 454, jawR: 172, jawL: 397,
  eyeOuterR: 33, eyeInnerR: 133, eyeInnerL: 362, eyeOuterL: 263,
  lidUpperR: 159, lidLowerR: 145, lidUpperL: 386, lidLowerL: 374,
  browR: 105, browL: 334, mouthR: 61, mouthL: 291,
  lipTop: 0, lipUpperInner: 13, lipLowerInner: 14, lipBottom: 17,
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

type Point = { x: number; y: number };

let instance: FaceLandmarker | null = null;

export async function getLandmarker(): Promise<FaceLandmarker> {
  if (instance) return instance;
  const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
  instance = await FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL_URL },
    runningMode: "IMAGE",
    numFaces: 1,
  });
  return instance;
}

export function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image could not be decoded"));
    img.src = dataUrl;
  });
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const vdist = (a: Point, b: Point) => Math.abs(a.y - b.y);

function rotate(p: Point, angle: number, origin: Point): Point {
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

function pathFrom(
  pts: ReadonlyArray<Point>,
  connections: ReadonlyArray<{ start: number; end: number }>,
): string {
  let d = "";
  for (const c of connections) {
    const a = pts[c.start];
    const b = pts[c.end];
    if (!a || !b) continue;
    d += `M${a.x.toFixed(4)} ${a.y.toFixed(4)}L${b.x.toFixed(4)} ${b.y.toFixed(4)}`;
  }
  return d;
}

/** Zero-length segments with round linecaps render as dots — one path, 478 points. */
function dotsFrom(pts: ReadonlyArray<Point>): string {
  let d = "";
  for (const p of pts) d += `M${p.x.toFixed(4)} ${p.y.toFixed(4)}l0 0`;
  return d;
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

/** Analyze the front-profile photo. Returns null when no face is detected. */
export async function analyzeFront(
  image: HTMLImageElement,
): Promise<ScanMetrics | null> {
  const landmarker = await getLandmarker();
  const result = landmarker.detect(image);
  const raw = result.faceLandmarks?.[0];
  if (!raw || raw.length < 468) return null;

  const flat: Point[] = raw.map((pt) => ({ x: pt.x, y: pt.y }));

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

  // Base dimensions
  const bizygomatic = dist(p[P.zygoR], p[P.zygoL]);
  const bigonial = dist(p[P.jawR], p[P.jawL]);
  const faceHeight = vdist(p[P.forehead], p[P.menton]);
  const intercanthal = dist(p[P.eyeInnerR], p[P.eyeInnerL]);
  const eyeWidth =
    (dist(p[P.eyeOuterR], p[P.eyeInnerR]) + dist(p[P.eyeInnerL], p[P.eyeOuterL])) / 2;
  const eyeHeight =
    (vdist(p[P.lidUpperR], p[P.lidLowerR]) + vdist(p[P.lidUpperL], p[P.lidLowerL])) / 2;
  const noseWidth = dist(p[P.alarR], p[P.alarL]);
  const mouthWidth = dist(p[P.mouthR], p[P.mouthL]);

  // Canthal tilt — image y grows downward, so a higher outer corner is a
  // smaller y than the inner corner.
  const tiltOf = (inner: Point, outer: Point) =>
    (Math.atan2(inner.y - outer.y, Math.abs(outer.x - inner.x)) * 180) / Math.PI;
  const canthalTiltDeg =
    (tiltOf(p[P.eyeInnerR], p[P.eyeOuterR]) + tiltOf(p[P.eyeInnerL], p[P.eyeOuterL])) / 2;

  const gonialAngle =
    (angleAt(p[P.jawR], p[P.zygoR], p[P.menton]) +
      angleAt(p[P.jawL], p[P.zygoL], p[P.menton])) / 2;

  // Facial thirds — mean deviation from three equal thirds, as a percentage.
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
    makeMetric("esr", intercanthal / bizygomatic),
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
    makeMetric("mouthNose", mouthWidth / (noseWidth || 1e-6)),
    makeMetric("noseWidth", noseWidth / bizygomatic),
    makeMetric("lipRatio", lowerLip / (upperLip || 1e-6)),
    makeMetric("midface", Math.abs(p[P.lipUpperInner].y - pupilY) / (intercanthal || 1e-6)),
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

  const contours = [
    ...FaceLandmarker.FACE_LANDMARKS_FACE_OVAL,
    ...FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
    ...FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
    ...FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW,
    ...FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW,
    ...FaceLandmarker.FACE_LANDMARKS_LIPS,
  ];

  return {
    ...composite(metrics, symmetry),
    symmetry,
    metrics,
    interocularPx: Math.round(intercanthal * image.naturalWidth),
    landmarkCount: raw.length,
    aspect: image.naturalWidth / image.naturalHeight,
    mesh: {
      tesselation: pathFrom(flat, FaceLandmarker.FACE_LANDMARKS_TESSELATION),
      contours: pathFrom(flat, contours),
      dots: dotsFrom(flat),
    },
  };
}

// ---------------------------------------------------------------------------
// Dev-only demo data (/scan?demo=1 in development).
// FNV-1a seeded so the demo is stable across renders and reloads.
// ---------------------------------------------------------------------------

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

const seeded = (seed: string, salt: string, lo: number, hi: number) =>
  lo + ((hash(`${seed}::${salt}`) % 1000) / 999) * (hi - lo);

export function demoMetrics(seed = "demo"): ScanMetrics {
  const metrics = METRIC_ORDER.map((id) =>
    makeMetric(id, seeded(seed, id, SPECS[id].demo[0], SPECS[id].demo[1])),
  );
  const symmetry = Math.round(seeded(seed, "sym", 68, 94));

  return {
    ...composite(metrics, symmetry),
    symmetry,
    metrics,
    interocularPx: Math.round(seeded(seed, "iod", 180, 420)),
    landmarkCount: 478,
    aspect: 0.8,
    mesh: null,
    demo: true,
  };
}
