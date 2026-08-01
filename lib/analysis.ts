// MediaPipe binding layer. All geometry lives in ./measure.ts (pure, no
// MediaPipe import, testable in plain Node) — this file only runs the
// landmarker and builds the mesh overlay paths.
//
// DETERMINISM: the same photo produces the same 478 landmarks, hence the
// same measurements on every render. No Math.random(). The only hashed
// values are in the dev-only demo path at the bottom.
//
// Import only from client components (ideally via dynamic import) — the
// MediaPipe WASM runtime is browser-only.

import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { measure, type Point } from "./measure";
import { makeMetric, METRIC_ORDER, SPECS } from "./specs";
import { clamp, toOverall, type CategoryId, type Metric } from "./metrics";
import type { ScanMetrics } from "./store";

const WASM_BASE =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

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

/** Analyze the front-profile photo. Returns null when no face is detected. */
export async function analyzeFront(
  image: HTMLImageElement,
): Promise<ScanMetrics | null> {
  const landmarker = await getLandmarker();
  const result = landmarker.detect(image);
  const raw = result.faceLandmarks?.[0];
  if (!raw || raw.length < 468) return null;

  const flat: Point[] = raw.map((pt) => ({ x: pt.x, y: pt.y }));
  const measured = measure(flat);

  const contours = [
    ...FaceLandmarker.FACE_LANDMARKS_FACE_OVAL,
    ...FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
    ...FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
    ...FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW,
    ...FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW,
    ...FaceLandmarker.FACE_LANDMARKS_LIPS,
  ];

  const { intercanthal, ...scores } = measured;

  return {
    ...scores,
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
    overall: toOverall(harmony),
    harmony,
    symmetry,
    eyesScore,
    jawScore,
    proportionsScore,
    midfaceScore,
    metrics,
    weakest: [...metrics].sort((a, b) => a.score - b.score).slice(0, 3).map((m: Metric) => m.id),
    interocularPx: Math.round(seeded(seed, "iod", 180, 420)),
    landmarkCount: 478,
    aspect: 0.8,
    mesh: null,
    demo: true,
  };
}
