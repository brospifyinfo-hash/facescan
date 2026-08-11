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
import { BRAND } from "./theme";

export interface Band {
  id: BandId;
  color: string;
}

// Cut points read off the modelled distribution in lib/percentile.ts
// (median 5.8), so the ladder is populated the way the scale implies rather
// than dumping half of everyone in the bottom tier. Resulting shares:
// Sub 3 ~8%, Sub 5 ~17%, LTN ~25%, MTN ~25%, HTN ~17%, Chad ~7%, True Adam ~1%.
// Colours ramp from the accent green to the caution amber, and the ramp is
// the only thing the band's colour says: near the reference, or further from
// it. It stops short of red at both the palette level and the semantic one —
// a measurement outside a reference band is unusual, not an error.
//
// THRESHOLDS ARE UNCHANGED by the redesign. Only the hexes moved, because the
// old ramp was olive-to-ochre against an olive accent and reads as dirt
// against the scanner green.
const THRESHOLDS: Array<[number, BandId, string]> = [
  [8.5, "elite", BRAND.accent],
  [7.6, "exceptional", BRAND.accent],
  [6.8, "strong", "#7cd98a"],
  [5.9, "solid", "#a6cf7e"],
  [4.7, "reference", "#ccc46b"],
  [3.1, "emerging", "#e0b555"],
];

export function bandFor(overall: number): Band {
  for (const [min, id, color] of THRESHOLDS) {
    if (overall >= min) return { id, color };
  }
  return { id: "developing", color: BRAND.caution };
}
