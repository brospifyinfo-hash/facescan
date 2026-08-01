// Score band selection.
//
// Deliberately NOT the looksmaxxing tier ladder ("subhuman / incel / normie /
// chadlite / chad"). That vocabulary comes from a community with documented
// links to self-harm, and telling a paying user they rank "subhuman" is
// harmful for zero informational gain. These bands carry the same signal.
//
// Thresholds are set against the calibrated scorer in metrics.ts: landing
// inside the reference band on 16 independent measurements at once is rare,
// so the top band stays rare. A dashboard that calls everyone exceptional
// tells the user nothing.
//
// Labels live in lib/i18n; this module only picks the band and its colour.

import type { BandId } from "./metrics";

export interface Band {
  id: BandId;
  color: string;
}

export function bandFor(overall: number): Band {
  if (overall >= 8.6) return { id: "exceptional", color: "#95BF47" };
  if (overall >= 7.6) return { id: "strong", color: "#95BF47" };
  if (overall >= 6.6) return { id: "solid", color: "#A8C55F" };
  if (overall >= 5.4) return { id: "reference", color: "#C8BC5E" };
  return { id: "developing", color: "#D9A552" };
}
