// The rating scale GPT-4.1 is held to, and its inverse.
//
// WHY THIS FILE IS SHARED BETWEEN THE PROMPT AND THE CODE
// ------------------------------------------------------
// A rubric that only exists in the prompt is a rubric the product cannot
// check. The same anchor table is rendered into the system prompt AND used
// to convert a score into a percentile, so the badge under the headline can
// never tell a different story from the number above it.
//
// WHY THE ANCHORS ARE WHERE THEY ARE
// ----------------------------------
// They are read off the tier ladder this product already ships
// (lib/tiers.ts): developing <3.1, emerging <4.7, reference <5.9, solid
// <6.8, strong <7.6, exceptional <8.5, elite ≥8.5. Choosing the population
// shares first and the anchors second would have produced a scale whose
// band names meant something different from what the ladder says.
//
// The resulting shares: developing ~8%, emerging ~24%, reference ~24%,
// solid ~17%, strong ~8%, exceptional ~5%, elite ~2.8%. Median lands at
// 5.35 — a strict scale, in which most people are told they are ordinary,
// which is what "streng" means and what the request asked for.
//
// The pure geometric pipeline does NOT use this mapping; it keeps
// COMPOSITE_CDF, because its composite is a different quantity. Both live
// side by side and lib/percentile.ts picks by source.

/** score → share of the adult population scoring below it. Monotone. */
export const SCORE_PERCENTILE_ANCHORS: ReadonlyArray<readonly [number, number]> = [
  [1.0, 0.0],
  [2.0, 2.0],
  [3.0, 8.0],
  [3.5, 14.0],
  [4.0, 22.0],
  [4.5, 32.0],
  [5.0, 44.0],
  [5.5, 56.0],
  [6.0, 67.0],
  [6.5, 76.0],
  [7.0, 84.0],
  [7.5, 90.0],
  [8.0, 94.5],
  [8.5, 97.2],
  [9.0, 98.8],
  [9.5, 99.7],
  [10.0, 99.99],
];

export const SCORE_MIN = 1.0;
export const SCORE_MAX = 10.0;

/** Percentile of a vision score, linearly interpolated between anchors. */
export function percentileOfVisionScore(overall: number): number {
  const a = SCORE_PERCENTILE_ANCHORS;
  if (overall <= a[0][0]) return a[0][1];
  if (overall >= a[a.length - 1][0]) return a[a.length - 1][1];
  for (let i = 1; i < a.length; i++) {
    const [x1, y1] = a[i];
    if (overall <= x1) {
      const [x0, y0] = a[i - 1];
      const t = (overall - x0) / (x1 - x0 || 1);
      return y0 + t * (y1 - y0);
    }
  }
  return a[a.length - 1][1];
}

/**
 * The rubric as prose, rendered into the system prompt verbatim.
 *
 * Anchors are described by RARITY rather than by adjectives, because
 * "attractive" is a word the model will interpret differently on every
 * call while "roughly one person in forty" is not.
 */
export function rubricText(): string {
  const rows = SCORE_PERCENTILE_ANCHORS.map(([score, pct]) => {
    const above = 100 - pct;
    const rarity =
      above >= 50
        ? `${above.toFixed(0)}% of adults score higher`
        : above >= 1
          ? `top ${above.toFixed(above < 10 ? 1 : 0)}%`
          : `top ${above.toFixed(2)}% — roughly 1 in ${Math.round(100 / Math.max(above, 0.001))}`;
    return `  ${score.toFixed(1)}  →  ${pct.toFixed(2)}th percentile  (${rarity})`;
  }).join("\n");

  return `SCORE ANCHORS — the calibration you must hold to on every call.
Each row states what share of the general adult population scores BELOW
that number. Place the face on this table; do not reason about it in words
first and then attach a number.

${rows}

Band names this scale maps onto (the product shows them):
  < 3.1  developing      3.1-4.7  emerging      4.7-5.9  reference
  5.9-6.8 solid          6.8-7.6  strong        7.6-8.5  exceptional
  >= 8.5 elite

CONSEQUENCES YOU MUST ACCEPT:
- The MEDIAN face scores 5.3. An ordinary, pleasant, unremarkable face is a
  5, not a 7. Most photographs you are given are 4 to 6.
- 8.0 is one person in twenty. Reserve it for a face that would be
  professionally castable.
- 9.0 is one in a hundred. 9.5 is one in three hundred.
- 10.0 is effectively never awarded. It requires a face at the absolute
  ceiling of human variation — fewer than one in ten thousand. If you are
  weighing whether a face is a 10, it is a 9.
- Do not compress toward the middle out of politeness, and do not inflate
  because the person photographed themselves carefully. Both are failures
  of calibration.`;
}
