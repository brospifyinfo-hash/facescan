// Score band selection.
//
// Seven tiers, deliberately NOT the looksmaxxing ladder ("sub 3 / sub 5 /
// ltn / mtn / htn / chad / true adam"). That vocabulary — and the grotesque
// caricature drawn for its bottom rungs — comes from a community with
// documented links to body dysmorphia and self-harm. Telling a paying user
// they rank "sub 3" beside a disfigured cartoon is an insult sold as an
// assessment, and it conveys nothing the neutral name doesn't.
//
// The visual ladder itself is kept: see components/dashboard/TierLadder.tsx,
// which draws seven neutral faces whose PROPORTIONS vary — which is what the
// score actually measures.
//
// Thresholds are set against the modelled distribution in lib/percentile.ts
// (median 6.5), so the top tiers stay genuinely rare.

import type { BandId } from "./metrics";

export interface Band {
  id: BandId;
  color: string;
}

const THRESHOLDS: Array<[number, BandId, string]> = [
  [8.6, "elite", "#95BF47"],
  [8.0, "exceptional", "#95BF47"],
  [7.4, "strong", "#9DC44F"],
  [6.8, "solid", "#A8C55F"],
  [6.0, "reference", "#C8BC5E"],
  [5.2, "emerging", "#D4B057"],
];

export function bandFor(overall: number): Band {
  for (const [min, id, color] of THRESHOLDS) {
    if (overall >= min) return { id, color };
  }
  return { id: "developing", color: "#D9A552" };
}
