// Ranking products against a scan.
//
// PURE, AND IT REUSES THE RANKING THAT ALREADY EXISTS
// ---------------------------------------------------
// The user's problems are not derived again here. buildPlan() in lib/plan.ts
// already decides, deterministically, which levers matter for this face and
// these quiz answers, and how much each one is worth — that is what drives
// the action plan and the optimisation column. This module turns those same
// weights into product relevance.
//
// Writing a second scoring pass would create the failure that is impossible
// to spot in review and obvious to a customer: a report whose plan says body
// fat is the biggest lever, next to a shop row led by an eyebrow pencil.
//
// It takes the scan as an argument and returns a value. No fetch, no store,
// no clock — so it runs in the browser, where the scan already is and where
// it can stay. See the note in app/api/products/route.ts.

import type { Product, ProblemTag } from "./types";
import { TAG_FOR_PLAN } from "./types";
import { buildPlan } from "@/lib/plan";
import type { QuizAnswers, ScanMetrics } from "@/lib/store";

export interface ScoredProduct {
  product: Product;
  /** Higher is more relevant. Comparable only within one scan. */
  score: number;
  /** Which of the user's problems this product was matched on, best first. */
  matched: ProblemTag[];
}

export interface Recommendations {
  /** The three strongest matches. Fewer when fewer products match at all. */
  top: ScoredProduct[];
  /** Everything else that matched, same order. */
  others: ScoredProduct[];
  /** The user's problems, strongest first — for explaining an empty result. */
  tags: ProblemTag[];
}

export const TOP_N = 3;

/**
 * How much the 2nd and 3rd matched tag contribute, relative to the 1st.
 *
 * A plain sum of matched weights was the first shape and it is wrong: it pays
 * for breadth, so the way to rank first is to tick every checkbox in the admin
 * form. Under this rule relevance is driven by the single biggest problem a
 * product addresses, the next two help progressively less, and a fourth tag is
 * worth nothing at all — so over-tagging cannot buy a position.
 */
const CONTRIBUTION = [1, 0.35, 0.12];

/** The user's problems as tag → weight, from the action plan. */
export function tagWeights(
  quiz: QuizAnswers,
  metrics: ScanMetrics,
): Map<ProblemTag, number> {
  const weights = new Map<ProblemTag, number>();
  for (const entry of buildPlan(quiz, metrics)) {
    const tag = TAG_FOR_PLAN[entry.id];
    // buildPlan can emit the same lever twice from different rules; the
    // stronger reason is the one that should count.
    weights.set(tag, Math.max(weights.get(tag) ?? 0, entry.weight));
  }
  return weights;
}

export function recommend(
  catalogue: Product[],
  quiz: QuizAnswers,
  metrics: ScanMetrics,
): Recommendations {
  const weights = tagWeights(quiz, metrics);
  const tags = [...weights.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag);

  const scored: ScoredProduct[] = [];
  for (const product of catalogue) {
    if (!product.active) continue;

    const hits = product.tags
      .map((tag) => ({ tag, weight: weights.get(tag) ?? 0 }))
      .filter((h) => h.weight > 0)
      .sort((a, b) => b.weight - a.weight);

    // No overlap with this user's problems: not shown at all. A catalogue is
    // not a shop window here, it is an answer to a specific reading.
    if (hits.length === 0) continue;

    let score = 0;
    for (let i = 0; i < hits.length && i < CONTRIBUTION.length; i++) {
      score += hits[i].weight * CONTRIBUTION[i];
    }

    scored.push({
      product,
      score: Number(score.toFixed(2)),
      matched: hits.map((h) => h.tag),
    });
  }

  // Deterministic to the last field: the same scan and the same catalogue
  // must produce the same order on every render, or the top three would
  // reshuffle under the user between two visits to the page.
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      a.product.createdAt - b.product.createdAt ||
      a.product.id.localeCompare(b.product.id),
  );

  return { top: scored.slice(0, TOP_N), others: scored.slice(TOP_N), tags };
}
