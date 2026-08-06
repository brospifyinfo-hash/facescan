// RecommendationEngine — turns measurements into strengths, weaknesses and
// suggestions.
//
// TWO RULES THIS FILE FOLLOWS
//
// 1. A recommendation is only emitted for something the person can
//    actually influence. Bizygomatic width is bone. Telling someone to
//    change it is not advice, it is an invitation to feel bad about a
//    number, and it is the reason products like this get a bad name. Fixed
//    measurements can still appear as a weakness — that is a measurement —
//    but they produce `changeable: false` and no action.
//
// 2. Nothing medical or procedural is suggested. The actions are limited to
//    capture, grooming, posture and expression, which are the categories
//    where the measurement genuinely moves for a non-cosmetic reason.
//
// The ranking is by |z| — how unusual the measurement is against the
// population norm — so what surfaces is what actually stands out, not what
// a hand-written priority list decided in advance.

import { NORMS, type MeasurementId } from "./norms";
import type { MeasurementScore, ModuleResult } from "./modules";

export interface Finding {
  id: MeasurementId;
  /** Distance from the reference in population SD. */
  z: number;
  score: number;
  /** Whether behaviour, grooming or capture can move this measurement. */
  changeable: boolean;
}

export interface Recommendation {
  /** Stable key — the UI supplies the wording from its dictionary. */
  key: string;
  /** Measurement that triggered it. */
  source: MeasurementId;
  /** How far off the measurement was, in SD. */
  magnitude: number;
}

/**
 * Which measurements can move without surgery, and what moves them.
 *
 * Everything absent from this map is skeletal or cartilaginous and is
 * therefore reported but never actioned.
 */
export const ACTIONABLE: Partial<Record<MeasurementId, string>> = {
  // Expression and lid position, not anatomy.
  eyeAspect: "eyeOpenness",
  browPosition: "browGrooming",
  // Puffiness and fluid retention genuinely move the lower face outline.
  jawWidth: "lowerFaceDefinition",
  gonialAngle: "lowerFaceDefinition",
  // Lip posture at rest changes both of these measurably between photos.
  lipRatio: "lipRest",
  philtrumRatio: "lipRest",
  // Head tilt changes the apparent thirds; a level camera is the fix.
  thirds: "cameraHeight",
  // Asymmetry has a real postural component (habitual head tilt, chewing
  // side) on top of the fixed anatomical part.
  symmetryDeviation: "postureAndCamera",
};

export class RecommendationEngine {
  /**
   * @param topN how many findings of each kind to return.
   */
  build(modules: ModuleResult[], topN = 4) {
    const all: MeasurementScore[] = modules
      .flatMap((m) => m.measurements)
      .filter((m) => m.used && Number.isFinite(m.z));

    const toFinding = (m: MeasurementScore): Finding => ({
      id: m.id,
      z: Number(m.z.toFixed(2)),
      score: Number(m.score.toFixed(1)),
      changeable: m.id in ACTIONABLE,
    });

    // Strengths: closest to the reference. Weaknesses: furthest.
    const byCloseness = [...all].sort((a, b) => Math.abs(a.z) - Math.abs(b.z));
    const strengths = byCloseness.slice(0, topN).map(toFinding);
    const weaknesses = [...byCloseness].reverse().slice(0, topN).map(toFinding);

    // One recommendation per actionable weakness, strongest deviation
    // first, de-duplicated by key so "lipRest" cannot appear twice.
    const seen = new Set<string>();
    const recommendations: Recommendation[] = [];
    for (const w of weaknesses) {
      const key = ACTIONABLE[w.id];
      if (!key || seen.has(key)) continue;
      seen.add(key);
      recommendations.push({ key, source: w.id, magnitude: Math.abs(w.z) });
    }

    return { strengths, weaknesses, recommendations };
  }

  /** The published basis of a measurement, for the explainability payload. */
  static provenance(id: MeasurementId) {
    const n = NORMS[id];
    return { grade: n.grade, mean: n.mean, sd: n.sd, note: n.note };
  }
}

export const recommendationEngine = new RecommendationEngine();
