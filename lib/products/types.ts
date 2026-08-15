// Affiliate products, and the vocabulary that connects them to a scan.
//
// THE TAG SET IS CLOSED, AND THAT IS THE WHOLE DESIGN DECISION HERE
// ----------------------------------------------------------------
// The obvious shape for `matching_tags` is `string[]`: type whatever you
// like into the admin form. It fails in one direction and fails silently.
// A product tagged "puffy-face" when the scan emits "puffy_eyes" matches
// nothing, forever, and nothing anywhere reports it — the product simply
// never appears and the only symptom is revenue that was never there.
//
// So the vocabulary is a union, the admin UI offers checkboxes rather than a
// text field, and the API rejects an unknown tag instead of storing it.
//
// It is also NOT an arbitrary list. Every tag corresponds to exactly one
// entry of the action plan in lib/plan.ts, which is the thing that already
// decides what this user's problems are and how much each one matters. That
// buys three properties worth more than free-text flexibility:
//
//   * a tag can only exist if the scan can actually produce it, so no
//     product is ever tagged against a signal that never fires;
//   * the match score is the plan's own weight, so the ranking cannot drift
//     away from the advice shown two sections higher up the page;
//   * adding a problem category is adding a rule to buildPlan(), which is
//     where that logic belongs and where it is already tested.
//
// Adding a tag: extend PROBLEM_TAGS, add the PlanId mapping in TAG_FOR_PLAN,
// add a label to every dictionary. The type checker will name every gap.

import type { PlanId } from "@/lib/metrics";

export const PROBLEM_TAGS = [
  "body_fat",
  "jawline_definition",
  "tongue_posture",
  "skin_routine",
  "sun_protection",
  "asymmetry",
  "puffy_eyes",
  "proportions",
  "hair",
  "grooming",
  "sleep",
  "smoking",
  "training",
] as const;

export type ProblemTag = (typeof PROBLEM_TAGS)[number];

const TAG_SET: ReadonlySet<string> = new Set(PROBLEM_TAGS);

export const isProblemTag = (v: unknown): v is ProblemTag =>
  typeof v === "string" && TAG_SET.has(v);

/**
 * Plan entry → the tag a product uses to opt into it.
 *
 * `satisfies` rather than a bare annotation so a new PlanId is a compile
 * error here, not a category that silently matches nothing.
 */
export const TAG_FOR_PLAN = {
  bodyFat: "body_fat",
  guaSha: "jawline_definition",
  tonguePosture: "tongue_posture",
  retinoid: "skin_routine",
  spf: "sun_protection",
  asymmetry: "asymmetry",
  depuff: "puffy_eyes",
  proportions: "proportions",
  hair: "hair",
  grooming: "grooming",
  sleep: "sleep",
  smoking: "smoking",
  training: "training",
} as const satisfies Record<PlanId, ProblemTag>;

/**
 * The inverse of TAG_FOR_PLAN, derived rather than written out.
 *
 * It exists so a tag can borrow the label the action plan already uses for
 * the same lever — the admin checkbox and the customer's plan then say the
 * same words, in whatever language is active, from one source.
 */
export const PLAN_FOR_TAG = Object.fromEntries(
  Object.entries(TAG_FOR_PLAN).map(([plan, tag]) => [tag, plan]),
) as Record<ProblemTag, PlanId>;

export interface Product {
  /** UUID v4. Generated server-side; a client-supplied id is ignored. */
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  affiliateLink: string;
  tags: ProblemTag[];
  /** Soft switch. Retiring a product must not break an old recommendation. */
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

/** What the admin form sends. Server owns id and the timestamps. */
export type ProductInput = Omit<Product, "id" | "createdAt" | "updatedAt">;

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  value?: ProductInput;
}

/**
 * URLs come from a human pasting into a form, and both of them are rendered
 * into the DOM — imageUrl into <img src>, affiliateLink into <a href>. A
 * `javascript:` or `data:` URL in either is stored XSS with an admin as the
 * delivery mechanism, so the scheme is checked here rather than trusted
 * because "only we can edit it".
 */
function checkUrl(raw: string, field: string, errors: string[]): void {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    errors.push(`${field}: not a valid absolute URL`);
    return;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    errors.push(`${field}: only http and https are allowed, got ${url.protocol}`);
  }
}

const LIMITS = { title: 120, description: 600, url: 2000 } as const;

export function validateProduct(body: unknown): ValidationResult {
  const errors: string[] = [];
  const b = (body ?? {}) as Record<string, unknown>;

  const str = (key: string, max: number, required = true): string => {
    const v = typeof b[key] === "string" ? (b[key] as string).trim() : "";
    if (required && v.length === 0) errors.push(`${key}: required`);
    if (v.length > max) errors.push(`${key}: longer than ${max} characters`);
    return v;
  };

  const title = str("title", LIMITS.title);
  const description = str("description", LIMITS.description);
  const imageUrl = str("imageUrl", LIMITS.url);
  const affiliateLink = str("affiliateLink", LIMITS.url);

  if (imageUrl) checkUrl(imageUrl, "imageUrl", errors);
  if (affiliateLink) checkUrl(affiliateLink, "affiliateLink", errors);

  const rawTags = Array.isArray(b.tags) ? b.tags : [];
  const unknown = rawTags.filter((t) => !isProblemTag(t));
  if (unknown.length > 0) {
    errors.push(`tags: unknown ${unknown.map(String).join(", ")}`);
  }
  // Deduplicated: a tag twice would count twice in the score and quietly
  // push a product to the top of the list.
  const tags = [...new Set(rawTags.filter(isProblemTag))];
  if (tags.length === 0) {
    errors.push("tags: at least one is required, or the product can never match");
  }

  const active = b.active === undefined ? true : b.active === true;

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    errors: [],
    value: { title, description, imageUrl, affiliateLink, tags, active },
  };
}
