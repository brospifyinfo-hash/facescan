// VisionAnalysis → the project's own payload shapes.
//
// THE DIVISION OF LABOUR, AND WHY IT IS WHERE IT IS
// -------------------------------------------------
// GPT-4.1 supplies every JUDGEMENT: the 25 measurements, the nine module
// scores, the headline rating, the capture assessment, the findings. That
// is what "GPT übernimmt den kompletten Ratingprozess" means and none of it
// is recomputed here.
//
// This file supplies every DERIVATION — the quantities that are pure
// functions of the judgements plus the tables already in the repository:
//
//   z          = (value − reference) / sd          modules.ts, from norms.ts
//   score      = 100·exp(−½(z/κ)²)                 modules.ts
//   grade      = NORMS[id].grade                   norms.ts
//   weight     = DEFAULT_WEIGHTS.modules[id]       weights.ts
//   composite  = Σ(w·c·s)/Σ(w·c)                   engine.ts, WeightedScorer
//   changeable = id in ACTIONABLE                  recommendations.ts
//   magnitude  = |z| of the source measurement     recommendations.ts
//   percentile = anchor table                      rubric.ts
//
// Asking the model for these as well would have been asking it to be a
// second, worse implementation of code that already exists — and every one
// of them is a place where its answer could contradict its own numbers.
// The rule is: the model decides, the repository derives.

import { NORMS, SOURCE_NOTE, MEASUREMENT_IDS, type MeasurementId } from "../analysis/norms";
import { scoreMeasurement, TOLERANCE_SD } from "../analysis/modules";
import { ACTIONABLE } from "../analysis/recommendations";
import { DEFAULT_WEIGHTS } from "../analysis/weights";
import { RESERVED_MODULES } from "../analysis/engine";
import type { AnalysisResponse, ModulePayload } from "../analysis/response";
import type { Finding, Recommendation } from "../analysis/recommendations";
import { makeMetric, METRIC_ORDER } from "../specs";
import type { Metric, MetricId } from "../metrics";
import type { VisionAnalysis, VisionModuleId } from "./contract";
import type { ValidatedVision } from "./validate";

/** The parts of ScanMetrics the vision path can fill. The client adds the mesh. */
export interface VisionScanFields {
  overall: number;
  harmony: number;
  symmetry: number;
  eyesScore: number;
  jawScore: number;
  proportionsScore: number;
  midfaceScore: number;
  metrics: Metric[];
  weakest: MetricId[];
  confidence: number;
  qualityIssues: string[];
}

export interface VisionPayload {
  scan: VisionScanFields;
  report: AnalysisResponse;
  /** Diagnostics for the caller; never shown to the user. */
  meta: { repairs: number; cached: boolean; model: string; promptVersion: string };
}

const round1 = (v: number) => Number(v.toFixed(1));
const round3 = (v: number) => Number(v.toFixed(3));

/** Weight of a response module. `hair` has none defined, so it carries zero. */
function weightOf(id: VisionModuleId): number {
  const table = DEFAULT_WEIGHTS.modules as Record<string, number | undefined>;
  return table[id] ?? 0;
}

function payloadOf(
  v: VisionAnalysis,
  id: VisionModuleId,
  note?: string,
): ModulePayload {
  const m = v.modules[id];
  const score = m.score === null ? null : round1(m.score);
  return {
    score,
    confidence: round3(m.confidence),
    weight: weightOf(id),
    available: score !== null && m.confidence > 0,
    note,
  };
}

/**
 * The confidence-weighted composite, computed exactly as WeightedScorer
 * computes it — same formula, same weights, same drop-out behaviour for a
 * module with zero confidence.
 *
 * It is not asked of the model, because a mean of nine numbers the model
 * already gave is not a judgement. Asking would only create the chance for
 * the composite to disagree with the modules it is a mean of.
 */
function compositeOf(v: VisionAnalysis): number {
  let num = 0;
  let den = 0;
  for (const id of Object.keys(v.modules) as VisionModuleId[]) {
    const m = v.modules[id];
    const effective = weightOf(id) * m.confidence;
    if (m.score === null || effective <= 0) continue;
    num += effective * m.score;
    den += effective;
  }
  return den > 0 ? num / den : 50;
}

/** Finding[] from a list of measurement ids, with z and score derived. */
function findingsOf(ids: MeasurementId[], values: Record<MeasurementId, number>): Finding[] {
  return ids.map((id) => {
    const s = scoreMeasurement(id, values[id]);
    return {
      id,
      z: Number(s.z.toFixed(2)),
      score: round1(s.score),
      changeable: id in ACTIONABLE,
    };
  });
}

