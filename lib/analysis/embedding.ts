// Stage 5: face embedding.
//
// ─────────────────────────────────────────────────────────────────────────
// WHAT THIS STAGE IS FOR
//
// An ArcFace-family embedding (buffalo_l, MobileFaceNet, …) is an IDENTITY
// representation: trained so two photos of the same person land close
// together despite pose, lighting and expression. That invariance is the
// reason it belongs here — it gives the pipeline a stable anchor, so the
// same face shot twice does not drift.
//
// WHAT IT CANNOT DO
//
// It cannot supply an attractiveness judgement. There is no direction in a
// 512-d identity space that means "more attractive" until a regression head
// is fitted on labelled ratings (SCUT-FBP5500 and similar). So this stage
// reports `structuralStability` — how consistent the representation is
// across alignment variants — and leaves `attractivenessDelta` null rather
// than manufacturing a number. DEFAULT_WEIGHTS.embeddingContribution is 0
// for the same reason.
//
// PRIVACY
//
// Runs entirely in the browser via onnxruntime-web. The vector is never
// persisted, never transmitted, and never compared against any database.
// Identification is not a capability of this code — there is nothing to
// compare against.
//
// ENABLING IT
//
// Set NEXT_PUBLIC_FACE_EMBEDDING_MODEL_URL to an ONNX recognition model
// (e.g. a MobileFaceNet export, ~4 MB, or a buffalo_l w600k export, ~90 MB).
// Unset, the stage is a clean no-op and the pipeline runs on geometry alone.
// ─────────────────────────────────────────────────────────────────────────

import type { EmbeddingStage, Point } from "./types";
import { P } from "@/lib/measure";

const MODEL_URL = process.env.NEXT_PUBLIC_FACE_EMBEDDING_MODEL_URL;
/** ArcFace-family models expect a 112×112 aligned crop. */
const INPUT_SIZE = 112;

export interface EmbeddingProvider {
  readonly name: string;
  isAvailable(): boolean;
  embed(image: HTMLImageElement, landmarks: Point[]): Promise<EmbeddingStage>;
}

const EMPTY: EmbeddingStage = {
  vector: null,
  dimensions: 0,
  structuralStability: null,
  attractivenessDelta: null,
  model: null,
};

/** Default: geometry only. Honest about contributing nothing. */
class NullEmbeddingProvider implements EmbeddingProvider {
  readonly name = "none";
  isAvailable() {
    return false;
  }
  async embed(): Promise<EmbeddingStage> {
    return EMPTY;
  }
}

/**
 * Similarity-transform the face onto the canonical ArcFace template.
 *
 * Recognition models are trained on crops aligned to five reference points,
 * and feeding them an unaligned face degrades the embedding badly. Solving
 * for scale + rotation + translation from the eyes, nose and mouth corners
 * is what makes the vector comparable at all.
 */
function alignTo112(
  image: HTMLImageElement,
  lm: Point[],
  jitter = 0,
): HTMLCanvasElement | null {
  const W = image.naturalWidth;
  const H = image.naturalHeight;

  const src = [
    { x: lm[P.irisR]?.x ?? lm[P.eyeInnerR].x, y: lm[P.irisR]?.y ?? lm[P.eyeInnerR].y },
    { x: lm[P.irisL]?.x ?? lm[P.eyeInnerL].x, y: lm[P.irisL]?.y ?? lm[P.eyeInnerL].y },
    { x: lm[P.noseTip].x, y: lm[P.noseTip].y },
    { x: lm[P.mouthR].x, y: lm[P.mouthR].y },
    { x: lm[P.mouthL].x, y: lm[P.mouthL].y },
  ].map((p) => ({ x: p.x * W, y: p.y * H }));

  // Canonical ArcFace destination points for a 112×112 crop.
  const dst = [
    { x: 38.2946, y: 51.6963 },
    { x: 73.5318, y: 51.5014 },
    { x: 56.0252, y: 71.7366 },
    { x: 41.5493, y: 92.3655 },
    { x: 70.7299, y: 92.2041 },
  ];

  // Least-squares similarity transform (scale, rotation, translation).
  const n = src.length;
  const meanS = src.reduce((a, p) => ({ x: a.x + p.x / n, y: a.y + p.y / n }), { x: 0, y: 0 });
  const meanD = dst.reduce((a, p) => ({ x: a.x + p.x / n, y: a.y + p.y / n }), { x: 0, y: 0 });

  let varS = 0;
  let cov00 = 0;
  let cov01 = 0;
  for (let i = 0; i < n; i++) {
    const sx = src[i].x - meanS.x;
    const sy = src[i].y - meanS.y;
    const dx = dst[i].x - meanD.x;
    const dy = dst[i].y - meanD.y;
    varS += sx * sx + sy * sy;
    cov00 += dx * sx + dy * sy;
    cov01 += dy * sx - dx * sy;
  }
  if (varS < 1e-6) return null;

  const scale = Math.hypot(cov00, cov01) / varS;
  const angle = Math.atan2(cov01, cov00) + jitter;
  const cos = Math.cos(angle) * scale;
  const sin = Math.sin(angle) * scale;

  const canvas = document.createElement("canvas");
  canvas.width = INPUT_SIZE;
  canvas.height = INPUT_SIZE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  ctx.setTransform(
    cos,
    sin,
    -sin,
    cos,
    meanD.x - (cos * meanS.x - sin * meanS.y),
    meanD.y - (sin * meanS.x + cos * meanS.y),
  );
  ctx.drawImage(image, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return canvas;
}

function toTensorData(canvas: HTMLCanvasElement): Float32Array {
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const { data } = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);
  const out = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE);
  const plane = INPUT_SIZE * INPUT_SIZE;
  // ArcFace preprocessing: CHW, RGB, scaled to [-1, 1].
  for (let i = 0, px = 0; i < data.length; i += 4, px++) {
    out[px] = (data[i] - 127.5) / 128;
    out[plane + px] = (data[i + 1] - 127.5) / 128;
    out[2 * plane + px] = (data[i + 2] - 127.5) / 128;
  }
  return out;
}

