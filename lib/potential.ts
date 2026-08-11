// The potential headline: what the score would read if the measurements the
// person can actually influence sat at their reference value.
//
// WHY THIS IS COMPUTED AND NOT CHOSEN
// -----------------------------------
// A "potential score" is the easiest number in a product like this to make
// up. Pick the score plus 1.8, print it in green, and it will look exactly
// like this one — which is precisely why it has to be derived. The figure
// below is a re-run of the SAME aggregation that produced the headline, over
// the SAME measurements, with one thing changed: every measurement listed in
// ACTIONABLE is moved to its reference.
//
// ACTIONABLE is the existing list of measurements that behaviour, grooming,
// posture or capture genuinely move (lib/analysis/recommendations.ts).
// Everything absent from it is bone, so it is held at its measured value —
// the potential never assumes a jaw grows.
//
// THE LIFT IS APPLIED AS A DELTA, not as an absolute. The re-run covers the
// geometry modules only, while the live headline may also carry a skin module
// from the vision path. Taking `best - base` from two runs of the identical
// function and adding it to the real headline holds everything the re-run
// cannot see constant, which is the honest assumption: nothing here claims
// your skin improves, only that the geometry the actions move would.
//
// No report means no measurements to re-score, so this returns null and the
// UI drops the tile rather than showing a number with nothing behind it.

import { DEFAULT_WEIGHTS } from "./analysis/weights";
import {
  evaluateGeometryModules,
  meanAbsZFromComposite,
  MODULE_IDS,
  referenceOf,
} from "./analysis/modules";
import { ACTIONABLE } from "./analysis/recommendations";
import { NORMS, type MeasurementId, type Norm } from "./analysis/norms";
import type { ScanMetrics } from "./store";

export interface Potential {
  /** 0–10. Never below the current headline, never above 10. */
  score: number;
  /** score − overall, one decimal. Zero when nothing actionable is off. */
  lift: number;
  /** The measurements the lift is made of, most out-of-reference first. */
  drivers: MeasurementId[];
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * The engine's headline, recomputed from a set of measurement values.
 *
 * Mirrors WeightedScorer.score: confidence-weighted mean of the geometry
 * modules, inverted through the kernel to a mean SD-distance, mapped by the
 * display window. Written out rather than calling the engine because the
 * engine also wants quality, embedding stability and pose flags, none of
 * which differ between the two runs and none of which touch the score.
 */
function headline(
  values: Record<MeasurementId, number>,
  implausible: MeasurementId[],
): number {
  const modules = evaluateGeometryModules(values, implausible, DEFAULT_WEIGHTS.modules);

  let num = 0;
  let den = 0;
  for (const id of MODULE_IDS) {
    const m = modules[id];
    if (!m || m.score === null) continue;
    const effective = m.weight * m.confidence;
    if (effective <= 0) continue;
    num += effective * m.score;
    den += effective;
  }

  const composite = den > 0 ? num / den : 50;
  const { outLow, outHigh, perSd } = DEFAULT_WEIGHTS.display;
  return clamp(outHigh - perSd * meanAbsZFromComposite(composite), outLow, outHigh);
}

export function potentialFor(metrics: ScanMetrics): Potential | null {
  const report = metrics.report;
  if (!report || report.measurements.length === 0) return null;

  const values = {} as Record<MeasurementId, number>;
  const implausible: MeasurementId[] = [];
  for (const row of report.measurements) {
    values[row.id] = row.value;
    // `used: false` means the raw value failed its plausible range, so the
    // engine dropped it. It has to stay dropped in both runs or the lift
    // would come from a measurement that was never scored in the first place.
    if (!row.used) implausible.push(row.id);
  }

  const dropped = new Set(implausible);
  const ideal = { ...values };
  const gaps: Array<{ id: MeasurementId; z: number }> = [];

  for (const id of Object.keys(ACTIONABLE) as MeasurementId[]) {
    if (dropped.has(id) || !Number.isFinite(values[id])) continue;
    // NORMS is a const object, so each entry narrows to its own literal type
    // and `oneSided` is absent from the ones that do not declare it. Widening
    // to Norm is what scoreMeasurement() does for the same reason.
    const norm = NORMS[id] as Norm;
    const ref = referenceOf(norm, id);
    const z = (values[id] - ref) / norm.sd;
    // A deviation bounded at zero costs nothing below the reference, so a
    // face already on the good side of it has no headroom to claim here.
    if (norm.oneSided === "lower" && z <= 0) continue;
    if (Math.abs(z) < 0.05) continue;
    ideal[id] = ref;
    gaps.push({ id, z });
  }

  if (gaps.length === 0) {
    return { score: metrics.overall, lift: 0, drivers: [] };
  }

  const lift = Math.max(0, headline(ideal, implausible) - headline(values, implausible));
  const score = Number(Math.min(10, metrics.overall + lift).toFixed(1));

  return {
    score,
    lift: Number((score - metrics.overall).toFixed(1)),
    drivers: gaps.sort((a, b) => Math.abs(b.z) - Math.abs(a.z)).map((g) => g.id),
  };
}
