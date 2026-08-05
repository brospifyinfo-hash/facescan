// ResponseBuilder — stage 8.
//
// One place that decides what leaves the pipeline, so the payload cannot
// drift as the internals change. The shape is the one the product spec
// asks for, with three additions that the spec's shape would otherwise
// hide:
//
//   * every module reports its own `confidence` and `weight`, not just a
//     score, because a 72 from a module that could only evaluate half its
//     measurements is not the same claim as a 72 from a complete one;
//   * `available: false` modules are present rather than omitted, so a
//     consumer can tell "not measured" from "measured as average";
//   * `provenance` carries the source grade, so anything resting on a
//     heuristic rather than a published norm is visible downstream.

import type { GeometryResult } from "./geometry";
import type { SkinResult } from "./skin";
import type { ScoreResult } from "./engine";
import type { ModuleId } from "./modules";
import type { QualityStage } from "./types";
import type { Finding, Recommendation } from "./recommendations";
import { RecommendationEngine } from "./recommendations";
import { RESERVED_MODULES } from "./engine";
import { SOURCE_NOTE, type MeasurementId } from "./norms";
import { TOLERANCE_SD } from "./modules";

export interface ModulePayload {
  score: number | null;
  confidence: number;
  weight: number;
  available: boolean;
  note?: string;
}

export interface AnalysisResponse {
  overallScore: number;
  confidence: number;
  /** Share of the modelled population scoring below this face. */
  percentile: number;

  symmetry: ModulePayload;
  proportions: ModulePayload;
  jaw: ModulePayload;
  eyes: ModulePayload;
  nose: ModulePayload;
  lips: ModulePayload;
  skin: ModulePayload;
  hair: ModulePayload;
  faceShape: ModulePayload & { shape: string };

  strengths: Finding[];
  weaknesses: Finding[];
  recommendations: Recommendation[];

  /** Every measurement, unrounded, with its z-distance and provenance. */
  measurements: Array<{
    id: MeasurementId;
    value: number;
    z: number | null;
    score: number | null;
    used: boolean;
    grade: string;
  }>;

  quality: {
    overall: number;
    sharpness: number;
    motionBlur: number;
    noise: number;
    exposure: number;
    whiteBalance: number;
    resolution: number;
    frontality: number;
    occlusion: number;
    pose: { yaw: number; pitch: number; roll: number };
    issues: string[];
  };

  meta: {
    poseCompensated: boolean;
    refinedIris: boolean;
    implausible: MeasurementId[];
    toleranceSd: number;
    /** Limits a consumer must not paper over. */
    caveats: string[];
  };
}

function payload(
  modules: ScoreResult["modules"],
  id: ModuleId,
  note?: string,
): ModulePayload {
  const m = modules.find((x) => x.id === id);
  if (!m) {
    return { score: null, confidence: 0, weight: 0, available: false, note };
  }
  return {
    score: m.score === null ? null : Number(m.score.toFixed(1)),
    confidence: Number(m.confidence.toFixed(3)),
    weight: m.weight,
    available: m.score !== null && m.confidence > 0,
    note: note ?? m.unavailable,
  };
}

export function buildResponse(input: {
  geometry: GeometryResult;
  quality: QualityStage;
  skin: SkinResult | null;
  score: ScoreResult;
  explain: {
    strengths: Finding[];
    weaknesses: Finding[];
    recommendations: Recommendation[];
  };
}): AnalysisResponse {
  const { geometry, quality, skin, score, explain } = input;

  const scored = new Map(
    score.modules.flatMap((m) => m.measurements.map((x) => [x.id, x] as const)),
  );

  const measurements = (Object.keys(geometry.values) as MeasurementId[]).map((id) => {
    const s = scored.get(id);
    return {
      id,
      value: geometry.values[id],
      z: s && s.used ? Number(s.z.toFixed(3)) : null,
      score: s && s.used ? Number(s.score.toFixed(1)) : null,
      used: Boolean(s?.used),
      grade: RecommendationEngine.provenance(id).grade,
    };
  });

  const caveats = [SOURCE_NOTE];
  if (!geometry.aligned.poseCompensated) {
    caveats.push(
      "Depth was unusable, so yaw and pitch could not be removed. " +
        "Measurements carry whatever rotation the photo had.",
    );
  }
  if (geometry.implausible.length > 0) {
    caveats.push(
      `${geometry.implausible.length} measurement(s) fell outside their ` +
        "plausible range and were dropped, not scored.",
    );
  }
  if (!geometry.refinedIris) {
    caveats.push(
      "Iris landmarks were absent; pupil positions were approximated from " +
        "the eye fissure midpoints.",
    );
  }

  return {
    overallScore: score.overall,
    confidence: score.confidence,
    percentile: score.percentile,

    symmetry: payload(score.modules, "symmetry"),
    proportions: payload(score.modules, "proportions"),
    jaw: payload(score.modules, "jaw"),
    eyes: payload(score.modules, "eyes"),
    nose: payload(score.modules, "nose"),
    lips: payload(score.modules, "lips"),
    skin: payload(score.modules, "skin", skin?.note),
    // Declared, never faked. See RESERVED_MODULES.
    hair: {
      score: null,
      confidence: 0,
      weight: 0,
      available: false,
      note: RESERVED_MODULES.hair,
    },
    faceShape: {
      ...payload(score.modules, "faceShape"),
      shape: geometry.shape,
    },

    strengths: explain.strengths,
    weaknesses: explain.weaknesses,
    recommendations: explain.recommendations,

    measurements,

    quality: {
      overall: Number(quality.overall.toFixed(3)),
      sharpness: Number(quality.sharpness.toFixed(3)),
      motionBlur: Number((quality.motionBlur ?? 1).toFixed(3)),
      noise: Number(quality.noise.toFixed(3)),
      exposure: Number(quality.exposure.toFixed(3)),
      whiteBalance: Number(quality.whiteBalance.toFixed(3)),
      resolution: Number(quality.resolution.toFixed(3)),
      frontality: Number(quality.frontality.toFixed(3)),
      occlusion: Number(quality.occlusion.toFixed(3)),
      pose: quality.pose,
      issues: quality.issues,
    },

    meta: {
      poseCompensated: geometry.aligned.poseCompensated,
      refinedIris: geometry.refinedIris,
      implausible: geometry.implausible,
      toleranceSd: TOLERANCE_SD,
      caveats,
    },
  };
}
