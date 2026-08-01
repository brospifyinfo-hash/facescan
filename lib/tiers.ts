// Score band labels.
//
// Deliberately NOT the looksmaxxing tier ladder ("subhuman / incel / normie /
// chadlite / chad"). That vocabulary comes from a community with documented
// links to self-harm, and telling a paying user they rank "subhuman" is
// harmful for zero informational gain. These bands carry the same signal.
//
// Thresholds are set against the calibrated scorer in metrics.ts: landing
// inside the reference band on ~16 independent measurements at once is rare,
// so the top band stays rare too. A dashboard that calls everyone
// exceptional tells the user nothing.

export interface Band {
  label: string;
  blurb: string;
  color: string;
}

export function bandFor(overall: number): Band {
  if (overall >= 8.6)
    return {
      label: "Exceptional",
      blurb:
        "Top-band geometry across nearly every measurement. Your levers are refinement, not correction.",
      color: "#95BF47",
    };
  if (overall >= 7.6)
    return {
      label: "Strong",
      blurb:
        "Comfortably above the reference range. A few targeted fixes go a long way from here.",
      color: "#95BF47",
    };
  if (overall >= 6.6)
    return {
      label: "Solid",
      blurb: "A good baseline with clear, addressable upside.",
      color: "#A8C55F",
    };
  if (overall >= 5.4)
    return {
      label: "Reference Range",
      blurb:
        "Squarely typical — which is exactly where the biggest visible gains live.",
      color: "#C8BC5E",
    };
  return {
    label: "Developing",
    blurb:
      "Plenty of headroom. Start at the top of your plan and work down — the early items move the most.",
    color: "#D9A552",
  };
}