function l2normalise(v: Float32Array): Float32Array {
  let sum = 0;
  for (const x of v) sum += x * x;
  const norm = Math.sqrt(sum) || 1;
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i] / norm;
  return out;
}

function cosine(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

/** ONNX Runtime Web, lazily loaded so the model never costs a cold page. */
class OnnxEmbeddingProvider implements EmbeddingProvider {
  readonly name = "onnx";
  private session: unknown = null;
  private failed = false;

  isAvailable() {
    return Boolean(MODEL_URL) && !this.failed;
  }

  private async getSession() {
    if (this.session) return this.session;
    const ort = await import("onnxruntime-web");
    this.session = await ort.InferenceSession.create(MODEL_URL!, {
      executionProviders: ["wasm"],
      graphOptimizationLevel: "all",
    });
    return this.session;
  }

  async embed(image: HTMLImageElement, landmarks: Point[]): Promise<EmbeddingStage> {
    if (!this.isAvailable()) return EMPTY;

    try {
      const ort = await import("onnxruntime-web");
      const session = (await this.getSession()) as import("onnxruntime-web").InferenceSession;

      const run = async (jitter: number): Promise<Float32Array | null> => {
        const canvas = alignTo112(image, landmarks, jitter);
        if (!canvas) return null;
        const tensor = new ort.Tensor("float32", toTensorData(canvas), [
          1, 3, INPUT_SIZE, INPUT_SIZE,
        ]);
        const feeds = { [session.inputNames[0]]: tensor };
        const result = await session.run(feeds);
        const raw = result[session.outputNames[0]].data as Float32Array;
        return l2normalise(raw);
      };

      const primary = await run(0);
      if (!primary) return EMPTY;

      // Stability: re-embed with a small alignment perturbation. A clean
      // capture barely moves; a soft or angled one drifts, and that drift is
      // a genuine signal about how much to trust the geometry.
      const perturbed = await run(0.035);
      const stability = perturbed
        ? Math.max(0, Math.min(1, (cosine(primary, perturbed) - 0.5) / 0.5))
        : null;

      return {
        vector: primary,
        dimensions: primary.length,
        structuralStability: stability,
        // Stays null until a regression head exists — see the header.
        attractivenessDelta: null,
        model: MODEL_URL ?? null,
      };
    } catch (err) {
      // A missing or incompatible model must degrade to geometry-only, not
      // take the whole scan down.
      console.warn("[embedding] disabled after failure:", err);
      this.failed = true;
      return EMPTY;
    }
  }
}

let provider: EmbeddingProvider | null = null;

export function embeddingProvider(): EmbeddingProvider {
  if (!provider) {
    provider = MODEL_URL ? new OnnxEmbeddingProvider() : new NullEmbeddingProvider();
  }
  return provider;
}

/** Test seam — lets a fake provider be injected without touching callers. */
export function setEmbeddingProvider(p: EmbeddingProvider) {
  provider = p;
}
