// Stage 7: the score engine.
//
// One class, one entry point, zero magic numbers — every constant it uses
// comes from the injected ScoringWeights. That is what makes it replaceable:
// a trained regression model implements the same `Scorer` interface and gets
// swapped in without any caller changing.
//
// The engine deliberately keeps aesthetics and confidence apart. Capture
// quality can say "trust this less"; it can never say "this face is worse".
// Letting a blurry photo lower the score would mean the product punishes
// people for their camera.

import { clamp, type Metric } from "@/lib/metrics";
import type {
  EmbeddingStage,
  GeometryStage,
  QualityStage,
  ScoreStage,
} from "./types";
import { DEFAULT_WEIGHTS, type ScoringWeights } from "./weights";

export interface ScorerInput {
  geometry: GeometryStage;
  embedding: EmbeddingStage;
  quality: QualityStage;
}

/**
 * The seam a trained model plugs into.
 *
 * A regression head over [geometric features ‖ embedding] implements this
 * and replaces WeightedScorer entirely. Nothing else in the pipeline needs
 * to know which one is running.
 */
export interface Scorer {
  readonly name: string;
  score(input: ScorerInput, weights: ScoringWeights): ScoreStage;
}

/** Current implementation: an explicit weighted sum. */
export class WeightedScorer implements Scorer {
  readonly name = "weighted-v1";

  score(input: ScorerInput, w: ScoringWeights): ScoreStage {
    const { geometry, embedding, quality } = input;
    const c = w.categories;

    const contributions: Record<string, number> = {
      symmetry: geometry.symmetry * c.symmetry,
      eyes: geometry.categories.eyes * c.eyes,
      jaw: geometry.categories.jaw * c.jaw,
      proportions: geometry.categories.proportions * c.proportions,
      midface: geometry.categories.midface * c.midface,
    };

    let harmonyRaw = Object.values(contributions).reduce((a, b) => a + b, 0);

    // Only applies once a regression head exists; the default weight is 0,
    // so today this is a no-op rather than noise dressed up as signal.
    if (embedding.attractivenessDelta !== null && w.embeddingContribution > 0) {
      const delta = embedding.attractivenessDelta * w.embeddingContribution;
      contributions.embedding = delta;
      harmonyRaw += delta;
    }

    const harmony = Math.round(clamp(harmonyRaw, 30, 99));

    const { windowLow, windowHigh, outLow, outHigh } = w.display;
    const spread =
      ((harmony - windowLow) / (windowHigh - windowLow)) * (outHigh - outLow) + outLow;
    const overall = Number(clamp(spread, 1, 10).toFixed(1));

    // Confidence, and only confidence, listens to capture quality.
    const conf = w.confidence;
    const embeddingTerm =
      embedding.structuralStability ?? conf.embeddingAbsentBaseline;
    const confidence = Number(
      clamp(
        quality.overall * conf.fromQuality + embeddingTerm * conf.fromEmbedding,
        0,
        1,
      ).toFixed(3),
    );

    return { overall, harmony, confidence, contributions };
  }
}

export class ScoreEngine {
  constructor(
    private readonly weights: ScoringWeights = DEFAULT_WEIGHTS,
    private readonly scorer: Scorer = new WeightedScorer(),
  ) {}

  get scorerName() {
    return this.scorer.name;
  }

  run(input: ScorerInput): ScoreStage {
    return this.scorer.score(input, this.weights);
  }

  /** Roll up per-metric scores into a category composite. */
  static categoryScore(metrics: Metric[], category: string): number {
    const picked = metrics.filter((m) => m.category === category);
    if (picked.length === 0) return 0;
    return Math.round(
      picked.reduce((s, m) => s + m.score, 0) / picked.length,
    );
  }

  /** Same weights, different scorer — for A/B-ing a trained model. */
  withScorer(scorer: Scorer): ScoreEngine {
    return new ScoreEngine(this.weights, scorer);
  }

  /** Same scorer, different weights — for sweeps. */
  withWeights(weights: ScoringWeights): ScoreEngine {
    return new ScoreEngine(weights, this.scorer);
  }
}

export const defaultEngine = new ScoreEngine();
