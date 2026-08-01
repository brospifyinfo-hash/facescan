// Real on-device facial geometry analysis via MediaPipe FaceLandmarker.
//
// DETERMINISM: every number here is deterministic by construction — the same
// photo produces the same 478 landmarks, hence the same measurements on every
// render. No Math.random(). The only hashed values are in the dev-only demo
// path at the bottom, which exists so the UI can be tested without a photo.
//
// Measurements follow standard facial anthropometry (neoclassical canons,
// Farkas landmarks, fWHR literature). They are GEOMETRIC measurements against
// population reference ranges — orientation for self-improvement, not
// clinical fact, and never a verdict on a person.
//
// Import only from client components (ideally via dynamic import) — the
// MediaPipe WASM runtime is browser-only.

import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { clamp, scoreBand, toOverall, type Metric } from "./metrics";
import type { ScanMetrics } from "./store";

const WASM_BASE =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

// Canonical MediaPipe FaceMesh indices (478-point topology).
const P = {
  forehead: 10, // mesh apex ≈ trichion
  glabella: 9, // between the brows
  subnasale: 2, // base of the nose
  menton: 152, // bottom of the chin
  noseTip: 1,
  nasion: 168, // bridge, between the eyes
  alarR: 129,
  alarL: 358,
  zygoR: 234, // right face edge at cheekbone
  zygoL: 454,
  jawR: 172,
  jawL: 397,
  eyeOuterR: 33,
  eyeInnerR: 133,
  eyeInnerL: 362,
  eyeOuterL: 263,
  lidUpperR: 159,
  lidLowerR: 145,
  lidUpperL: 386,
  lidLowerL: 374,
  browR: 105,
  browL: 334,
  mouthR: 61,
  mouthL: 291,
  lipTop: 0, // vermillion border, upper
  lipUpperInner: 13,
  lipLowerInner: 14,
  lipBottom: 17,
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
const round = (v: number, n = 2) => Number(v.toFixed(n));

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

/** Build an SVG path (normalized 0..1 image space) from landmark connections. */
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

/**
 * Analyze the front-profile photo. Returns null when no face is detected.
 */
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

  // ---- Base dimensions -------------------------------------------------
  const bizygomatic = dist(p[P.zygoR], p[P.zygoL]); // cheekbone width
  const bigonial = dist(p[P.jawR], p[P.jawL]); // jaw width
  const faceHeight = vdist(p[P.forehead], p[P.menton]);
  const intercanthal = dist(p[P.eyeInnerR], p[P.eyeInnerL]);
  const eyeWidthR = dist(p[P.eyeOuterR], p[P.eyeInnerR]);
  const eyeWidthL = dist(p[P.eyeInnerL], p[P.eyeOuterL]);
  const eyeWidth = (eyeWidthR + eyeWidthL) / 2;
  const eyeHeightR = vdist(p[P.lidUpperR], p[P.lidLowerR]);
  const eyeHeightL = vdist(p[P.lidUpperL], p[P.lidLowerL]);
  const eyeHeight = (eyeHeightR + eyeHeightL) / 2;
  const noseWidth = dist(p[P.alarR], p[P.alarL]);
  const mouthWidth = dist(p[P.mouthR], p[P.mouthL]);

  const metrics: Metric[] = [];

  // ---- 👁️ Eye region ---------------------------------------------------

  // Canthal tilt — angle inner→outer canthus. Image y grows downward.
  const tiltOf = (inner: Point, outer: Point) =>
    (Math.atan2(inner.y - outer.y, Math.abs(outer.x - inner.x)) * 180) /
    Math.PI;
  const canthalTiltDeg = round(
    (tiltOf(p[P.eyeInnerR], p[P.eyeOuterR]) +
      tiltOf(p[P.eyeInnerL], p[P.eyeOuterL])) /
      2,
    1,
  );
  const tiltBand: [number, number] = [3, 8];
  metrics.push({
    id: "canthalTilt",
    emoji: "👁️",
    label: "Canthal tilt",
    category: "eyes",
    value: canthalTiltDeg,
    display: `${canthalTiltDeg > 0 ? "+" : ""}${canthalTiltDeg}°`,
    unit: "°",
    ideal: tiltBand,
    scale: [-8, 14],
    note: "Angle from the inner to the outer eye corner. Positive means the outer corner sits higher.",
    ...scoreBand(canthalTiltDeg, tiltBand, 9),
  });

  // Eye separation ratio — intercanthal / face width. Canon ≈ 0.45.
  const esr = round(intercanthal / bizygomatic);
  const esrBand: [number, number] = [0.43, 0.47];
  metrics.push({
    id: "esr",
    emoji: "🎯",
    label: "Eye separation ratio",
    category: "eyes",
    value: esr,
    display: esr.toFixed(2),
    unit: "",
    ideal: esrBand,
    scale: [0.34, 0.56],
    note: "Distance between the inner eye corners relative to face width. The neoclassical canon sits near 0.45.",
    ...scoreBand(esr, esrBand, 0.08),
  });

  // Intercanthal should equal roughly one eye width.
  const eyeSpacing = round(intercanthal / (eyeWidth || 1e-6));
  const spacingBand: [number, number] = [0.92, 1.08];
  metrics.push({
    id: "eyeSpacing",
    emoji: "↔️",
    label: "Eye spacing",
    category: "eyes",
    value: eyeSpacing,
    display: `${eyeSpacing.toFixed(2)}×`,
    unit: "×",
    ideal: spacingBand,
    scale: [0.6, 1.4],
    note: "Gap between the eyes measured in eye-widths. The classical canon is exactly one.",
    ...scoreBand(eyeSpacing, spacingBand, 0.3),
  });

  // Palpebral fissure aspect — aperture height / width.
  const ear = round(eyeHeight / (eyeWidth || 1e-6));
  const earBand: [number, number] = [0.28, 0.38];
  metrics.push({
    id: "eyeAspect",
    emoji: "🌙",
    label: "Eye aperture",
    category: "eyes",
    value: ear,
    display: ear.toFixed(2),
    unit: "",
    ideal: earBand,
    scale: [0.14, 0.52],
    note: "Eye opening height relative to its width. Low values can simply mean you blinked — retake if it looks off.",
    ...scoreBand(ear, earBand, 0.16),
  });

  // Brow position — brow-to-lid gap in eye-heights.
  const browGap =
    (vdist(p[P.browR], p[P.lidUpperR]) + vdist(p[P.browL], p[P.lidUpperL])) / 2;
  const browRatio = round(browGap / (eyeHeight || 1e-6));
  const browBand: [number, number] = [1.4, 2.4];
  metrics.push({
    id: "browPosition",
    emoji: "🪶",
    label: "Brow position",
    category: "eyes",
    value: browRatio,
    display: `${browRatio.toFixed(2)}×`,
    unit: "×",
    ideal: browBand,
    scale: [0.6, 3.6],
    note: "Brow-to-eyelid distance in eye-heights. Lower reads as a more hooded, deeper-set brow.",
    ...scoreBand(browRatio, browBand, 1.2),
  });

  // ---- 🗿 Jaw & chin ---------------------------------------------------

  const gonialAngle = round(
    (angleAt(p[P.jawR], p[P.zygoR], p[P.menton]) +
      angleAt(p[P.jawL], p[P.zygoL], p[P.menton])) /
      2,
    1,
  );
  const gonialBand: [number, number] = [118, 130];
  metrics.push({
    id: "gonialAngle",
    emoji: "📐",
    label: "Gonial angle",
    category: "jaw",
    value: gonialAngle,
    display: `${gonialAngle.toFixed(1)}°`,
    unit: "°",
    ideal: gonialBand,
    scale: [100, 150],
    note: "The angle the jaw turns at the gonion. Tighter angles read as sharper, though body fat masks this heavily.",
    ...scoreBand(gonialAngle, gonialBand, 22),
  });

  const jawWidthRatio = round(bigonial / bizygomatic);
  const jawBand: [number, number] = [0.74, 0.84];
  metrics.push({
    id: "jawWidth",
    emoji: "🔷",
    label: "Jaw-to-cheek width",
    category: "jaw",
    value: jawWidthRatio,
    display: jawWidthRatio.toFixed(2),
    unit: "",
    ideal: jawBand,
    scale: [0.58, 1.0],
    note: "Jaw width relative to cheekbone width. Too high loses taper; too low reads narrow.",
    ...scoreBand(jawWidthRatio, jawBand, 0.16),
  });

  // Chin height vs philtrum. Canon ≈ 2 : 1.
  const philtrum = vdist(p[P.subnasale], p[P.lipTop]);
  const chinHeight = vdist(p[P.lipBottom], p[P.menton]);
  const chinRatio = round(chinHeight / (philtrum || 1e-6));
  const chinBand: [number, number] = [1.8, 2.4];
  metrics.push({
    id: "chinRatio",
    emoji: "🧱",
    label: "Chin-to-philtrum",
    category: "jaw",
    value: chinRatio,
    display: `${chinRatio.toFixed(2)}:1`,
    unit: ":1",
    ideal: chinBand,
    scale: [1.0, 3.6],
    note: "Chin height against the philtrum. The classical target is roughly two to one.",
    ...scoreBand(chinRatio, chinBand, 0.9),
  });

  // ---- 📐 Proportions --------------------------------------------------

  // Facial thirds — equality of upper / middle / lower.
  const t1 = vdist(p[P.forehead], p[P.glabella]);
  const t2 = vdist(p[P.glabella], p[P.subnasale]);
  const t3 = vdist(p[P.subnasale], p[P.menton]);
  const tAvg = (t1 + t2 + t3) / 3 || 1e-6;
  const thirdsDev = round(
    ((Math.abs(t1 - tAvg) + Math.abs(t2 - tAvg) + Math.abs(t3 - tAvg)) /
      3 /
      tAvg) *
      100,
    1,
  );
  const thirdsBand: [number, number] = [0, 6];
  metrics.push({
    id: "thirds",
    emoji: "📊",
    label: "Facial thirds",
    category: "proportions",
    value: thirdsDev,
    display: `${thirdsDev.toFixed(1)}% dev`,
    unit: "%",
    ideal: thirdsBand,
    scale: [0, 30],
    note: "How evenly the face divides into upper, middle and lower thirds. Lower deviation is closer to the canon.",
    ...scoreBand(thirdsDev, thirdsBand, 18),
  });

  // Facial fifths — face width should be five eye-widths.
  const fifths = round(bizygomatic / (eyeWidth || 1e-6));
  const fifthsBand: [number, number] = [4.6, 5.4];
  metrics.push({
    id: "fifths",
    emoji: "🖐️",
    label: "Facial fifths",
    category: "proportions",
    value: fifths,
    display: `${fifths.toFixed(2)}×`,
    unit: "×",
    ideal: fifthsBand,
    scale: [3.6, 6.6],
    note: "Face width measured in eye-widths. The canon divides the face into five equal vertical fifths.",
    ...scoreBand(fifths, fifthsBand, 1.2),
  });

  // fWHR — bizygomatic width over brow-to-upper-lip height.
  const browMidY = (p[P.browR].y + p[P.browL].y) / 2;
  const fwhrHeight = Math.abs(p[P.lipUpperInner].y - browMidY) || 1e-6;
  const fwhr = round(bizygomatic / fwhrHeight);
  const fwhrBand: [number, number] = [1.75, 2.05];
  metrics.push({
    id: "fwhr",
    emoji: "🔶",
    label: "fWHR",
    category: "proportions",
    value: fwhr,
    display: fwhr.toFixed(2),
    unit: "",
    ideal: fwhrBand,
    scale: [1.3, 2.6],
    note: "Facial width-to-height ratio — the most studied single metric in facial morphology research.",
    ...scoreBand(fwhr, fwhrBand, 0.45),
  });

  // Facial index — total height over width.
  const facialIndex = round(faceHeight / bizygomatic);
  const indexBand: [number, number] = [1.28, 1.45];
  metrics.push({
    id: "facialIndex",
    emoji: "📏",
    label: "Facial index",
    category: "proportions",
    value: facialIndex,
    display: facialIndex.toFixed(2),
    unit: "",
    ideal: indexBand,
    scale: [1.0, 1.8],
    note: "Overall face height against width. Higher reads long and narrow, lower reads short and broad.",
    ...scoreBand(facialIndex, indexBand, 0.28),
  });

  // ---- 👃 Nose & mouth -------------------------------------------------

  const mouthNose = round(mouthWidth / (noseWidth || 1e-6));
  const mouthNoseBand: [number, number] = [1.4, 1.65];
  metrics.push({
    id: "mouthNose",
    emoji: "👄",
    label: "Mouth-to-nose width",
    category: "midface",
    value: mouthNose,
    display: `${mouthNose.toFixed(2)}×`,
    unit: "×",
    ideal: mouthNoseBand,
    scale: [1.0, 2.2],
    note: "Mouth width in nose-widths. The classical canon puts the mouth about 1.5 times the nose.",
    ...scoreBand(mouthNose, mouthNoseBand, 0.4),
  });

  const noseFace = round(noseWidth / bizygomatic);
  const noseFaceBand: [number, number] = [0.23, 0.28];
  metrics.push({
    id: "noseWidth",
    emoji: "👃",
    label: "Nose width",
    category: "midface",
    value: noseFace,
    display: noseFace.toFixed(2),
    unit: "",
    ideal: noseFaceBand,
    scale: [0.15, 0.38],
    note: "Nose width relative to face width — one of the classical horizontal fifths.",
    ...scoreBand(noseFace, noseFaceBand, 0.08),
  });

  const upperLip = vdist(p[P.lipTop], p[P.lipUpperInner]);
  const lowerLip = vdist(p[P.lipLowerInner], p[P.lipBottom]);
  const lipRatio = round(lowerLip / (upperLip || 1e-6));
  const lipBand: [number, number] = [1.3, 1.9];
  metrics.push({
    id: "lipRatio",
    emoji: "💋",
    label: "Lip ratio",
    category: "midface",
    value: lipRatio,
    display: `${lipRatio.toFixed(2)}:1`,
    unit: ":1",
    ideal: lipBand,
    scale: [0.6, 3.0],
    note: "Lower lip height against upper. Around 1.6 : 1 is the commonly cited aesthetic target.",
    ...scoreBand(lipRatio, lipBand, 0.9),
  });

  // Midface ratio — pupil line to lip against intercanthal distance.
  const pupilY = (p[P.eyeInnerR].y + p[P.eyeInnerL].y) / 2;
  const midface = round(
    Math.abs(p[P.lipUpperInner].y - pupilY) / (intercanthal || 1e-6),
  );
  const midfaceBand: [number, number] = [0.95, 1.12];
  metrics.push({
    id: "midface",
    emoji: "🎭",
    label: "Midface ratio",
    category: "midface",
    value: midface,
    display: midface.toFixed(2),
    unit: "",
    ideal: midfaceBand,
    scale: [0.7, 1.5],
    note: "Eye-line to lip distance against eye spacing. Compact midfaces are generally read as more youthful.",
    ...scoreBand(midface, midfaceBand, 0.28),
  });

  // ---- ⚖️ Symmetry (composite, its own headline stat) ------------------
  const midX = (p[P.nasion].x + p[P.menton].x) / 2;
  let err = 0;
  for (const [ri, li] of SYMMETRY_PAIRS) {
    const dR = Math.abs(midX - p[ri].x);
    const dL = Math.abs(p[li].x - midX);
    err += (Math.abs(dL - dR) + 0.5 * Math.abs(p[li].y - p[ri].y)) / bizygomatic;
  }
  err /= SYMMETRY_PAIRS.length;
  const symmetry = Math.round(clamp(100 - err * 340, 40, 99));

  // ---- Composite scores ------------------------------------------------
  const avg = (ids: string[]) => {
    const picked = metrics.filter((m) => ids.includes(m.category));
    return picked.reduce((s, m) => s + m.score, 0) / (picked.length || 1);
  };
  const eyesScore = Math.round(avg(["eyes"]));
  const jawScore = Math.round(avg(["jaw"]));
  const proportionsScore = Math.round(avg(["proportions"]));
  const midfaceScore = Math.round(avg(["midface"]));

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

  const weakest = [...metrics].sort((a, b) => a.score - b.score).slice(0, 3);

  const contours = [
    ...FaceLandmarker.FACE_LANDMARKS_FACE_OVAL,
    ...FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
    ...FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
    ...FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW,
    ...FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW,
    ...FaceLandmarker.FACE_LANDMARKS_LIPS,
  ];

  return {
    overall: toOverall(harmony),
    harmony,
    symmetry,
    eyesScore,
    jawScore,
    proportionsScore,
    midfaceScore,
    metrics,
    weakest: weakest.map((m) => m.label),
    canthalTiltDeg,
    canthalTiltClass:
      canthalTiltDeg >= 1.5 ? "positive" : canthalTiltDeg <= -1.5 ? "negative" : "neutral",
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
  // Reuse the real descriptors, but fill values from the seed.
  const spec: Array<
    Omit<Metric, "value" | "display" | "score" | "position"> & {
      lo: number;
      hi: number;
      tol: number;
      fmt: (v: number) => string;
    }
  > = [
    { id: "canthalTilt", emoji: "👁️", label: "Canthal tilt", category: "eyes", unit: "°", ideal: [3, 8], scale: [-8, 14], note: "Angle from the inner to the outer eye corner. Positive means the outer corner sits higher.", lo: -3, hi: 9, tol: 9, fmt: (v) => `${v > 0 ? "+" : ""}${v.toFixed(1)}°` },
    { id: "esr", emoji: "🎯", label: "Eye separation ratio", category: "eyes", unit: "", ideal: [0.43, 0.47], scale: [0.34, 0.56], note: "Distance between the inner eye corners relative to face width. The neoclassical canon sits near 0.45.", lo: 0.4, hi: 0.5, tol: 0.08, fmt: (v) => v.toFixed(2) },
    { id: "eyeSpacing", emoji: "↔️", label: "Eye spacing", category: "eyes", unit: "×", ideal: [0.92, 1.08], scale: [0.6, 1.4], note: "Gap between the eyes measured in eye-widths. The classical canon is exactly one.", lo: 0.82, hi: 1.15, tol: 0.3, fmt: (v) => `${v.toFixed(2)}×` },
    { id: "eyeAspect", emoji: "🌙", label: "Eye aperture", category: "eyes", unit: "", ideal: [0.28, 0.38], scale: [0.14, 0.52], note: "Eye opening height relative to its width. Low values can simply mean you blinked — retake if it looks off.", lo: 0.24, hi: 0.4, tol: 0.16, fmt: (v) => v.toFixed(2) },
    { id: "browPosition", emoji: "🪶", label: "Brow position", category: "eyes", unit: "×", ideal: [1.4, 2.4], scale: [0.6, 3.6], note: "Brow-to-eyelid distance in eye-heights. Lower reads as a more hooded, deeper-set brow.", lo: 1.1, hi: 2.8, tol: 1.2, fmt: (v) => `${v.toFixed(2)}×` },
    { id: "gonialAngle", emoji: "📐", label: "Gonial angle", category: "jaw", unit: "°", ideal: [118, 130], scale: [100, 150], note: "The angle the jaw turns at the gonion. Tighter angles read as sharper, though body fat masks this heavily.", lo: 112, hi: 140, tol: 22, fmt: (v) => `${v.toFixed(1)}°` },
    { id: "jawWidth", emoji: "🔷", label: "Jaw-to-cheek width", category: "jaw", unit: "", ideal: [0.74, 0.84], scale: [0.58, 1.0], note: "Jaw width relative to cheekbone width. Too high loses taper; too low reads narrow.", lo: 0.68, hi: 0.9, tol: 0.16, fmt: (v) => v.toFixed(2) },
    { id: "chinRatio", emoji: "🧱", label: "Chin-to-philtrum", category: "jaw", unit: ":1", ideal: [1.8, 2.4], scale: [1.0, 3.6], note: "Chin height against the philtrum. The classical target is roughly two to one.", lo: 1.4, hi: 2.8, tol: 0.9, fmt: (v) => `${v.toFixed(2)}:1` },
    { id: "thirds", emoji: "📊", label: "Facial thirds", category: "proportions", unit: "%", ideal: [0, 6], scale: [0, 30], note: "How evenly the face divides into upper, middle and lower thirds. Lower deviation is closer to the canon.", lo: 1, hi: 14, tol: 18, fmt: (v) => `${v.toFixed(1)}% dev` },
    { id: "fifths", emoji: "🖐️", label: "Facial fifths", category: "proportions", unit: "×", ideal: [4.6, 5.4], scale: [3.6, 6.6], note: "Face width measured in eye-widths. The canon divides the face into five equal vertical fifths.", lo: 4.2, hi: 5.9, tol: 1.2, fmt: (v) => `${v.toFixed(2)}×` },
    { id: "fwhr", emoji: "🔶", label: "fWHR", category: "proportions", unit: "", ideal: [1.75, 2.05], scale: [1.3, 2.6], note: "Facial width-to-height ratio — the most studied single metric in facial morphology research.", lo: 1.6, hi: 2.2, tol: 0.45, fmt: (v) => v.toFixed(2) },
    { id: "facialIndex", emoji: "📏", label: "Facial index", category: "proportions", unit: "", ideal: [1.28, 1.45], scale: [1.0, 1.8], note: "Overall face height against width. Higher reads long and narrow, lower reads short and broad.", lo: 1.18, hi: 1.55, tol: 0.28, fmt: (v) => v.toFixed(2) },
    { id: "mouthNose", emoji: "👄", label: "Mouth-to-nose width", category: "midface", unit: "×", ideal: [1.4, 1.65], scale: [1.0, 2.2], note: "Mouth width in nose-widths. The classical canon puts the mouth about 1.5 times the nose.", lo: 1.25, hi: 1.8, tol: 0.4, fmt: (v) => `${v.toFixed(2)}×` },
    { id: "noseWidth", emoji: "👃", label: "Nose width", category: "midface", unit: "", ideal: [0.23, 0.28], scale: [0.15, 0.38], note: "Nose width relative to face width — one of the classical horizontal fifths.", lo: 0.2, hi: 0.32, tol: 0.08, fmt: (v) => v.toFixed(2) },
    { id: "lipRatio", emoji: "💋", label: "Lip ratio", category: "midface", unit: ":1", ideal: [1.3, 1.9], scale: [0.6, 3.0], note: "Lower lip height against upper. Around 1.6 : 1 is the commonly cited aesthetic target.", lo: 1.0, hi: 2.3, tol: 0.9, fmt: (v) => `${v.toFixed(2)}:1` },
    { id: "midface", emoji: "🎭", label: "Midface ratio", category: "midface", unit: "", ideal: [0.95, 1.12], scale: [0.7, 1.5], note: "Eye-line to lip distance against eye spacing. Compact midfaces are generally read as more youthful.", lo: 0.85, hi: 1.25, tol: 0.28, fmt: (v) => v.toFixed(2) },
  ];

  const metrics: Metric[] = spec.map((s) => {
    const value = round(seeded(seed, s.id, s.lo, s.hi), 2);
    return {
      id: s.id,
      emoji: s.emoji,
      label: s.label,
      category: s.category,
      value,
      display: s.fmt(value),
      unit: s.unit,
      ideal: s.ideal,
      scale: s.scale,
      note: s.note,
      ...scoreBand(value, s.ideal, s.tol),
    };
  });

  const symmetry = Math.round(seeded(seed, "sym", 68, 94));
  const avg = (cat: string) => {
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
  const tilt = metrics.find((m) => m.id === "canthalTilt")!.value;

  return {
    overall: toOverall(harmony),
    harmony,
    symmetry,
    eyesScore,
    jawScore,
    proportionsScore,
    midfaceScore,
    metrics,
    weakest: [...metrics].sort((a, b) => a.score - b.score).slice(0, 3).map((m) => m.label),
    canthalTiltDeg: tilt,
    canthalTiltClass: tilt >= 1.5 ? "positive" : tilt <= -1.5 ? "negative" : "neutral",
    interocularPx: Math.round(seeded(seed, "iod", 180, 420)),
    landmarkCount: 478,
    aspect: 0.8,
    mesh: null,
    demo: true,
  };
}
