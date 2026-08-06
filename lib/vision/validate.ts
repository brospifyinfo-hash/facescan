// Parse, check and repair what GPT-4.1 returned.
//
// WHY THIS EXISTS AT ALL, GIVEN A STRICT SCHEMA
// ---------------------------------------------
// Strict structured output guarantees the SHAPE: every key present, every
// enum a member, every number a number. It cannot guarantee the VALUE,
// because OpenAI's strict subset does not support `minimum`/`maximum`. So
// the schema makes "field missing" impossible and this file makes "field
// nonsensical" survivable.
//
// THE REPAIR POLICY, AND THE ONE THING IT REFUSES TO DO
// ----------------------------------------------------
// Values are clamped into their defined ranges and internal contradictions
// are resolved in favour of the more constrained side. What is NOT done is
// substituting a plausible-looking number for one the model could not
// produce: a measurement outside its physical range is flagged
// `implausible` and DROPPED, exactly as lib/analysis/geometry.ts drops a
// failed landmark. Scoring a failure as if it described the face is the
// bug that turns a bad photo into a bad verdict, and it does not become
// acceptable because a language model produced the failure instead of a
// landmark detector.
//
// Every repair is counted. The count is logged and surfaced in the
// response's caveats, so a reading that needed eleven corrections is
// visibly not the same claim as one that needed none.

import { MEASUREMENT_IDS, NORMS, type MeasurementId } from "../analysis/norms";
import { ACTIONABLE } from "../analysis/recommendations";
import type { QualityIssue } from "../analysis/types";
import {
  FACE_SHAPES,
  QUALITY_ISSUES,
  RECOMMENDATION_KEYS,
  VISION_MODULE_IDS,
  type RecommendationKey,
  type VisionAnalysis,
  type VisionModuleId,
} from "./contract";
import { percentileOfVisionScore, SCORE_MAX, SCORE_MIN } from "./rubric";
import { VisionError } from "./openai";

