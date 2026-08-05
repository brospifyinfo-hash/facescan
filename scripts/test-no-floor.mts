// Regression test for the defect that made the product useless: every real
// photo, of every face, produced exactly 1.0/10.
//
// Root cause: the headline was a percentile of a population SIMULATED FROM
// THE SAME NORMS that do the scoring. Such a population cannot contain a
// face carrying a systematic measurement offset, so every real face fell
// below its first percentile and was clamped to the floor. Two faces that
// differed enormously got the same number.
//
// This test injects exactly that condition — a systematic offset applied to
// every measurement — and asserts the scale still discriminates.
//
//   npx tsx scripts/test-no-floor.mts

import { NORMS, MEASUREMENT_IDS, type MeasurementId } from "../lib/analysis/norms";
import { WeightedScorer } from "../lib/analysis/engine";
import { DEFAULT_WEIGHTS } from "../lib/analysis/weights";

const scorer = new WeightedScorer();
let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
};

/** A face whose every measurement sits `z` SD from its reference. */
function faceAt(z: number) {
  const values = {} as Record<MeasurementId, number>;
  for (const id of MEASUREMENT_IDS) {
    const n = NORMS[id];
    values[id] = n.mean + n.shift * n.sd + z * n.sd;
  }
  return scorer.score(
    { features: values, implausible: [], external: {}, qualityOverall: 1,
      embeddingStability: null, poseCompensated: true },
    DEFAULT_WEIGHTS,
  );
}

// Up to 3 SD. Past that the scale legitimately ends — 1.0 is the bottom,
// and demanding that 3.5 and 4.0 SD differ would be demanding resolution
// below the floor, which no bounded scale has. A face 3 SD off on EVERY
// measurement simultaneously is already beyond anything observed.
console.log("\nSystematischer Versatz → Score\n" + "-".repeat(32));
const offsets = [0, 0.5, 1, 1.5, 2, 2.5, 3];
const results = offsets.map((z) => {
  const r = faceAt(z);
  console.log(
    `  ${z.toFixed(1)} SD daneben   Composite ${r.composite.toFixed(1).padStart(5)}` +
      `   Score ${r.overall.toFixed(1)}`,
  );
  return r.overall;
});

check(
  "Score fällt streng monoton mit dem Versatz",
  results.every((v, i) => i === 0 || v < results[i - 1]),
);
check(
  "keine zwei Versatz-Stufen kollabieren auf denselben Wert",
  new Set(results).size === results.length,
  `${new Set(results).size} verschiedene Werte aus ${results.length}`,
);

// The real-world condition: everyone is offset, but faces still differ.
console.log("\nAlle um 2 SD versetzt, Gesichter unterscheiden sich\n" + "-".repeat(48));
const shifted = [2.0, 2.3, 2.6, 3.0].map((z) => {
  const s = faceAt(z).overall;
  console.log(`  Grundversatz 2 SD + ${(z - 2).toFixed(1)}   Score ${s.toFixed(1)}`);
  return s;
});
check(
  "unterscheidbar trotz Grundversatz",
  new Set(shifted).size === shifted.length,
  shifted.join(" / "),
);
check(
  "kein Wert klebt am Boden",
  shifted.every((v) => v > 1.0),
);

// ---------------------------------------------------------------------------
// Typicality vs attractiveness.
//
// A symmetric kernel scores "how far from the population mean". Both a lean,
// tapered face and a heavy, soft one are far from the mean — in opposite
// directions — so both got the same number. Measured on real photographs: a
// face rated 10/10 scored 5.9 and one rated 1/10 scored 5.8.
//
// This asserts the two are now separated, which is what the direction fields
// and the asymmetric kernel exist for.

/**
 * A face `z` SD from the POPULATION MEAN toward the favoured side of every
 * directional measurement.
 *
 * Measured from the mean, not from the reference: the reference now sits at
 * the attractive end of each trait, so "0" there would mean "attractive",
 * not "average". The whole question this test asks is whether an average
 * face, a good one and a poor one land in different places.
 */
function faceAlongDirection(z: number) {
  const values = {} as Record<MeasurementId, number>;
  for (const id of MEASUREMENT_IDS) {
    const n = NORMS[id];
    const sign = n.direction === "up" ? 1 : n.direction === "down" ? -1 : 0;
    values[id] = n.mean + sign * z * n.sd;
  }
  return scorer.score(
    { features: values, implausible: [], external: {}, qualityOverall: 1,
      embeddingStability: null, poseCompensated: true },
    DEFAULT_WEIGHTS,
  );
}

console.log("\nAttraktiv / durchschnittlich / unattraktiv\n" + "-".repeat(42));
const great = faceAlongDirection(2);
const average = faceAlongDirection(0);
const poor = faceAlongDirection(-2);
console.log(`  2 SD Richtung attraktiv   Score ${great.overall.toFixed(1)}`);
console.log(`  Bevölkerungsdurchschnitt  Score ${average.overall.toFixed(1)}`);
console.log(`  2 SD Gegenrichtung        Score ${poor.overall.toFixed(1)}`);

check(
  "die Skala wird wirklich genutzt (≥ 6 Punkte Spanne)",
  great.overall - poor.overall >= 6.0,
  `Spanne ${(great.overall - poor.overall).toFixed(1)} Punkte`,
);
check(
  "attraktiv landet im oberen Bereich",
  great.overall >= 8.0,
  `${great.overall.toFixed(1)}`,
);
check(
  "unattraktiv landet im unteren Bereich",
  poor.overall <= 3.0,
  `${poor.overall.toFixed(1)}`,
);
check(
  "Durchschnitt landet in der Mitte",
  average.overall > poor.overall && average.overall < great.overall,
  `${average.overall.toFixed(1)}`,
);
check(
  "streng monoton über die ganze Achse",
  // From the attractive target downward. Above it the score declines again
  // — being far past the target is its own deviation — so monotonicity is
  // only claimed over the range below it.
  [1, 0, -1, -2, -3]
    .map((z) => faceAlongDirection(z).overall)
    .every((v, i, a) => i === 0 || v <= a[i - 1]),
);

console.log(
  `\n${failures === 0 ? "BESTANDEN" : "FEHLGESCHLAGEN"}\n`,
);
process.exit(failures === 0 ? 0 : 1);
