// The JSON Schema handed to the Responses API as a strict structured output.
//
// GENERATED FROM THE CONTRACT, for the same reason the prompt is: a
// hand-maintained schema falls behind norms.ts the first time a measurement
// is added, and the failure is silent — GPT simply stops returning the new
// field and the adapter fills a hole with a default.
//
// STRICT-MODE RULES THIS FILE OBEYS (they are not optional; the API rejects
// the request otherwise):
//   * every object carries `additionalProperties: false`
//   * every property of every object appears in `required`
//   * no `minimum`/`maximum`/`minItems`/`maxItems`/`pattern`/`default`
//
// The missing numeric bounds are why lib/vision/validate.ts exists. Ranges
// are stated in the prompt and enforced in code, never by the schema.
//
// The 25 measurements are modelled as an OBJECT with 25 required keys
// rather than as an array. Strict mode can guarantee that every key of an
// object is present; it cannot guarantee the length of an array. This turns
// "GPT returned 23 of 25 measurements" from a runtime bug into an API-level
// impossibility.

import { MEASUREMENT_IDS, type MeasurementId } from "../analysis/norms";
import {
  FACE_SHAPES,
  QUALITY_ISSUES,
  RECOMMENDATION_KEYS,
  VISION_MODULE_IDS,
} from "./contract";

type JsonSchema = Record<string, unknown>;

const num = { type: "number" } as const;
const str = { type: "string" } as const;
const bool = { type: "boolean" } as const;

function object(properties: Record<string, JsonSchema>): JsonSchema {
  return {
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  };
}

const measurementIdEnum: JsonSchema = { type: "string", enum: [...MEASUREMENT_IDS] };

/** { canthalTilt: number, esr: number, ... } — all 25 required. */
const measurementsObject = object(
  Object.fromEntries(MEASUREMENT_IDS.map((id: MeasurementId) => [id, num])),
);

/** { symmetry: {score, confidence}, ... } — all 9 required. */
const modulesObject = object(
  Object.fromEntries(
    VISION_MODULE_IDS.map((id) => [
      id,
      object({
        score: { type: ["number", "null"] },
        confidence: num,
      }),
    ]),
  ),
);

export const VISION_SCHEMA_NAME = "facescan_analysis";

export const VISION_JSON_SCHEMA: JsonSchema = object({
  faceDetected: bool,
  refusalReason: { type: ["string", "null"] },

  measurements: measurementsObject,
  unmeasurable: { type: "array", items: measurementIdEnum },

  modules: modulesObject,

  faceShape: { type: "string", enum: [...FACE_SHAPES] },
  skin: object({ toneUniformity: num, textureEnergy: num }),

  overall: num,
  percentile: num,
  confidence: num,

  quality: object({
    sharpness: num,
    motionBlur: num,
    exposure: num,
    noise: num,
    whiteBalance: num,
    resolution: num,
    frontality: num,
    occlusion: num,
    overall: num,
    pose: object({ yaw: num, pitch: num, roll: num }),
    issues: { type: "array", items: { type: "string", enum: [...QUALITY_ISSUES] } },
  }),

  strengths: { type: "array", items: measurementIdEnum },
  weaknesses: { type: "array", items: measurementIdEnum },
  recommendations: {
    type: "array",
    items: object({
      key: { type: "string", enum: [...RECOMMENDATION_KEYS] },
      source: measurementIdEnum,
    }),
  },

  notes: { type: "array", items: str },
});

/** The `text.format` block of a Responses API request. */
export const VISION_RESPONSE_FORMAT = {
  type: "json_schema" as const,
  name: VISION_SCHEMA_NAME,
  strict: true,
  schema: VISION_JSON_SCHEMA,
};