export function adaptVision(
  validated: ValidatedVision,
  context: { model: string; promptVersion: string; cached: boolean },
): VisionPayload {
  const v = validated.analysis;
  const values = v.measurements;

  // ---- measurements[] ------------------------------------------------------
  // `used` follows the same rule geometry.ts and modules.ts follow: a value
  // outside its plausible range, or one the model could not take, is
  // reported in full but carries no z and no score.
  const measurements: AnalysisResponse["measurements"] = MEASUREMENT_IDS.map((id) => {
    const usable = !validated.unusable.has(id);
    const s = usable ? scoreMeasurement(id, values[id]) : null;
    return {
      id,
      value: values[id],
      z: s ? Number(s.z.toFixed(3)) : null,
      score: s ? round1(s.score) : null,
      used: usable,
      grade: NORMS[id].grade,
    };
  });

  // ---- caveats -------------------------------------------------------------
  // Every limit that bounds THIS reading, stated rather than implied. The
  // first three are properties of the vision path itself and are always
  // true; the rest depend on what happened on this call.
  const caveats: string[] = [
    SOURCE_NOTE,
    "Measurements were estimated by GPT-4.1 Vision from the photograph, not " +
      "computed from a landmark mesh. They carry the model's estimation error " +
      "on top of the norms' own limits, and two different photographs can " +
      "produce slightly different values for the same face.",
    "Head pose was normalised by the model from image cues. There is no depth " +
      "channel in this path, so no geometric de-rotation was performed.",
    "Pupil positions are model estimates; no iris landmarks were used.",
  ];
  if (validated.implausible.length > 0) {
    caveats.push(
      `${validated.implausible.length} measurement(s) fell outside their ` +
        "plausible range and were dropped, not scored.",
    );
  }
  const declaredUnmeasurable = v.unmeasurable.length;
  if (declaredUnmeasurable > 0) {
    caveats.push(
      `${declaredUnmeasurable} measurement(s) could not be taken from this ` +
        "photograph and were excluded from the findings.",
    );
  }
  if (validated.repairs > 0) {
    caveats.push(
      `${validated.repairs} field(s) returned by the model were out of range ` +
        "or internally inconsistent and were corrected before scoring.",
    );
  }
  caveats.push(...v.notes);

  const report: AnalysisResponse = {
    overallScore: v.overall,
    confidence: v.confidence,
    percentile: v.percentile,

    symmetry: payloadOf(v, "symmetry"),
    proportions: payloadOf(v, "proportions"),
    jaw: payloadOf(v, "jaw"),
    eyes: payloadOf(v, "eyes"),
    nose: payloadOf(v, "nose"),
    lips: payloadOf(v, "lips"),
    skin: payloadOf(
      v,
      "skin",
      `Assessed by GPT-4.1 Vision. Tone uniformity ${v.skin.toneUniformity.toFixed(2)}, ` +
        `texture ${v.skin.textureEnergy.toFixed(2)} (0-1). Lighting and make-up ` +
        "dominate both; there is no published norm for either as defined here.",
    ),
    // RESERVED_MODULES.hair says hair needs a segmentation model that is not
    // loaded on-device. That is a statement about the on-device pipeline,
    // and it stops being true here: a vision model can see a hairline. The
    // module is therefore filled, and its note says which of the two paths
    // produced it — and that it still carries no weight in the composite,
    // because weights.ts defines none for it.
    hair: payloadOf(
      v,
      "hair",
      `Assessed by GPT-4.1 Vision rather than on-device (on-device: ${RESERVED_MODULES.hair}). ` +
        "Reported only — it carries no weight in the composite.",
    ),
    faceShape: {
      ...payloadOf(v, "faceShape", "reported for explainability; not scored"),
      shape: v.faceShape,
    },

    strengths: findingsOf(v.strengths, values),
    weaknesses: findingsOf(v.weaknesses, values),
    recommendations: v.recommendations.map<Recommendation>((r) => ({
      key: r.key,
      source: r.source,
      magnitude: Math.abs(Number(scoreMeasurement(r.source, values[r.source]).z.toFixed(2))),
    })),

    measurements,

    quality: {
      overall: round3(v.quality.overall),
      sharpness: round3(v.quality.sharpness),
      motionBlur: round3(v.quality.motionBlur),
      noise: round3(v.quality.noise),
      exposure: round3(v.quality.exposure),
      whiteBalance: round3(v.quality.whiteBalance),
      resolution: round3(v.quality.resolution),
      frontality: round3(v.quality.frontality),
      occlusion: round3(v.quality.occlusion),
      pose: v.quality.pose,
      issues: v.quality.issues,
    },

    meta: {
      poseCompensated: true,
      refinedIris: false,
      implausible: validated.implausible,
      toleranceSd: TOLERANCE_SD,
      caveats,
    },
  };

  // ---- the dashboard's own shape ------------------------------------------
  // makeMetric() is the existing display adapter: it derives the dial band,
  // the scale, the formatted string and the in/above/below flag from the
  // same norm the score used. Reusing it is what keeps a dial from saying
  // "in range" while the module behind it applied a penalty.
  const metrics = METRIC_ORDER.map((id) => makeMetric(id, values[id as MeasurementId]));

  const moduleScore = (id: VisionModuleId): number => {
    const s = v.modules[id].score;
    return s === null ? 50 : Math.round(s);
  };

  const scan: VisionScanFields = {
    overall: v.overall,
    harmony: Math.round(compositeOf(v)),
    symmetry: moduleScore("symmetry"),
    eyesScore: moduleScore("eyes"),
    jawScore: moduleScore("jaw"),
    proportionsScore: moduleScore("proportions"),
    // The dashboard's "midface" ring covers nose and lips, which the model
    // splits into two modules — the same fold measure.ts already performs.
    midfaceScore: Math.round((moduleScore("nose") + moduleScore("lips")) / 2),
    metrics,
    weakest: [...metrics].sort((a, b) => a.score - b.score).slice(0, 3).map((m) => m.id),
    confidence: v.confidence,
    qualityIssues: v.quality.issues,
  };

  return {
    scan,
    report,
    meta: {
      repairs: validated.repairs,
      cached: context.cached,
      model: context.model,
      promptVersion: context.promptVersion,
    },
  };
}
