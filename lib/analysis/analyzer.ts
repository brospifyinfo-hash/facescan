// FaceAnalyzer — the pipeline, stages 1-8.
//
//   1 Face detection      MediaPipe FaceLandmarker (lib/analysis.ts)
//   2 Face alignment      landmarks.align — roll removed, then yaw/pitch
//                         de-rotated in 3D using the depth channel
//   3 Landmark detection  the 478-point mesh, neighbour-averaged
//   4 Geometric analysis  GeometryAnalyzer
//   5 Embedding analysis  EmbeddingAnalyzer (no-op without a model)
//   6 Image quality       QualityAnalyzer + SkinAnalyzer
//   7 Score engine        ScoreEngine
//   8 Output              ResponseBuilder
//
// MediaPipe was extended, not replaced: stages 1 and 3 are still its mesh.
// Everything downstream was rebuilt around it.
//
// This module orchestrates only. Each stage lives in its own file and can
// be swapped without the others noticing, which is what makes a trained
// regression head a drop-in replacement for stage 7.

import { geometryAnalyzer, type GeometryResult } from "./geometry";
import { analyzeQuality } from "./quality";
import { skinAnalyzer, type SkinResult } from "./skin";
import { embeddingProvider } from "./embedding";
import { defaultEngine, ScoreEngine, type ScoreResult } from "./engine";
import { recommendationEngine } from "./recommendations";
import { buildResponse, type AnalysisResponse } from "./response";
import type { ModuleId, ModuleResult } from "./modules";
import { DEFAULT_WEIGHTS, type ScoringWeights } from "./weights";
import type { Point3 } from "./landmarks";
import type { EmbeddingStage, QualityStage } from "./types";

export interface AnalyzeOptions {
  weights?: ScoringWeights;
  engine?: ScoreEngine;
  /** Skip the embedding stage even when a model is configured. */
  skipEmbedding?: boolean;
  /** Skip pixel-level skin analysis (it is the slowest stage). */
  skipSkin?: boolean;
}

export interface PipelineResult {
  geometry: GeometryResult;
  quality: QualityStage;
  skin: SkinResult | null;
  embedding: EmbeddingStage;
  score: ScoreResult;
  response: AnalysisResponse;
}

export class FaceAnalyzer {
  constructor(private readonly engine: ScoreEngine = defaultEngine) {}

  async run(
    image: HTMLImageElement,
    landmarks: Point3[],
    options: AnalyzeOptions = {},
  ): Promise<PipelineResult> {
    const weights = options.weights ?? DEFAULT_WEIGHTS;
    const engine = options.engine ?? this.engine;

    // ---- Stages 2-4: alignment, landmarks, geometry ------------------------
    const geometry = geometryAnalyzer.analyze(landmarks);

    // ---- Stage 6a: capture quality ----------------------------------------
    // Runs before the embedding because its noise/exposure figures feed the
    // skin analyzer, and before scoring because it feeds confidence.
    const interocularPx = Math.round(geometry.ipd * image.naturalWidth);
    const quality = analyzeQuality(
      image,
      {
        raw: landmarks,
        aligned: geometry.aligned.points,
        roll: geometry.aligned.pose.roll,
        pose: geometry.aligned.pose,
      },
      interocularPx,
      weights,
    );

    // ---- Stage 5: embedding ------------------------------------------------
    const embedding: EmbeddingStage = options.skipEmbedding
      ? {
          vector: null,
          dimensions: 0,
          structuralStability: null,
          attractivenessDelta: null,
          model: null,
        }
      : await embeddingProvider().embed(image, landmarks);

    // ---- Stage 6b: skin ----------------------------------------------------
    const skin = options.skipSkin
      ? null
      : skinAnalyzer.analyze(
          image,
          landmarks,
          geometry.ipd,
          quality.noise,
          quality.exposure,
        );

    // ---- Stage 7: score ----------------------------------------------------
    const external: Partial<Record<ModuleId, ModuleResult>> = {};
    if (skin) {
      external.skin = {
        id: "skin",
        score: skin.score,
        confidence: skin.confidence,
        weight: weights.modules.skin,
        measurements: [],
      };
    }
    // faceShape is measured and reported but carries weight 0, so it is
    // registered with full confidence and simply never moves the composite.
    external.faceShape = {
      id: "faceShape",
      score: null,
      confidence: 0,
      weight: weights.modules.faceShape,
      measurements: [],
      unavailable: "reported for explainability; not scored",
    };

    const score = engine.run({
      features: geometry.values,
      implausible: geometry.implausible,
      external,
      qualityOverall: quality.overall,
      embeddingStability: embedding.structuralStability,
      poseCompensated: geometry.aligned.poseCompensated,
    });

    // ---- Stage 8: output ---------------------------------------------------
    const explain = recommendationEngine.build(score.modules);
    const response = buildResponse({ geometry, quality, skin, score, explain });

    return { geometry, quality, skin, embedding, score, response };
  }
}

export const faceAnalyzer = new FaceAnalyzer();