export interface ValidatedVision {
  analysis: VisionAnalysis;
  /** Measurements outside their plausible range — dropped, not scored. */
  implausible: MeasurementId[];
  /** Measurements the model could not take, plus the implausible ones. */
  unusable: Set<MeasurementId>;
  /** How many fields had to be corrected. */
  repairs: number;
  repairNotes: string[];
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** How far percentile may drift from the rubric before it counts as a repair. */
const PERCENTILE_TOLERANCE = 3;

export function validateVision(raw: string): ValidatedVision {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new VisionError("malformed", "The model did not return parseable JSON.");
  }
  // `typeof [] === "object"`, so the array check is not redundant: without
  // it a JSON array walks straight into the field reads below, every one
  // misses, and the defaults assemble a complete-looking analysis of
  // nothing.
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new VisionError("malformed", "The model returned a non-object payload.");
  }

  const v = parsed as Record<string, any>;
  let repairs = 0;
  const repairNotes: string[] = [];
  const repair = (note: string) => {
    repairs++;
    if (repairNotes.length < 8) repairNotes.push(note);
  };

  // ---- Refusal and detection ----------------------------------------------
  if (v.faceDetected === false) {
    throw new VisionError(
      "refused",
      typeof v.refusalReason === "string" && v.refusalReason.length > 0
        ? v.refusalReason
        : "No analysable face was found in the photograph.",
    );
  }

  const number = (value: unknown, fallback: number): number =>
    typeof value === "number" && Number.isFinite(value) ? value : fallback;

  // ---- Measurements --------------------------------------------------------
  const rawMeasurements = (v.measurements ?? {}) as Record<string, unknown>;
  const measurements = {} as Record<MeasurementId, number>;
  const unusable = new Set<MeasurementId>();

  const declaredUnmeasurable: MeasurementId[] = Array.isArray(v.unmeasurable)
    ? v.unmeasurable.filter((id: unknown): id is MeasurementId =>
        typeof id === "string" && (MEASUREMENT_IDS as string[]).includes(id),
      )
    : [];
  for (const id of declaredUnmeasurable) unusable.add(id);

  for (const id of MEASUREMENT_IDS) {
    const value = rawMeasurements[id];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      // The reference value keeps the arithmetic downstream well defined
      // without pretending the measurement was taken — `unusable` is what
      // stops it from being scored.
      measurements[id] = NORMS[id].mean;
      unusable.add(id);
      repair(`${id} was missing or non-numeric`);
      continue;
    }
    measurements[id] = value;
  }

  // goldenRatio and facialIndex are the SAME quantity in geometry.ts. A
  // model that reports them differently has contradicted itself, and
  // norms.ts is explicit that goldenRatio is the reported duplicate.
  if (Math.abs(measurements.goldenRatio - measurements.facialIndex) > 1e-6) {
    measurements.goldenRatio = measurements.facialIndex;
    repair("goldenRatio disagreed with facialIndex and was set equal to it");
  }

  // symmetryDeviation is a magnitude; a negative one is not a small
  // asymmetry, it is a sign error.
  if (measurements.symmetryDeviation < 0) {
    measurements.symmetryDeviation = Math.abs(measurements.symmetryDeviation);
    repair("symmetryDeviation was negative and was taken as a magnitude");
  }
  if (measurements.thirds < 0) {
    measurements.thirds = Math.abs(measurements.thirds);
    repair("thirds was negative and was taken as a magnitude");
  }

  // Same rule as geometry.ts: outside the physical range means the model
  // mis-located a landmark, not that the face is extraordinary.
  const implausible = MEASUREMENT_IDS.filter((id) => {
    const [lo, hi] = NORMS[id].plausible;
    return measurements[id] < lo || measurements[id] > hi;
  });
  for (const id of implausible) unusable.add(id);

  // ---- Modules -------------------------------------------------------------
  const rawModules = (v.modules ?? {}) as Record<string, any>;
  const modules = {} as Record<VisionModuleId, { score: number | null; confidence: number }>;
  for (const id of VISION_MODULE_IDS) {
    const m = rawModules[id] ?? {};
    let score: number | null =
      m.score === null || typeof m.score !== "number" || !Number.isFinite(m.score)
        ? null
        : m.score;
    if (score !== null && (score < 0 || score > 100)) {
      score = clamp(score, 0, 100);
      repair(`module ${id} score was out of 0-100 and was clamped`);
    }
    let confidence = clamp(number(m.confidence, 0), 0, 1);

    // faceShape is measured and reported but never scored — weights.ts sets
    // its weight to 0 and response.ts documents why. Accepting a score for
    // it would put a number on the page that nothing behind it supports.
    if (id === "faceShape" && score !== null) {
      score = null;
      confidence = 0;
      repair("faceShape carried a score; it is reported, never scored");
    }
    // A score with no confidence, or a confidence with no score, is a
    // contradiction the composite would silently swallow.
    if (score === null && confidence > 0) {
      confidence = 0;
      repair(`module ${id} had confidence but no score`);
    }
    modules[id] = { score, confidence };
  }

  // ---- Headline ------------------------------------------------------------
  let overall = number(v.overall, 5.0);
  if (overall < SCORE_MIN || overall > SCORE_MAX) {
    overall = clamp(overall, SCORE_MIN, SCORE_MAX);
    repair("overall fell outside 1.0-10.0 and was clamped");
  }
  overall = Number(overall.toFixed(1));

  // The percentile is DERIVED, never trusted. The rubric that produced the
  // score is the only thing that can say what it means, and letting the
  // model report the two independently is how a headline and the badge
  // beneath it come to disagree.
  const rubricPercentile = Number(percentileOfVisionScore(overall).toFixed(1));
  const claimed = number(v.percentile, rubricPercentile);
  if (Math.abs(claimed - rubricPercentile) > PERCENTILE_TOLERANCE) {
    repair(`percentile ${claimed.toFixed(1)} did not match the anchor table for ${overall}`);
  }

  const confidence = Number(clamp(number(v.confidence, 0.5), 0, 1).toFixed(3));

  // ---- Face shape and skin -------------------------------------------------
  const faceShape = (FACE_SHAPES as readonly string[]).includes(v.faceShape)
    ? (v.faceShape as (typeof FACE_SHAPES)[number])
    : ((): (typeof FACE_SHAPES)[number] => {
        repair("faceShape was not one of the six known shapes");
        return "oval";
      })();

  const skin = {
    toneUniformity: clamp(number(v.skin?.toneUniformity, 0.5), 0, 1),
    textureEnergy: clamp(number(v.skin?.textureEnergy, 0.5), 0, 1),
  };

  // ---- Quality -------------------------------------------------------------
  const q = (v.quality ?? {}) as Record<string, any>;
  const unit = (key: string, fallback = 0.5) => clamp(number(q[key], fallback), 0, 1);
  const issues: QualityIssue[] = Array.isArray(q.issues)
    ? Array.from(
        new Set(
          q.issues.filter((i: unknown): i is QualityIssue =>
            typeof i === "string" && (QUALITY_ISSUES as readonly string[]).includes(i),
          ),
        ),
      )
    : [];

  const quality = {
    sharpness: unit("sharpness"),
    motionBlur: unit("motionBlur", 1),
    exposure: unit("exposure"),
    noise: unit("noise", 1),
    whiteBalance: unit("whiteBalance", 1),
    resolution: unit("resolution"),
    frontality: unit("frontality"),
    occlusion: unit("occlusion", 1),
    overall: unit("overall"),
    pose: {
      yaw: clamp(number(q.pose?.yaw, 0), -90, 90),
      pitch: clamp(number(q.pose?.pitch, 0), -90, 90),
      roll: clamp(number(q.pose?.roll, 0), -90, 90),
    },
    issues,
  };

  // ---- Findings ------------------------------------------------------------
  const asIds = (value: unknown): MeasurementId[] =>
    Array.isArray(value)
      ? Array.from(
          new Set(
            value.filter((id: unknown): id is MeasurementId =>
              typeof id === "string" && (MEASUREMENT_IDS as string[]).includes(id),
            ),
          ),
        )
          // A finding about a measurement that was never taken is not a
          // finding. This is the same filter RecommendationEngine applies.
          .filter((id) => !unusable.has(id))
          .slice(0, 4)
      : [];

  const strengths = asIds(v.strengths);
  const weaknesses = asIds(v.weaknesses).filter((id) => !strengths.includes(id));

  const seenKeys = new Set<string>();
  const recommendations: Array<{ key: RecommendationKey; source: MeasurementId }> = [];
  for (const entry of Array.isArray(v.recommendations) ? v.recommendations : []) {
    const key = entry?.key;
    const source = entry?.source;
    if (
      typeof key !== "string" ||
      typeof source !== "string" ||
      !(RECOMMENDATION_KEYS as readonly string[]).includes(key) ||
      !(MEASUREMENT_IDS as string[]).includes(source)
    ) {
      repair("a recommendation referenced an unknown key or measurement");
      continue;
    }
    // The key must be the one ACTIONABLE assigns to that measurement.
    // Anything else is advice about something the person cannot change,
    // which is the single rule recommendations.ts is built around.
    if (ACTIONABLE[source as MeasurementId] !== key) {
      repair(`recommendation "${key}" is not the actionable lever for ${source}`);
      continue;
    }
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    recommendations.push({ key: key as RecommendationKey, source: source as MeasurementId });
    if (recommendations.length === 4) break;
  }

  const notes: string[] = Array.isArray(v.notes)
    ? v.notes
        .filter((n: unknown): n is string => typeof n === "string" && n.trim().length > 0)
        .map((n: string) => n.trim())
        .slice(0, 3)
    : [];

  const analysis: VisionAnalysis = {
    faceDetected: true,
    refusalReason: null,
    measurements,
    unmeasurable: [...unusable].filter((id) => !implausible.includes(id)),
    modules,
    faceShape,
    skin,
    overall,
    percentile: rubricPercentile,
    confidence,
    quality,
    strengths,
    weaknesses,
    recommendations,
    notes,
  };

  return { analysis, implausible, unusable, repairs, repairNotes };
}
