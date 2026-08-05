// Shared types for the hybrid analysis pipeline.
//
// The pipeline is a chain of independent stages, each producing a typed
// result the next stage can use. Nothing downstream reaches back into an
// earlier stage's internals, so any stage can be swapped without touching
// the others — that is the whole point of splitting them out.
//
//   detect → align → landmarks → geometry → embedding → quality → score

export type Point = { x: number; y: number };

/** Stage 1–3: a detected, aligned face with its landmark mesh. */
export interface FaceStage {
  /** Landmarks in normalized image space, as detected. */
  raw: Point[];
  /** Same landmarks after roll correction — what geometry measures on. */
  aligned: Point[];
  /** Roll angle removed during alignment, radians. */
  roll: number;
  imageWidth: number;
  imageHeight: number;
}

/**
 * Stage 5: embedding features.
 *
 * ⚠️ WHAT THIS IS AND IS NOT.
 *
 * A face embedding (ArcFace / buffalo_l and relatives) is an IDENTITY
 * representation. It is trained so that two photos of the same person land
 * close together regardless of pose, lighting or expression. That property
 * is exactly what makes it useful here: it gives the score a stable anchor
 * so the same face photographed twice does not drift.
 *
 * What it cannot do on its own is contribute an attractiveness judgement.
 * There is no direction in a 512-d identity space that means "more
 * attractive" until a regression head is trained on labelled ratings. Until
 * that model exists, `structuralStability` is the only thing this stage
 * feeds the engine, and `attractivenessDelta` stays null rather than
 * inventing a number.
 *
 * It is never compared against a database and never used to identify anyone.
 */
export interface EmbeddingStage {
  /** L2-normalised feature vector, or null when no model is loaded. */
  vector: Float32Array | null;
  dimensions: number;
  /**
   * 0–1. How internally consistent the embedding is across the alignment
   * variants we feed it — a proxy for "this face was captured cleanly
   * enough that the representation is trustworthy".
   */
  structuralStability: number | null;
  /** Reserved for a trained regression head. Null until one exists. */
  attractivenessDelta: number | null;
  model: string | null;
}

/** Stage 6: image quality — affects confidence, never the aesthetic score. */
export interface QualityStage {
  /** All 0–1, higher is better. */
  sharpness: number;
  /** Directional smear, separate from defocus. 1 = none. */
  motionBlur: number;
  exposure: number;
  noise: number;
  whiteBalance: number;
  resolution: number;
  frontality: number;
  occlusion: number;
  /** Estimated head pose in degrees. */
  pose: { yaw: number; pitch: number; roll: number };
  /** Weighted roll-up of the above, 0–1. */
  overall: number;
  /** Human-readable reasons the capture was poor, if any. */
  issues: QualityIssue[];
}

export type QualityIssue =
  | "blurry"
  | "motionBlur"
  | "underexposed"
  | "overexposed"
  | "noisy"
  | "colorCast"
  | "lowResolution"
  | "notFrontal"
  | "occluded";

// Stages 4, 7 and 8 own their own result types now — GeometryResult in
// ./geometry.ts, ScoreResult in ./engine.ts, PipelineResult and
// AnalysisResponse in ./analyzer.ts and ./response.ts. Keeping duplicate
// shapes here is what let the old GeometryStage drift out of step with what
// measure() actually returned.
