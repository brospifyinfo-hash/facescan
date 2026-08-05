// The seam a trained model plugs into — and a working fit for it.
//
// The requirement was that the architecture must accept a regression model
// later without a rewrite. That is satisfied by `Scorer`: anything
// implementing it can replace WeightedScorer through
// `engine.withScorer(...)`, and nothing upstream changes.
//
// This file makes that concrete rather than aspirational. It contains:
//
//   * FEATURE_ORDER  — the fixed feature layout, so a model trained offline
//                      and the runtime agree on what column 7 means.
//   * toFeatureRow   — FeatureVector → z-scored row, the same normalisation
//                      at fit time and at inference time. Getting this
//                      wrong in two places is the classic way a model that
//                      scored well offline behaves badly in production.
//   * fitRidge       — closed-form ridge regression. Real, not a stub;
//                      given (X, y) it returns coefficients.
//   * RegressionScorer — loads coefficients and implements Scorer.
//
// WHAT IS DELIBERATELY NOT HERE
// -----------------------------
// No dataset is bundled and none is downloaded. SCUT-FBP5500 (5500 faces,
// 5 raters each, 1-5 Likert) and SCUT-FBP (500 faces) are distributed under
// licences that require the user to request access; CelebA is attribute-only
// and carries no attractiveness rating usable as a regression target beyond
// a single binary flag. So `loadRatings` is an interface, and the adapter
// below describes the exact file format expected once a licensed copy is on
// disk. Fabricating training data would be worse than having none.
//
// A CAVEAT THAT SURVIVES ANY AMOUNT OF TRAINING: SCUT-FBP5500's raters were
// predominantly young Chinese adults, and its subjects are split Asian and
// Caucasian. A model fitted on it reproduces those raters' preferences —
// including their demographic biases — and calling the output objective
// would be false. It is a model of a particular rating panel.

import { NORMS, MEASUREMENT_IDS, type MeasurementId } from "./norms";
import { referenceOf } from "./modules";
import type { FeatureVector, ScoreInput, ScoreResult, Scorer } from "./engine";
import { WeightedScorer } from "./engine";
import type { ScoringWeights } from "./weights";
import { percentileOfComposite } from "./composite-cdf";

/** Fixed column order. Never reorder — saved coefficients depend on it. */
export const FEATURE_ORDER: MeasurementId[] = [...MEASUREMENT_IDS].sort();

/**
 * FeatureVector → model input row.
 *
 * Each measurement becomes its z-distance from the reference, so every
 * column is unit-variance and the coefficients are directly comparable.
 * Missing or implausible values become 0 — the reference itself — which is
 * the least informative substitute available.
 */
export function toFeatureRow(features: FeatureVector, implausible: MeasurementId[] = []) {
  const dropped = new Set(implausible);
  return FEATURE_ORDER.map((id) => {
    const v = features[id];
    if (v === undefined || !Number.isFinite(v) || dropped.has(id)) return 0;
    const n = NORMS[id];
    return (v - referenceOf(n)) / n.sd;
  });
}

export interface RatedSample {
  /** Measurements for one face, in the same units geometry produces. */
  features: FeatureVector;
  /** Mean human rating. Any scale; the fit learns the intercept. */
  rating: number;
}

/**
 * Expected on-disk format once a licensed dataset is available:
 *
 *   data/scut-fbp5500.jsonl — one JSON object per line:
 *     {"image":"CF1.jpg","rating":3.4,"features":{"esr":0.455, …}}
 *
 * Produce it by running the geometry stage over the dataset images and
 * pairing each row with its mean rating from the dataset's label file.
 */
export interface RatingsSource {
  load(): Promise<RatedSample[]>;
}

export interface RidgeModel {
  /** One per FEATURE_ORDER column. */
  coefficients: number[];
  intercept: number;
  /** L2 penalty the fit used. */
  lambda: number;
  /** Held-out metrics, so a bad model cannot be shipped unknowingly. */
  validation: { n: number; rmse: number; pearson: number };
  /** Free-text provenance: dataset, date, rater population. */
  provenance: string;
}

/**
 * Ridge regression, closed form: β = (XᵀX + λI)⁻¹ Xᵀy.
 *
 * Ridge rather than plain least squares because the features are strongly
 * correlated (bizygomaticRatio, facialIndex and faceLength all involve face
 * width), which makes XᵀX ill-conditioned and OLS coefficients unstable.
 * The intercept is not penalised — it is fitted by centring y.
 */
export function fitRidge(rows: number[][], y: number[], lambda = 1): {
  coefficients: number[];
  intercept: number;
} {
  const n = rows.length;
  if (n === 0) throw new Error("fitRidge: no samples");
  const p = rows[0].length;

  const yMean = y.reduce((s, v) => s + v, 0) / n;
  const yc = y.map((v) => v - yMean);

  // XᵀX + λI
  const a: number[][] = Array.from({ length: p }, () => new Array(p).fill(0));
  const b: number[] = new Array(p).fill(0);
  for (let i = 0; i < n; i++) {
    const row = rows[i];
    for (let j = 0; j < p; j++) {
      b[j] += row[j] * yc[i];
      for (let k = j; k < p; k++) a[j][k] += row[j] * row[k];
    }
  }
  for (let j = 0; j < p; j++) {
    a[j][j] += lambda;
    for (let k = 0; k < j; k++) a[j][k] = a[k][j];
  }

  // Gauss-Jordan with partial pivoting.
  const m = a.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < p; col++) {
    let pivot = col;
    for (let r = col + 1; r < p; r++) {
      if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
    }
    if (Math.abs(m[pivot][col]) < 1e-12) continue;
    [m[col], m[pivot]] = [m[pivot], m[col]];
    const d = m[col][col];
    for (let c = col; c <= p; c++) m[col][c] /= d;
    for (let r = 0; r < p; r++) {
      if (r === col) continue;
      const f = m[r][col];
      if (f === 0) continue;
      for (let c = col; c <= p; c++) m[r][c] -= f * m[col][c];
    }
  }

  return { coefficients: m.map((row) => row[p]), intercept: yMean };
}

export function pearson(a: number[], b: number[]): number {
  const n = a.length;
  const ma = a.reduce((s, v) => s + v, 0) / n;
  const mb = b.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return num / (Math.sqrt(da * db) || 1e-12);
}

/**
 * A fitted model, in the shape the engine expects.
 *
 * Falls back to WeightedScorer for confidence and module breakdown: the
 * regression predicts a composite, it does not predict how much of the face
 * was measurable or how good the photo was. Those remain the geometry and
 * quality stages' jobs, which is why they were kept separate.
 */
export class RegressionScorer implements Scorer {
  readonly name: string;
  private readonly fallback = new WeightedScorer();

  constructor(private readonly model: RidgeModel) {
    this.name = `ridge-${model.validation.n}-r${model.validation.pearson.toFixed(2)}`;
  }

  score(input: ScoreInput, weights: ScoringWeights): ScoreResult {
    const base = this.fallback.score(input, weights);
    const row = toFeatureRow(input.features, input.implausible);

    let composite = this.model.intercept;
    for (let i = 0; i < row.length; i++) {
      composite += row[i] * (this.model.coefficients[i] ?? 0);
    }

    const { outLow, outHigh } = weights.display;
    const percentile = percentileOfComposite(composite);
    const overall = Number(
      Math.max(1, Math.min(10, outLow + (percentile / 100) * (outHigh - outLow))).toFixed(1),
    );

    return { ...base, overall, composite, percentile: Number(percentile.toFixed(1)) };
  }
}
