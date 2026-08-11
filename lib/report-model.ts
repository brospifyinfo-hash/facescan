// What the redesigned report reads, and where each figure comes from.
//
// The page used to compute this inline, which meant a change of layout was
// also a change of data mapping and the two could not be reviewed apart.
// Everything below is a pure function of ScanMetrics (+ the quiz, for the
// plan), so the components can be judged on how they look and this file on
// whether the numbers are the right ones.
//
// THE RULE THIS FILE KEEPS: nothing is synthesised to fill a slot. A module
// the pipeline could not evaluate comes back with `score: null` and its own
// reason, and the tile says so. That is why `skin` is null on the geometry
// path instead of quietly borrowing a number from somewhere adjacent.

import type { MetricId, RowId } from "./metrics";
import type { ModulePayload } from "./analysis/response";
import type { QuizAnswers, ScanMetrics } from "./store";
import { buildPlan } from "./plan";

export type { RowId };

export interface AnalysisRow {
  id: RowId;
  /** 0–10, or null when the module could not be evaluated. */
  score: number | null;
  /** Present only when score is null: why not. */
  note?: string;
}

/** Module scores are 0–100; every score the report shows is on 0–10. */
const toTen = (v: number) => Number((v / 10).toFixed(1));

function rowFrom(id: RowId, m: ModulePayload): AnalysisRow {
  return m.available && m.score !== null
    ? { id, score: toTen(m.score) }
    : { id, score: null, note: m.note };
}

export function analysisRows(metrics: ScanMetrics): AnalysisRow[] {
  const r = metrics.report;

  // No explainability payload means the demo path, which has no pixels and
  // therefore no modules — only the five composites the store carries. Five
  // real rows beat eight rows where three were invented.
  if (!r) {
    return [
      { id: "symmetry", score: toTen(metrics.symmetry) },
      { id: "eyes", score: toTen(metrics.eyesScore) },
      { id: "jaw", score: toTen(metrics.jawScore) },
      { id: "proportions", score: toTen(metrics.proportionsScore) },
      { id: "midface", score: toTen(metrics.midfaceScore) },
    ];
  }

  return [
    rowFrom("symmetry", r.symmetry),
    rowFrom("jaw", r.jaw),
    rowFrom("skin", r.skin),
    rowFrom("eyes", r.eyes),
    rowFrom("nose", r.nose),
    rowFrom("lips", r.lips),
    rowFrom("proportions", r.proportions),
    rowFrom("faceShape", r.faceShape),
  ];
}

/**
 * The strengths list.
 *
 * Taken from the measurements that actually scored highest, not from a
 * flattering sentence chosen for the tier. `metrics.metrics` is present on
 * every path including the demo, and each entry already carries a label in
 * the active dictionary — so this stays true in four languages without a
 * second set of strings to keep in sync.
 */
export function strengthsOf(metrics: ScanMetrics, n = 3): Array<{ id: MetricId; score: number }> {
  return [...metrics.metrics]
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((m) => ({ id: m.id, score: m.score }));
}

/**
 * The optimisation list — the real action plan, cut to the top entries.
 *
 * buildPlan() already ranks by expected impact against this scan and this
 * quiz, and its prose lives in the dictionaries. The panel shows the titles;
 * the full plan with detail and cadence is the paid ActionPlan below.
 */
export function optimisationsOf(quiz: QuizAnswers, metrics: ScanMetrics, n = 5) {
  return buildPlan(quiz, metrics).slice(0, n);
}

/**
 * A stable reference for this scan.
 *
 * FNV-1a over the measured values, so the same scan shows the same code on
 * every render and two different scans effectively never collide. It is a
 * checksum of the reading — deliberately NOT a record number, because
 * nothing is stored server-side to have a record in.
 */
export function scanRef(metrics: ScanMetrics): string {
  let h = 2166136261;
  const feed = (s: string) => {
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
  };
  feed(metrics.overall.toFixed(1));
  for (const m of metrics.metrics) feed(`${m.id}:${m.value.toFixed(4)}`);

  // Crockford base32 minus the vowels, so no five-character run can spell
  // anything, and minus the glyphs that read as each other in a mono face.
  const ALPHABET = "0123456789BCDFGHJKLMNPQRSTVWXYZ";
  let out = "";
  let v = h >>> 0;
  for (let i = 0; i < 5; i++) {
    out += ALPHABET[v % ALPHABET.length];
    v = Math.floor(v / ALPHABET.length);
  }
  return `FS-${out}`;
}
