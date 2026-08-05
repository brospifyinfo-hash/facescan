// Checks the properties the pipeline architecture is supposed to guarantee.
//
// Run:  npx tsx scripts/check-pipeline.mts

import { DEFAULT_WEIGHTS, validateWeights, type ScoringWeights } from "../lib/analysis/weights";
import { ScoreEngine, WeightedScorer, type Scorer } from "../lib/analysis/engine";
import type { EmbeddingStage, GeometryStage, QualityStage } from "../lib/analysis/types";

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "  ok  " : "FAIL  "}${name}${detail ? "  — " + detail : ""}`);
  if (!ok) failures++;
};

// ---- 1. The config is internally consistent -------------------------------
const problems = validateWeights(DEFAULT_WEIGHTS);
check("default weights validate", problems.length === 0, problems.join("; "));

const broken: ScoringWeights = {
  ...DEFAULT_WEIGHTS,
  categories: { ...DEFAULT_WEIGHTS.categories, symmetry: 0.5 },
};
check("a bad sweep is caught", validateWeights(broken).length > 0);

// ---- fixtures -------------------------------------------------------------
const geometry = (base: number): GeometryStage => ({
  metrics: [],
  symmetry: base,
  categories: { eyes: base, jaw: base, proportions: base, midface: base },
  interocularPx: 120,
});

const quality = (overall: number): QualityStage => ({
  sharpness: overall, exposure: overall, noise: overall, whiteBalance: overall,
  resolution: overall, frontality: overall, occlusion: overall,
  pose: { yaw: 0, pitch: 0, roll: 0 },
  overall, issues: [],
});

const noEmbedding: EmbeddingStage = {
  vector: null, dimensions: 0, structuralStability: null,
  attractivenessDelta: null, model: null,
};

const engine = new ScoreEngine();

// ---- 2. Capture quality must not move the aesthetic score ------------------
const sharp = engine.run({ geometry: geometry(85), embedding: noEmbedding, quality: quality(0.95) });
const blurry = engine.run({ geometry: geometry(85), embedding: noEmbedding, quality: quality(0.25) });

check("bad photo does not change the score", sharp.overall === blurry.overall,
  `sharp ${sharp.overall} vs blurry ${blurry.overall}`);
check("bad photo lowers confidence", blurry.confidence < sharp.confidence,
  `${blurry.confidence} < ${sharp.confidence}`);

// ---- 3. The score still responds to the face ------------------------------
const weak = engine.run({ geometry: geometry(60), embedding: noEmbedding, quality: quality(0.9) });
const strong = engine.run({ geometry: geometry(95), embedding: noEmbedding, quality: quality(0.9) });
check("score responds to geometry", strong.overall > weak.overall,
  `${weak.overall} → ${strong.overall}`);

// ---- 4. An unfitted embedding contributes nothing -------------------------
const withEmbedding = engine.run({
  geometry: geometry(85),
  embedding: { ...noEmbedding, vector: new Float32Array(512), dimensions: 512, structuralStability: 0.9 },
  quality: quality(0.95),
});
check("embedding without a trained head leaves the score alone",
  withEmbedding.overall === sharp.overall,
  `${withEmbedding.overall} vs ${sharp.overall}`);
check("embedding stability does feed confidence",
  withEmbedding.confidence !== sharp.confidence);

// ---- 5. Weights are actually injected, not baked in ------------------------
const jawHeavy = new ScoreEngine({
  ...DEFAULT_WEIGHTS,
  categories: { symmetry: 0.1, eyes: 0.1, jaw: 0.6, proportions: 0.1, midface: 0.1 },
});
const lopsided: GeometryStage = {
  ...geometry(50),
  categories: { eyes: 50, jaw: 95, proportions: 50, midface: 50 },
};
const a = engine.run({ geometry: lopsided, embedding: noEmbedding, quality: quality(0.9) });
const b = jawHeavy.run({ geometry: lopsided, embedding: noEmbedding, quality: quality(0.9) });
check("re-weighting changes the outcome", b.overall > a.overall, `${a.overall} → ${b.overall}`);

// ---- 6. A different scorer can be dropped in ------------------------------
class ConstantScorer implements Scorer {
  readonly name = "constant-test";
  score() {
    return { overall: 7.7, harmony: 80, confidence: 1, contributions: {} };
  }
}
const swapped = engine.withScorer(new ConstantScorer());
check("scorer is swappable", swapped.run({ geometry: geometry(20), embedding: noEmbedding, quality: quality(0.1) }).overall === 7.7);
check("default scorer is the weighted one", new ScoreEngine().scorerName === new WeightedScorer().name);

console.log(`\n${failures === 0 ? "all checks passed" : failures + " FAILED"}`);
process.exit(failures === 0 ? 0 : 1);
