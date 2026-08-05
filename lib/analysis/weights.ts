// Every tunable number in the scoring system, in one place.
//
// The previous version of this file held eleven constants describing a
// band-and-tolerance scorer that no longer exists (centre 100, edge 86,
// plateau 0.75, favouredDecay 37, penaltyDecay 74, floor 12, symmetry gain
// 340 …). None of them had a derivation, and together they decided how
// harsh the product was. They are gone.
//
// What remains is of three kinds, and the distinction matters:
//
//   MODULE WEIGHTS  — a design choice about what the score is *about*.
//                     No measurement can tell you these; they are the
//                     honest place for judgement, and they are exactly what
//                     a regression fit on SCUT-FBP5500 would replace.
//   DISPLAY MAPPING — DERIVED, not chosen. The composite is converted to a
//                     population percentile through the generated
//                     COMPOSITE_CDF, then stretched onto 0–10. Only the two
//                     endpoints live here.
//   QUALITY/CONF    — how capture quality rolls into confidence. Weights
//                     reflect how strongly each defect degrades landmark
//                     accuracy.
//
// The kernel constant TOLERANCE_SD lives in modules.ts next to the maths it
// parameterises.

import type { ModuleId } from "./modules";

export interface ScoringWeights {
  /**
   * Share of the composite per module. Modules at 0 are measured and
   * reported but do not move the score — see the note on each.
   */
  modules: Record<ModuleId, number>;

  /**
   * Maps the population percentile onto the 0–10 headline. The
   * composite→percentile step is COMPOSITE_CDF (generated from the norms),
   * so these two numbers are the whole of the display policy.
   */
  display: {
    outLow: number;
    outHigh: number;
  };

  /** How capture quality rolls up into a single 0–1 figure. */
  quality: {
    sharpness: number;
    exposure: number;
    noise: number;
    whiteBalance: number;
    resolution: number;
    frontality: number;
    occlusion: number;
  };

  confidence: {
    /** Share of confidence that comes from capture quality. */
    fromQuality: number;
    /** Share from how much of the geometry could actually be evaluated. */
    fromGeometry: number;
    /** Share from embedding stability. */
    fromEmbedding: number;
    /** Confidence contributed when no embedding model is loaded. */
    embeddingAbsentBaseline: number;
    /** Multiplier applied when pose could not be compensated (no depth). */
    posePenalty: number;
    /** Below this the UI warns rather than presenting a firm number. */
    warnBelow: number;
  };
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  modules: {
    // Symmetry is the most reproducible thing a frontal photo can measure
    // and the one direction the attractiveness literature agrees on across
    // sexes and populations — a large share, still short of dominating.
    symmetry: 0.22,
    // The largest group of well-sourced measurements (8), most graded
    // "derived" from Farkas norms.
    proportions: 0.24,
    jaw: 0.16,
    eyes: 0.18,
    nose: 0.08,
    lips: 0.08,
    // Real pixel statistics, but heavily confounded by lighting and
    // make-up. Small weight, and its own confidence gates it further.
    skin: 0.04,
    // Reported for explainability only. There is no evidence base for
    // ranking face shapes, so ranking them would be inventing a rule.
    faceShape: 0,
    // Zero until a regression head exists that maps an embedding to a
    // rating. An identity embedding carries no attractiveness direction, so
    // any non-zero weight here today would be noise dressed as signal.
    embedding: 0,
  },

  // The headline is the population percentile stretched onto 1.0-10.0, so
  // the median face scores 5.5 by construction and one point of difference
  // means the same amount of rarity everywhere on the scale.
  display: {
    outLow: 1.0,
    outHigh: 10.0,
  },

  quality: {
    sharpness: 0.24,
    exposure: 0.16,
    noise: 0.1,
    whiteBalance: 0.06,
    resolution: 0.16,
    frontality: 0.18,
    occlusion: 0.1,
  },

  confidence: {
    fromQuality: 0.5,
    fromGeometry: 0.3,
    fromEmbedding: 0.2,
    embeddingAbsentBaseline: 0.82,
    posePenalty: 0.15,
    warnBelow: 0.55,
  },
};

export interface WeightProblem {
  field: string;
  problem: string;
}

export function validateWeights(
  w: ScoringWeights = DEFAULT_WEIGHTS,
): WeightProblem[] {
  const problems: WeightProblem[] = [];
  const near = (v: number, t: number) => Math.abs(v - t) < 1e-6;

  const mSum = Object.values(w.modules).reduce((a, b) => a + b, 0);
  if (!near(mSum, 1)) {
    problems.push({
      field: "modules",
      problem: `weights sum to ${mSum.toFixed(4)}, expected 1.0000`,
    });
  }
  for (const [id, v] of Object.entries(w.modules)) {
    if (v < 0) problems.push({ field: `modules.${id}`, problem: "negative weight" });
  }

  const qSum = Object.values(w.quality).reduce((a, b) => a + b, 0);
  if (!near(qSum, 1)) {
    problems.push({
      field: "quality",
      problem: `weights sum to ${qSum.toFixed(4)}, expected 1.0000`,
    });
  }

  const c = w.confidence;
  const cSum = c.fromQuality + c.fromGeometry + c.fromEmbedding;
  if (!near(cSum, 1)) {
    problems.push({
      field: "confidence",
      problem: `source weights sum to ${cSum.toFixed(4)}, expected 1.0000`,
    });
  }

  if (w.display.outHigh <= w.display.outLow) {
    problems.push({ field: "display", problem: "output range is inverted" });
  }

  return problems;
}
