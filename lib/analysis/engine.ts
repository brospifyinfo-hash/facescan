// Stage 7: the score engine.
//
// DECOUPLED FROM LANDMARKS, as required. The engine's input is a
// FeatureVector — a flat map of named numbers — plus a set of already
// evaluated modules. It never sees a landmark, never knows MediaPipe
// exists, and cannot reach into geometry. That is what lets a trained
// regression head replace it: implement `Scorer`, accept the same feature
// vector, return the same shape.
//
// HOW THE COMPOSITE WORKS
// -----------------------
// Old: a fixed weighted sum of five category averages. If a category could
// not be computed it still contributed — as a zero or as a floor value —
// so a failed measurement silently dragged the whole score down.
//
// New: a CONFIDENCE-WEIGHTED mean.
//
//     composite = Σ(wᵢ · cᵢ · sᵢ) / Σ(wᵢ · cᵢ)
//
// A module that could not be evaluated has cᵢ = 0 and drops out of both
// sums, so the composite becomes the honest average of what was actually
// measurable rather than an average padded with guesses. This is also what
// lets `hair` be declared and left unimplemented without corrupting the
// score — see RESERVED_MODULES.

import type { MeasurementId } from "./norms";
import {
  MODULE_IDS, evaluateGeometryModules, meanAbsZFromComposite,
  type ModuleId, type ModuleResult,
} from "./modules";
import { DEFAULT_WEIGHTS, type ScoringWeights } from "./weights";
import { percentileOfComposite } from "./composite-cdf";

/**
 * The engine's entire view of a face: named numbers.
 *
 * Anything that can produce these can be scored — landmarks today, a
 * depth sensor or a CNN feature map tomorrow.
 */
export type FeatureVector = Partial<Record<MeasurementId, number>> &
  Record<string, number | undefined>;

/**
 * Modules named in the product spec that cannot be measured from a single
 * RGB photo with the models available on-device.
 *
 * `hair` needs semantic segmentation to separate hairline, density and
 * style from the background; nothing in the bundle does that, and
 * estimating it from the face oval would be fabrication. It is declared
 * here so the architecture is complete and so its absence is visible in the
 * output rather than silently missing.
 */
export const RESERVED_MODULES: Partial<Record<string, string>> = {
  hair: "requires hair segmentation; no on-device model is loaded",
};

export interface ScoreInput {
  features: FeatureVector;
  /** Measurements whose raw value was implausible; dropped, not scored. */
  implausible: MeasurementId[];
  /** Modules supplied by non-geometry analyzers (skin, embedding, …). */
  external: Partial<Record<ModuleId, ModuleResult>>;
  /** 0–1 capture quality. Feeds confidence only — never the score. */
  qualityOverall: number;
  /** 0–1 embedding stability, or null when no model is loaded. */
  embeddingStability: number | null;
  /** False when depth was unusable and pose could not be compensated. */
  poseCompensated: boolean;
}

export interface ScoreResult {
  /** 0–10 headline. Linear in population percentile. */
  overall: number;
  /** 0–100 composite before the display mapping. */
  composite: number;
  /** Share of the modelled population scoring below this face, 0–100. */
  percentile: number;
  /** 0–1. How much the reading is worth trusting. */
  confidence: number;
  modules: ModuleResult[];
  /** Share of the composite each module actually contributed. */
  contributions: Record<string, number>;
}

export interface Scorer {
  readonly name: string;
  score(input: ScoreInput, weights: ScoringWeights): ScoreResult;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Current implementation: confidence-weighted module aggregation. */
export class WeightedScorer implements Scorer {
  readonly name = "weighted-v2";

  score(input: ScoreInput, w: ScoringWeights): ScoreResult {
    const geometryModules = evaluateGeometryModules(
      input.features as Record<MeasurementId, number>,
      input.implausible,
      w.modules,
    );

    const modules: ModuleResult[] = MODULE_IDS.map((id) => {
      const found = geometryModules[id] ?? input.external[id];
      return (
        found ?? {
          id,
          score: null,
          confidence: 0,
          weight: w.modules[id],
          measurements: [],
          unavailable: "no analyzer produced this module",
        }
      );
    });

    let num = 0;
    let den = 0;
    const contributions: Record<string, number> = {};
    for (const m of modules) {
      const effective = m.weight * m.confidence;
      if (m.score === null || effective <= 0) {
        contributions[m.id] = 0;
        continue;
      }
      num += effective * m.score;
      den += effective;
      contributions[m.id] = effective;
    }
    // Normalise contributions to shares so they are readable.
    if (den > 0) {
      for (const k of Object.keys(contributions)) contributions[k] /= den;
    }

    // No module survived: report the neutral midpoint and zero confidence
    // rather than a number that looks like a verdict.
    const composite = den > 0 ? num / den : 50;

    // The headline is anchored on MEAN SD-DISTANCE, not on a percentile of
    // the simulated population. That anchoring was the defect that made the
    // product useless: the population is simulated from the same norms that
    // score, so it contains no face carrying a systematic measurement
    // offset — and every real photo, of any face, fell below its first
    // percentile and was clamped to exactly 1.0.
    //
    // SD-distance cannot floor out. A face two SD off the reference scores
    // 5.0 whether or not the reference itself is well calibrated, and two
    // different faces still get two different numbers.
    const { outLow, outHigh, perSd } = w.display;
    const meanAbsZ = meanAbsZFromComposite(composite);
    const overall = Number(
      clamp(outHigh - perSd * meanAbsZ, outLow, outHigh).toFixed(1),
    );

    // Kept for the badge, and labelled there as modelled rather than real.
    const percentile = percentileOfComposite(composite);

    // ---- Confidence --------------------------------------------------------
    // Three independent sources, and only these move it. Capture quality
    // says how good the photo was; geometry coverage says how much of the
    // face could actually be measured; embedding stability says whether the
    // representation was consistent under small alignment changes.
    const c = w.confidence;
    const totalWeight = MODULE_IDS.reduce((s, id) => s + w.modules[id], 0) || 1;
    const geometryCoverage = clamp(den / totalWeight, 0, 1);
    const embeddingTerm = input.embeddingStability ?? c.embeddingAbsentBaseline;

    let confidence =
      input.qualityOverall * c.fromQuality +
      geometryCoverage * c.fromGeometry +
      embeddingTerm * c.fromEmbedding;

    // Without depth the pose correction did not run, so the measurements
    // carry whatever rotation the photo had. That is a real loss of
    // certainty and is stated as one.
    if (!input.poseCompensated) confidence *= 1 - c.posePenalty;

    return {
      overall,
      composite,
      percentile: Number(percentile.toFixed(1)),
      confidence: Number(clamp(confidence, 0, 1).toFixed(3)),
      modules,
      contributions,
    };
  }
}

/**
 * Seam for a trained model.
 *
 * A regression head fitted on SCUT-FBP5500 implements `Scorer`, reads the
 * same FeatureVector, and is swapped in with `engine.withScorer(...)`.
 * Nothing upstream changes. See ./training.ts.
 */
export class ScoreEngine {
  constructor(
    private readonly weights: ScoringWeights = DEFAULT_WEIGHTS,
    private readonly scorer: Scorer = new WeightedScorer(),
  ) {}

  get scorerName() {
    return this.scorer.name;
  }

  get activeWeights() {
    return this.weights;
  }

  run(input: ScoreInput): ScoreResult {
    return this.scorer.score(input, this.weights);
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
