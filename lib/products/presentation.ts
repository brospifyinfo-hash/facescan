// What a product card says a product is FOR, and what gets BETTER.
//
// WHY THIS IS DERIVED AND NOT A FIELD ON THE PRODUCT
// --------------------------------------------------
// The obvious shape is two more text boxes in the admin form. It fails the
// same way a free-text tag field fails, only quieter: whoever adds the tenth
// product writes "gut für die Haut" where the ninth said "stärkt die
// Hautbarriere", the cards stop reading as one system, and nothing reports
// it. Worse, the promise on the card can drift away from the tag that decides
// where the product is shown — a product tagged `hair` can end up promising
// clearer skin, and the copy and the matching contradict each other with no
// error anywhere.
//
// Both lines therefore come from the tags the product already carries, which
// are a closed vocabulary tied one-to-one to the action plan. The purpose is
// the plan step's own short label; the benefit is one sentence per tag,
// written once and translated four times. Adding a product needs no new
// prose, and a product can never claim an outcome for a problem it is not
// matched against.
//
// The free-text `description` stays on the model — the admin still uses it,
// and the report's own recommendation block still shows it. It is only the
// home-page card that leads with purpose and benefit, which is what was
// asked for.

import { PLAN_FOR_TAG, type ProblemTag } from "./types";
import type { Dict } from "@/lib/i18n/types";

/**
 * The category rail on the home page.
 *
 * A grouping OVER the closed tag vocabulary, not a second vocabulary: every
 * member is a real tag, so a filter can never select a category that no
 * product can be in. `null` means "everything, in match order".
 */
export const PRODUCT_CATEGORIES = [
  { id: "all", tags: null },
  { id: "skin", tags: ["skin_routine", "sun_protection"] },
  { id: "face", tags: ["jawline_definition", "tongue_posture", "proportions", "asymmetry", "body_fat"] },
  { id: "hair", tags: ["hair", "grooming"] },
  { id: "lifestyle", tags: ["sleep", "smoking", "training", "puffy_eyes"] },
] as const satisfies ReadonlyArray<{ id: string; tags: readonly ProblemTag[] | null }>;

export type CategoryId = (typeof PRODUCT_CATEGORIES)[number]["id"];

export function categoryMatches(category: CategoryId, tags: readonly ProblemTag[]): boolean {
  const spec = PRODUCT_CATEGORIES.find((c) => c.id === category);
  if (!spec || spec.tags === null) return true;
  return tags.some((tag) => (spec.tags as readonly ProblemTag[]).includes(tag));
}

/**
 * The card's two lines.
 *
 * The FIRST tag decides both. A product's tags are ordered as the admin
 * entered them, and the first is the one it is primarily for — using all of
 * them would produce "for skin, jawline, sleep and hair", which says nothing.
 * Null when a product carries no tags at all, and the card then falls back to
 * its description rather than showing an empty line.
 */
export function purposeAndBenefit(
  t: Dict,
  tags: readonly ProblemTag[],
): { purpose: string; benefit: string } | null {
  const tag = tags[0];
  if (!tag) return null;
  return {
    purpose: t.plan[PLAN_FOR_TAG[tag]].short,
    benefit: t.products.improves[tag],
  };
}
