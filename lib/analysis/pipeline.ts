// The hybrid pipeline: detect → align → landmarks → geometry → embedding →
// quality → score.
//
// This module only orchestrates. Every stage lives in its own file and can
// be replaced without the others noticing — which is the point of splitting
// them up, and what makes a trained model droppable later.
//
// MediaPipe was kept, not replaced: its 478-point mesh is what stages 3 and
// 4 run on. The additions sit around it.

import { measure } from "@/lib/measure";
import { analyzeQuality } from "./quality";
import { embeddingProvider } from "./embedding";
import { defaultEngine, ScoreEngine } from "./engine";
import type { FaceStage, GeometryStage, PipelineResult, Point } from "./types";
import { DEFAULT_WEIGHTS, type ScoringWeights } from "./weights";

export interface PipelineOptions {
  weights?: ScoringWeights;
  engine?: ScoreEngine;
  /** Skip the embedding stage even when a model is configured. */
  skipEmbedding?: boolean;
}

/**
 * Run the full analysis.
 *
 * `landmarks` come from the detector (stage 1–3); everything after is this
 * module's job. Splitting it this way keeps the pipeline testable in plain
 * Node — measure(), analyzeQuality() and the engine all take plain data.
 */
export async function runPipeline(
  image: HTMLImageElement,
  landmarks: Point[],
  options: PipelineOptions = {},
): Promise<PipelineResult> {
  const weights = options.weights ?? DEFAULT_WEIGHTS;
  const engine = options.engine ?? defaultEngine;

  // ---- Stage 4: geometry (also performs the roll alignment) --------------
  const measured = measure(landmarks);

  const face: FaceStage = {
    raw: landmarks,
    aligned: measured.aligned,
    roll: measured.roll,
    imageWidth: image.naturalWidth,
    imageHeight: image.naturalHeight,
  };

  const geometry: GeometryStage = {
    metrics: measured.metrics,
    symmetry: measured.symmetry,
    categories: {
      eyes: measured.eyesScore,
      jaw: measured.jawScore,
      proportions: measured.proportionsScore,
      midface: measured.midfaceScore,
    },
    interocularPx: Math.round(measured.intercanthal * image.naturalWidth),
  };

  // ---- Stage 5: embedding ------------------------------------------------
  // Runs in parallel with nothing else, but is awaited before scoring so the
  // stability figure can feed confidence. A missing model is not an error.
  const embedding = options.skipEmbedding
    ? {
        vector: null,
        dimensions: 0,
        structuralStability: null,
        attractivenessDelta: null,
        model: null,
      }
    : await embeddingProvider().embed(image, landmarks);

  // ---- Stage 6: capture quality -----------------------------------------
  const quality = analyzeQuality(image, face, geometry.interocularPx, weights);

  // ---- Stage 7: score ----------------------------------------------------
  const score = engine.run({ geometry, embedding, quality });

  return { face, geometry, embedding, quality, score };
}
