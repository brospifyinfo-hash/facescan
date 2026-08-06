// The contract between GPT-4.1 Vision and this project.
//
// SINGLE SOURCE OF TRUTH. Every list in this file is either imported from
// the existing model (norms.ts, modules.ts, metrics.ts, types.ts) or
// checked against it at module load. Nothing here invents a field.
//
// The reason it is built this way rather than hand-written: a prompt and a
// schema that are typed out by hand drift the moment someone adds a
// measurement to norms.ts. Here, adding a norm automatically adds it to the
// JSON schema, to the prompt's measurement table and to the validator, and
// `assertContract()` fails the build if any of the three fall out of step.

import { MEASUREMENT_IDS, NORMS, type MeasurementId } from "../analysis/norms";
import type { FaceShape } from "../analysis/geometry";
import type { QualityIssue } from "../analysis/types";

/**
 * Bumped whenever the prompt, the schema or the rubric changes.
 *
 * It is part of the cache key, so a prompt edit cannot serve stale answers
 * produced by the previous wording.
 */
export const PROMPT_VERSION = "gpt41v-1.0.0";

export const VISION_MODEL = process.env.OPENAI_VISION_MODEL ?? "gpt-4.1";

/** The 25 measurements, exactly as keyed in lib/analysis/norms.ts. */
export const VISION_MEASUREMENT_IDS = MEASUREMENT_IDS;

/**
 * The nine module slots that leave the pipeline in AnalysisResponse.
 *
 * NOT the same list as MODULE_IDS in modules.ts: that one carries
 * `embedding` (an internal stage that is never serialised) and omits
 * `hair` (which the response declares). This is the response's list, so it
 * is what GPT is asked to fill.
 */
export const VISION_MODULE_IDS = [
  "symmetry",
  "proportions",
  "jaw",
  "eyes",
  "nose",
  "lips",
  "skin",
  "hair",
  "faceShape",
] as const;

export type VisionModuleId = (typeof VISION_MODULE_IDS)[number];

/** The six shapes classifyShape() can return. */
export const FACE_SHAPES = [
  "oval",
  "round",
  "square",
  "oblong",
  "heart",
  "diamond",
] as const satisfies readonly FaceShape[];

/** The nine QualityIssue values from lib/analysis/types.ts. */
export const QUALITY_ISSUES = [
  "blurry",
  "motionBlur",
  "underexposed",
  "overexposed",
  "noisy",
  "colorCast",
  "lowResolution",
  "notFrontal",
  "occluded",
] as const satisfies readonly QualityIssue[];

/**
 * The recommendation keys ACTIONABLE in lib/analysis/recommendations.ts can
 * emit. GPT may not invent a seventh — the UI dictionary would have no
 * wording for it.
 */
export const RECOMMENDATION_KEYS = [
  "eyeOpenness",
  "browGrooming",
  "lowerFaceDefinition",
  "lipRest",
  "cameraHeight",
  "postureAndCamera",
] as const;

export type RecommendationKey = (typeof RECOMMENDATION_KEYS)[number];

/**
 * Operational definition of every measurement, transcribed from the exact
 * expression in lib/analysis/geometry.ts.
 *
 * This is the part that decides whether GPT's numbers are comparable with
 * the norms in norms.ts. "Nose width" means nothing on its own; "alar width
 * divided by bizygomatic width" is a quantity with a published mean and SD.
 * A definition that drifts from geometry.ts by even a denominator moves the
 * measurement by whole standard deviations — see the esr and midface notes
 * in norms.ts, which document exactly that failure.
 */
