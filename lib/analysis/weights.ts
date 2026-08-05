// Every tunable number in the scoring system, in one place.
//
// Before this file the weights were scattered as literals across measure.ts
// and metrics.ts — `0.26 * symmetry`, `err * 340`, `off * 14`, `86 - d/tol*74`.
// Changing the balance meant hunting through the maths, and nothing could be
// swept or fitted because there was no single object to vary.
//
// Now: one config, one type. A trained regression model replaces the values
// here without touching a line of pipeline code, and scripts can sweep them.

export interface CategoryWeights {
  symmetry: number;
  eyes: number;
  jaw: number;
  proportions: number;
  midface: number;
}

export interface ScoringWeights {
  /** How the category composites roll up into `harmony`. Must sum to 1. */
  categories: CategoryWeights;

  band: {
    /** Score at the dead centre of a reference band. */
    centre: number;
    /** Score at the band edge — the taper across the band. */
    edge: number;
    /** Ceiling once a deviation runs in the flattering direction. */
    favouredCeiling: number;
    /** How far past the band the flattering direction stays unpenalised,
     *  as a multiple of the metric's tolerance. */
    favouredPlateau: number;
    /** Decay past the plateau, score points per tolerance unit. */
    favouredDecay: number;
    /** Decay in the unflattering direction, score points per tolerance. */
    penaltyDecay: number;
    /** Hard floor so one bad measurement cannot sink everything. */
    floor: number;
  };

  symmetry: {
    /** Deviation-to-penalty gain. Higher punishes asymmetry harder. */
    gain: number;
    min: number;
    max: number;
  };

  /** Maps the 0–100 composite onto the 0–10 headline figure. */
  display: {
    windowLow: number;
    windowHigh: number;
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
    /** Share from embedding stability (0 while no model is loaded). */
    fromEmbedding: number;
    /** Confidence when the embedding stage contributed nothing. */
    embeddingAbsentBaseline: number;
    /** Below this, the UI should warn rather than present a firm number. */
    warnBelow: number;
  };

  /**
   * Weight of the embedding's attractiveness contribution.
   *
   * Zero, deliberately. An identity embedding carries no attractiveness
   * direction until a regression head is trained on labelled ratings — see
   * EmbeddingStage in ./types.ts. Raising this before that model exists
   * would be adding noise and calling it signal.
   */
  embeddingContribution: number;
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  categories: {
    symmetry: 0.26,
    eyes: 0.22,
    jaw: 0.2,
    proportions: 0.2,
    midface: 0.12,
  },
  band: {
    centre: 100,
    edge: 86,
    favouredCeiling: 100,
    favouredPlateau: 0.75,
    favouredDecay: 37,
    penaltyDecay: 74,
    floor: 12,
  },
  symmetry: { gain: 340, min: 40, max: 99 },
  display: { windowLow: 70, windowHigh: 98, outLow: 3.0, outHigh: 9.5 },
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
    fromQuality: 0.75,
    fromEmbedding: 0.25,
    embeddingAbsentBaseline: 0.82,
    warnBelow: 0.55,
  },
  embeddingContribution: 0,
};

/** Sums the category weights — a sweep that breaks this should fail loudly. */
export function validateWeights(w: ScoringWeights): string[] {
  const problems: string[] = [];
  const sum = Object.values(w.categories).reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 1) > 0.001) {
    problems.push(`category weights sum to ${sum.toFixed(3)}, expected 1.000`);
  }
  const qSum = Object.values(w.quality).reduce((a, b) => a + b, 0);
  if (Math.abs(qSum - 1) > 0.001) {
    problems.push(`quality weights sum to ${qSum.toFixed(3)}, expected 1.000`);
  }
  const cSum = w.confidence.fromQuality + w.confidence.fromEmbedding;
  if (Math.abs(cSum - 1) > 0.001) {
    problems.push(`confidence weights sum to ${cSum.toFixed(3)}, expected 1.000`);
  }
  if (w.display.windowHigh <= w.display.windowLow) {
    problems.push("display window is inverted");
  }
  return problems;
}
