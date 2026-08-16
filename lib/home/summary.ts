// The four numbers across the top of the home page.
//
// EVERY ONE OF THEM IS DERIVED FROM STORED SCANS, AND ANY OF THEM MAY BE
// NULL. That is the whole design of this file. The reference layout shows
// four filled tiles, which is what a returning customer with six scans sees —
// but a first-time visitor has none, and someone on their second scan has an
// improvement figure while someone on their first does not.
//
// The tempting shortcut is to render the reference's numbers as placeholders
// so the page always looks complete. That would be inventing customer data:
// "6 Scans, average 6.4" printed on a screen belonging to somebody who has
// never scanned is a lie the layout tells on the product's behalf. Null means
// the tile says so, and the page is designed to look right that way.
//
// Pure and dependency-free so the arithmetic can be tested without a store,
// a session or a network.

export interface ScanRecord {
  at: number;
  overall: number;
  potential?: number | null;
}

export interface HomeSummary {
  /** How many scans are on record. Zero is a real answer. */
  count: number;
  /** Mean headline score, or null when there is nothing to average. */
  avgScore: number | null;
  /**
   * Change from the earliest scan to the latest.
   *
   * Null with fewer than two scans — not zero. Zero means "you scanned twice
   * and nothing moved", which is a different statement from "there is no
   * second scan yet", and a tile showing +0.0 to a first-time user is wrong.
   */
  improvement: number | null;
  /**
   * Mean derived potential across the scans that carry one.
   *
   * The field arrived after the scans tab already existed, so older rows have
   * none — averaging over only the rows that have it is right, and null when
   * that set is empty.
   */
  avgPotential: number | null;
  /** The most recent scan, for the card underneath. */
  latest: ScanRecord | null;
}

const mean = (values: number[]): number | null =>
  values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length;

export function summarise(scans: readonly ScanRecord[]): HomeSummary {
  // Sorted here rather than trusted: the list arrives from a spreadsheet whose
  // rows a human can reorder by hand, and "improvement" is meaningless if
  // first and last are not actually first and last.
  const ordered = [...scans]
    .filter((s) => Number.isFinite(s.overall) && Number.isFinite(s.at))
    .sort((a, b) => a.at - b.at);

  if (ordered.length === 0) {
    return { count: 0, avgScore: null, improvement: null, avgPotential: null, latest: null };
  }

  const potentials = ordered
    .map((s) => s.potential)
    .filter((p): p is number => typeof p === "number" && Number.isFinite(p));

  return {
    count: ordered.length,
    avgScore: mean(ordered.map((s) => s.overall)),
    improvement:
      ordered.length >= 2 ? ordered[ordered.length - 1].overall - ordered[0].overall : null,
    avgPotential: mean(potentials),
    latest: ordered[ordered.length - 1],
  };
}

/**
 * The example figures, shown before anybody has scanned.
 *
 * WHY THIS IS NOT SIMPLY FAKE DATA. An empty dashboard is a bad first
 * impression and the page was designed around four filled tiles, so it has to
 * be populated on the first visit. What it must NOT do is state those numbers
 * as the visitor's own: every label here says "your scans", "your average",
 * and telling somebody who has never scanned that they have six of them is a
 * fabricated statement about that person — one that also breaks visibly the
 * moment they scan and the count drops from six to one.
 *
 * So the numbers are shown AND marked as an example. The page looks complete,
 * nobody is told something false about themselves, and the marker disappears
 * the instant there is a real reading to show. These are the values from the
 * design so the live page matches it exactly.
 */
export const DEMO_SUMMARY: HomeSummary = {
  count: 6,
  avgScore: 6.4,
  improvement: 0.8,
  avgPotential: 8.2,
  latest: { at: 0, overall: 6.4, potential: 8.2 },
};

/** One decimal, and a sign on the improvement because its direction is the point. */
export const fmtScore = (v: number | null): string => (v === null ? "—" : v.toFixed(1));

export const fmtDelta = (v: number | null): string =>
  v === null ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(v).toFixed(1)}`;
