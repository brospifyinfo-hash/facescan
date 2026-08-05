// What does the scorer actually do to a realistic face?
//
// The complaint is that attractive faces come out at ~3/10. This script
// answers the only question that matters: how many metrics have to miss
// their band, and by how much, before the headline collapses.
//
//   npx tsx scripts/diagnose-scoring.mts

import { SPECS, METRIC_ORDER, makeMetric } from "../lib/specs";
import { toOverall } from "../lib/metrics";
import { DEFAULT_WEIGHTS } from "../lib/analysis/weights";

const W = DEFAULT_WEIGHTS.categories;

/** Rebuild the composite the same way lib/measure.ts does. */
function composite(scores: Record<string, number>, symmetry: number) {
  const byCat: Record<string, number[]> = {};
  for (const id of METRIC_ORDER) {
    const c = SPECS[id].category;
    (byCat[c] ??= []).push(scores[id]);
  }
  const avg = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  const harmony =
    symmetry * W.symmetry +
    avg(byCat.eyes) * W.eyes +
    avg(byCat.jaw) * W.jaw +
    avg(byCat.proportions) * W.proportions +
    avg(byCat.midface) * W.midface;
  return { harmony, overall: toOverall(harmony) };
}

/** A face sitting dead centre of every published band. */
function centred() {
  const out: Record<string, number> = {};
  for (const id of METRIC_ORDER) {
    const [lo, hi] = SPECS[id].ideal;
    out[id] = makeMetric(id as never, (lo + hi) / 2).score;
  }
  return out;
}

/**
 * A face whose measurements sit `k` tolerances outside every band, in the
 * UNfavoured direction — i.e. the worst realistic case for a band that is
 * simply mis-centred for landmark-derived values.
 */
function offBy(k: number) {
  const out: Record<string, number> = {};
  for (const id of METRIC_ORDER) {
    const s = SPECS[id];
    out[id] = makeMetric(id as never, s.ideal[0] - s.tol * k).score;
  }
  return out;
}

/** Only `n` of the 15 metrics are pathological; the rest sit centred. */
function nBad(n: number, k: number) {
  const good = centred();
  const bad = offBy(k);
  const out: Record<string, number> = {};
  METRIC_ORDER.forEach((id, i) => {
    out[id] = i < n ? bad[id] : good[id];
  });
  return out;
}

const rows: string[][] = [];
const push = (label: string, scores: Record<string, number>, sym: number) => {
  const { harmony, overall } = composite(scores, sym);
  const vals = METRIC_ORDER.map((id) => scores[id]);
  const lowest = Math.min(...vals);
  rows.push([
    label,
    harmony.toFixed(1),
    overall.toFixed(1),
    String(Math.round(vals.reduce((s, v) => s + v, 0) / vals.length)),
    String(lowest),
  ]);
};

push("alle Bänder mittig, Symmetrie 95", centred(), 95);
push("alle Bänder mittig, Symmetrie 80", centred(), 80);
push("alle Bänder mittig, Symmetrie 65", centred(), 65);
for (const n of [1, 2, 3, 5, 8, 15]) {
  push(`${n}/15 Metriken 1.0 tol daneben`, nBad(n, 1.0), 85);
}
for (const k of [0.25, 0.5, 0.75, 1.0, 1.5]) {
  push(`alle 15 Metriken ${k} tol daneben`, offBy(k), 85);
}

const head = ["Fall", "harmony", "→ /10", "Ø Metrik", "min"];
const widths = head.map((h, i) =>
  Math.max(h.length, ...rows.map((r) => r[i].length)),
);
const line = (cells: string[]) =>
  cells.map((c, i) => (i === 0 ? c.padEnd(widths[i]) : c.padStart(widths[i]))).join("  ");

console.log(line(head));
console.log(widths.map((w) => "-".repeat(w)).join("  "));
for (const r of rows) console.log(line(r));
