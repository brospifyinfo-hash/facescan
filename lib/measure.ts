// Adapter between the analysis engine and the dashboard's data shape.
//
// This file used to BE the model: it computed the geometry, composited the
// categories and produced the headline, all inline. Every one of those jobs
// now belongs to a named analyzer in lib/analysis/, and this is what is
// left — a translation from the engine's output into the fifteen display
// metrics and five category rings the UI renders.
//
// Keeping the translation in one small file is deliberate. The UI shape and
// the model shape are different things and change for different reasons;
// when they were the same object, every scoring change was a UI change.

import { geometryAnalyzer } from "./analysis/geometry";
import { WeightedScorer, type ScoreResult } from "./analysis/engine";
import { DEFAULT_WEIGHTS } from "./analysis/weights";
import type { ModuleId } from "./analysis/modules";
import type { Point3 } from "./analysis/landmarks";
import { makeMetric, METRIC_ORDER } from "./specs";
import type { CategoryId, Metric } from "./metrics";

export type { Point3 } from "./analysis/landmarks";
export type Point = { x: number; y: number };
export { P, dist, vdist, rotate } from "./analysis/landmarks";

export interface Measured {
  metrics: Metric[];
  symmetry: number;
  eyesScore: number;
  jawScore: number;
  proportionsScore: number;
  midfaceScore: number;
  harmony: number;
  overall: number;
  weakest: Metric["id"][];
  intercanthal: number;
}

/** 0–100 module score, or a neutral 50 when the module was unavailable. */
function moduleScore(score: ScoreResult, id: ModuleId): number {
  const m = score.modules.find((x) => x.id === id);
  return m?.score == null ? 50 : Math.round(m.score);
}

/**
 * Run the geometry and scoring stages over a landmark mesh.
 *
 * `flat` accepts 2D points for callers that have no depth (the demo path
 * and the population simulation); z then defaults to 0, alignment reports
 * `poseCompensated: false`, and confidence is reduced accordingly.
 */
export function measure(flat: Array<Point | Point3>): Measured {
  const pts: Point3[] = flat.map((p) => ({
    x: p.x,
    y: p.y,
    z: "z" in p ? p.z : 0,
  }));

  const geometry = geometryAnalyzer.analyze(pts);
  const score = new WeightedScorer().score(
    {
      features: geometry.values,
      implausible: geometry.implausible,
      external: {},
      qualityOverall: 1,
      embeddingStability: null,
      poseCompensated: geometry.aligned.poseCompensated,
    },
    DEFAULT_WEIGHTS,
  );

  const metrics = METRIC_ORDER.map((id) => makeMetric(id, geometry.values[id]));

  const avg = (cat: CategoryId) => {
    const picked = metrics.filter((m) => m.category === cat);
    return Math.round(picked.reduce((s, m) => s + m.score, 0) / (picked.length || 1));
  };

  return {
    metrics,
    symmetry: moduleScore(score, "symmetry"),
    eyesScore: avg("eyes"),
    jawScore: avg("jaw"),
    proportionsScore: avg("proportions"),
    // The dashboard's "midface" ring covers the nose and lips region, which
    // the engine splits into two modules.
    midfaceScore: Math.round(
      (moduleScore(score, "nose") + moduleScore(score, "lips")) / 2,
    ),
    harmony: Math.round(score.composite),
    overall: score.overall,
    weakest: [...metrics].sort((a, b) => a.score - b.score).slice(0, 3).map((m) => m.id),
    intercanthal: geometry.ipd,
  };
}
