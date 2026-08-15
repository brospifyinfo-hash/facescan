// The strict structured output for stage 1.
//
// Same strict-mode rules as lib/vision/schema.ts: every object carries
// `additionalProperties: false`, every property appears in `required`, and
// there are no numeric or length keywords — the API rejects the request
// otherwise.
//
// "EXACTLY TWO HAIRSTYLES" IS A TYPE, NOT A REQUEST. Strict mode cannot
// constrain array length, and `minItems`/`maxItems` are forbidden, so asking
// for two in the prompt would leave "the model returned three" as a runtime
// surprise. Modelling the pair as an object with two required keys makes the
// count an API-level guarantee, the same trick the 25 measurements use.

import { STYLE_FACE_SHAPES, UPKEEP_LEVELS } from "./types";

const str = { type: "string" } as const;

const hairstyle = {
  type: "object",
  properties: {
    name: str,
    reason: str,
    barberBrief: str,
    upkeep: { type: "string", enum: [...UPKEEP_LEVELS] },
    imagePrompt: str,
  },
  required: ["name", "reason", "barberBrief", "upkeep", "imagePrompt"],
  additionalProperties: false,
} as const;

export const STYLE_RESPONSE_FORMAT = {
  type: "json_schema",
  name: "style_advice",
  strict: true,
  schema: {
    type: "object",
    properties: {
      faceShape: { type: "string", enum: [...STYLE_FACE_SHAPES] },
      shapeNote: str,
      // Two named keys, not an array — see the header.
      primary: hairstyle,
      alternate: hairstyle,
      projectionPrompt: str,
      projectionNote: str,
    },
    required: [
      "faceShape",
      "shapeNote",
      "primary",
      "alternate",
      "projectionPrompt",
      "projectionNote",
    ],
    additionalProperties: false,
  },
} as const;
