// The style studio: what the model is allowed to say, and what it may draw.
//
// TWO STAGES, DELIBERATELY SEPARATE
// ---------------------------------
// Stage 1 is a judgement — which cuts suit THIS face — and it is a text call
// with a strict schema, so it is cheap, fast, cacheable and testable.
// Stage 2 is a picture, which is slow and expensive and can fail on its own.
//
// Fusing them into one endpoint would mean a single request that takes most
// of a minute and, when the third image fails, throws away the advice too.
// Split, the customer reads the recommendation seconds after uploading and
// the pictures arrive under it as they finish.
//
// THE PROMPT THE IMAGE MODEL GETS IS WRITTEN BY STAGE 1, NOT BY US. We
// cannot know from here that a face needs weight off the sides rather than
// height on top. The model that looked at the photograph decides, and hands
// down a rendering instruction. What this file fixes is the FRAME around
// that instruction — see renderPrompt() in ./prompt.ts.

/** The face shapes stage 1 may classify into. Closed vocabulary. */
export const STYLE_FACE_SHAPES = [
  "oval",
  "round",
  "square",
  "oblong",
  "heart",
  "diamond",
  "triangle",
] as const;
export type StyleFaceShape = (typeof STYLE_FACE_SHAPES)[number];

/**
 * How much upkeep a cut demands. The customer is buying a plan they have to
 * live with, so a cut that needs a barber every three weeks is a different
 * proposition from one that grows out gracefully, and saying so is worth
 * more than another adjective about how good it looks.
 */
export const UPKEEP_LEVELS = ["low", "medium", "high"] as const;
export type UpkeepLevel = (typeof UPKEEP_LEVELS)[number];

export interface HairstyleRec {
  /** The cut's common name, e.g. "Textured crop". */
  name: string;
  /** Why THIS cut suits THIS face. Must reference an observed feature. */
  reason: string;
  /** What to ask the barber for. Concrete enough to repeat at the counter. */
  barberBrief: string;
  upkeep: UpkeepLevel;
  /** Stage 1's instruction to the image model. Never shown to the customer. */
  imagePrompt: string;
}

export interface StyleAdvice {
  faceShape: StyleFaceShape;
  /** One line on what the shape implies for hair. Shown above the cards. */
  shapeNote: string;
  /** Exactly two. The count is enforced by the schema, not by hope. */
  hairstyles: [HairstyleRec, HairstyleRec];
  /**
   * The projection prompt — the separate "after the plan" picture.
   *
   * Written by stage 1 because only the model that saw the face knows which
   * of the plan's effects are visible on it. Constrained hard by
   * projectionPrompt(): see the honesty note there.
   */
  projectionPrompt: string;
  /** What the projection image is actually showing. Shown under it. */
  projectionNote: string;
}

/** One rendered picture. */
export type StyleImageKind = "hairstyle" | "projection";

export interface RenderRequest {
  kind: StyleImageKind;
  /** Index into `hairstyles` — only meaningful for kind "hairstyle". */
  index: number;
  prompt: string;
}

export const MAX_PROMPT_CHARS = 1200;

/**
 * Guard the prompt that comes back from the client on the render call.
 *
 * The client holds the advice between the two stages, so the render endpoint
 * receives a prompt over the wire and MUST NOT treat it as ours. Without
 * this, /api/style/render is an open image generator wearing our API key:
 * anyone could post any prompt and have us pay for it.
 *
 * The length cap and the frame in prompt.ts are the two halves of that
 * defence — this bounds the size, the frame bounds the subject.
 */
export function sanitisePrompt(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length < 8 || clean.length > MAX_PROMPT_CHARS) return null;
  return clean;
}
