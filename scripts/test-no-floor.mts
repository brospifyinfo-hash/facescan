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

console.log("\nSystematischer Versatz → Score\n" + "-".repeat(32));
const offsets = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4];
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

console.log(
  `\n${failures === 0 ? "BESTANDEN" : "FEHLGESCHLAGEN"}\n`,
);
process.exit(failures === 0 ? 0 : 1);