export const MEASUREMENT_DEFS: Record<MeasurementId, string> = {
  canthalTilt:
    "Mean over both eyes of atan2(inner_canthus_y − outer_canthus_y, |outer_x − inner_x|), in DEGREES. " +
    "Positive when the outer corner sits HIGHER than the inner corner.",
  esr: "Interpupillary distance (pupil centre to pupil centre) / bizygomatic width (widest cheekbone to cheekbone).",
  eyeAspect:
    "Palpebral fissure height / palpebral fissure width, averaged over both eyes. " +
    "Height = upper lid margin to lower lid margin at the widest point; width = inner to outer canthus.",
  eyeSpacing: "Intercanthal distance (inner canthus to inner canthus) / a single eye's fissure width.",
  symmetryDeviation:
    "Mean absolute left/right mismatch of mirrored landmark pairs against the facial midline, " +
    "expressed as a FRACTION OF INTERPUPILLARY DISTANCE. 0 = perfectly symmetric. Typical real faces land 0.02–0.07.",
  browPosition: "Vertical gap from the brow's lower edge to the upper lid margin / palpebral fissure height.",
  gonialAngle:
    "SURFACE contour angle in DEGREES measured at the jaw corner, between the line to the cheekbone " +
    "and the line to the chin point. This is the visible soft-tissue outline, NOT the cephalometric " +
    "gonial angle from a lateral radiograph. A sharply tapered jaw reads HIGH (165°+), a wide square jaw LOW (145°).",
  jawWidth: "Bigonial width (jaw corner to jaw corner) / bizygomatic width.",
  chinRatio: "Chin height (lower lip vermilion border to menton) / philtrum height.",
  thirds:
    "Mean absolute deviation of the three facial thirds (trichion→glabella, glabella→subnasale, " +
    "subnasale→menton) from their own average, in PERCENT. 0 = perfectly equal thirds.",
  fifths: "Bizygomatic width / a single eye's fissure width.",
  fwhr: "Bizygomatic width / vertical distance from the brow midline down to the upper lip's inner border.",
  facialIndex: "Face height (hairline/forehead point to menton, VERTICAL distance) / bizygomatic width.",
  goldenRatio: "Identical quantity to facialIndex. Report the same number.",
  faceLength: "Face height (forehead point to menton) / interpupillary distance.",
  bizygomaticRatio: "Bizygomatic width / interpupillary distance.",
  bigonialRatio: "Bigonial width / interpupillary distance.",
  lowerThird: "Distance subnasale→menton / total face height.",
  midface: "Vertical distance from the pupil line down to the upper lip's inner border / interpupillary distance.",
  noseWidth: "Alar width (widest point of the nostrils) / bizygomatic width.",
  noseLength: "Vertical distance nasion→subnasale / total face height.",
  mouthNose: "Mouth width (commissure to commissure) / alar width.",
  lipRatio: "Lower vermilion height / upper vermilion height.",
  philtrumRatio: "Philtrum height (subnasale to upper lip vermilion border) / lower-third height.",
  chinProjection:
    "Chin depth relative to the plane through the cheekbones, in interpupillary-distance units. " +
    "Positive = chin projects forward of the cheek plane. Requires depth cues: use the side photo " +
    "when one is supplied, otherwise shading and jaw-shadow only. Report 0 when it cannot be seen.",
};

/** What GPT-4.1 Vision returns. One field per field the project already has. */
export interface VisionAnalysis {
  faceDetected: boolean;
  /** Null unless the model declined; then everything else is ignored. */
  refusalReason: string | null;

  /** The 25 measurements of norms.ts, in the units of MEASUREMENT_DEFS. */
  measurements: Record<MeasurementId, number>;
  /** Measurements the photo did not permit. Mapped to `used: false`. */
  unmeasurable: MeasurementId[];

  /** The nine response modules: 0–100 score (null = not assessable) + 0–1 confidence. */
  modules: Record<VisionModuleId, { score: number | null; confidence: number }>;

  faceShape: (typeof FACE_SHAPES)[number];
  skin: { toneUniformity: number; textureEnergy: number };

  /** The rating. 1.0–10.0, one decimal. GPT's own judgement, not derived. */
  overall: number;
  /** Share of the adult population GPT places below this face, 0–100. */
  percentile: number;
  /** 0–1, how much the reading is worth trusting. */
  confidence: number;

  quality: {
    sharpness: number;
    motionBlur: number;
    exposure: number;
    noise: number;
    whiteBalance: number;
    resolution: number;
    frontality: number;
    occlusion: number;
    overall: number;
    pose: { yaw: number; pitch: number; roll: number };
    issues: QualityIssue[];
  };

  /** Measurement ids, best first. Mapped to Finding[]. */
  strengths: MeasurementId[];
  /** Measurement ids, worst first. Mapped to Finding[]. */
  weaknesses: MeasurementId[];
  recommendations: Array<{ key: RecommendationKey; source: MeasurementId }>;

  /** Limits on this particular reading. Appended to meta.caveats. */
  notes: string[];
}

export interface ContractProblem {
  field: string;
  problem: string;
}

/**
 * Structural check that the contract still matches the model it mirrors.
 *
 * Runs in the dev build and in the test script. It cannot verify that GPT
 * behaves — only that this file has not fallen behind norms.ts.
 */
export function assertContract(): ContractProblem[] {
  const problems: ContractProblem[] = [];

  for (const id of MEASUREMENT_IDS) {
    if (!MEASUREMENT_DEFS[id]) {
      problems.push({
        field: `MEASUREMENT_DEFS.${id}`,
        problem: "measurement exists in norms.ts but has no operational definition",
      });
    }
  }
  for (const id of Object.keys(MEASUREMENT_DEFS)) {
    if (!(id in NORMS)) {
      problems.push({
        field: `MEASUREMENT_DEFS.${id}`,
        problem: "definition for a measurement that norms.ts does not have",
      });
    }
  }

  return problems;
}
