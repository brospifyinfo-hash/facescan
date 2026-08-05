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
import { runPipeline } from "./analysis/pipeline";
import type { MeshPaths } from "./store";
import { makeMetric, METRIC_ORDER, SPECS } from "./specs";
import { clamp, toOverall, type CategoryId, type Metric } from "./metrics";
import type { ScanMetrics } from "./store";

const WASM_BASE =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

let instance: FaceLandmarker | null = null;
let permissive: FaceLandmarker | null = null;

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

/**
 * Second detector with lowered thresholds, used only for the side profile.
 *
 * The default 0.5 confidence is tuned for frontal faces and rejects most
 * three-quarter and profile shots outright, which is why the side panel kept
 * falling back to the plain grid. Accuracy matters less here — nothing is
 * measured from this photo, the landmarks only drive the overlay.
 */
async function getPermissiveLandmarker(): Promise<FaceLandmarker> {
  if (permissive) return permissive;
  const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
  permissive = await FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL_URL },
    runningMode: "IMAGE",
    numFaces: 1,
    minFaceDetectionConfidence: 0.15,
    minFacePresenceConfidence: 0.15,
    minTrackingConfidence: 0.15,
  });
  return permissive;
}

/** Draw an image to a canvas, optionally mirrored. */
function toCanvas(image: HTMLImageElement, mirror: boolean): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = image.naturalWidth;
  c.height = image.naturalHeight;
  const ctx = c.getContext("2d")!;
  if (mirror) {
    ctx.translate(c.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(image, 0, 0);
  return c;
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

function meshFrom(flat: Point[]) {
  const contours = [
    ...FaceLandmarker.FACE_LANDMARKS_FACE_OVAL,
    ...FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
    ...FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
    ...FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW,
    ...FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW,
    ...FaceLandmarker.FACE_LANDMARKS_LIPS,
  ];
  return {
    tesselation: pathFrom(flat, FaceLandmarker.FACE_LANDMARKS_TESSELATION),
    contours: pathFrom(flat, contours),
    dots: dotsFrom(flat),
  };
}

/**
 * Landmark overlay for a secondary photo (the side profile).
 *
 * Only the front photo drives the measurements; this exists so the side shot
 * carries the same real mesh rather than a decorative grid. Detection on a
 * true 90-degree profile often fails — the caller falls back to the grid,
 * which is visibly a placeholder rather than a fake mesh.
 */
export async function detectMesh(
  image: HTMLImageElement,
): Promise<{ mesh: MeshPaths; aspect: number } | null> {
  const aspect = image.naturalWidth / image.naturalHeight;

  // Three passes, cheapest first. The mirrored retry matters because the
  // detector is noticeably better at one facing direction than the other,
  // so a left-facing profile that fails often succeeds flipped.
  const attempts: Array<() => Promise<Point[] | null>> = [
    async () => {
      const r = (await getLandmarker()).detect(image).faceLandmarks?.[0];
      return r && r.length >= 468 ? r.map((p) => ({ x: p.x, y: p.y })) : null;
    },
    async () => {
      const r = (await getPermissiveLandmarker()).detect(image).faceLandmarks?.[0];
      return r && r.length >= 468 ? r.map((p) => ({ x: p.x, y: p.y })) : null;
    },
    async () => {
      const lm = await getPermissiveLandmarker();
      const r = lm.detect(toCanvas(image, true)).faceLandmarks?.[0];
      // Un-mirror the x coordinates so the overlay lands on the real photo.
      return r && r.length >= 468
        ? r.map((p) => ({ x: 1 - p.x, y: p.y }))
        : null;
    },
  ];

  for (const attempt of attempts) {
    try {
      const flat = await attempt();
      if (flat) return { mesh: meshFrom(flat), aspect };
    } catch {
      /* try the next pass */
    }
  }
  return null;
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

  // Stages 4–7 run through the hybrid pipeline: geometry, embedding,
  // capture quality and the score engine. MediaPipe (stages 1–3) stays as
  // the landmark source; the pipeline is built around it, not instead of it.
  const pipeline = await runPipeline(image, flat);
  const { intercanthal, aligned, roll, ...scores } = measure(flat);
  void aligned;
  void roll;

  return {
    ...scores,
    // The engine's figures win over measure()'s, since it is the component
    // that owns scoring and can be swapped for a trained model.
    overall: pipeline.score.overall,
    harmony: pipeline.score.harmony,
    confidence: pipeline.score.confidence,
    qualityIssues: pipeline.quality.issues,
    interocularPx: Math.round(intercanthal * image.naturalWidth),
    landmarkCount: raw.length,
    aspect: image.naturalWidth / image.naturalHeight,
    mesh: meshFrom(flat),
    sideMesh: null,
    sideAspect: null,
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
    sideMesh: null,
    sideAspect: null,
    // The demo path has no pixels to measure, so it reports a nominal
    // confidence rather than pretending a capture was assessed.
    confidence: 0.9,
    qualityIssues: [],
    demo: true,
  };
}
