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

/** A face `z` SD toward the favoured side of every directional measurement. */
function faceAlongDirection(z: number) {
  const values = {} as Record<MeasurementId, number>;
  for (const id of MEASUREMENT_IDS) {
    const n = NORMS[id];
    const sign = n.direction === "up" ? 1 : n.direction === "down" ? -1 : 0;
    values[id] = n.mean + n.shift * n.sd + sign * z * n.sd;
  }
  return scorer.score(
    { features: values, implausible: [], external: {}, qualityOverall: 1,
      embeddingStability: null, poseCompensated: true },
    DEFAULT_WEIGHTS,
  );
}

console.log("\nSchlank/definiert vs. weich/voll — gleiche |z|, andere Richtung\n" + "-".repeat(62));
const lean = faceAlongDirection(2);
const full = faceAlongDirection(-2);
const neutral = faceAlongDirection(0);
console.log(`  2 SD in die günstige Richtung   Score ${lean.overall.toFixed(1)}`);
console.log(`  genau auf der Referenz          Score ${neutral.overall.toFixed(1)}`);
console.log(`  2 SD in die ungünstige Richtung Score ${full.overall.toFixed(1)}`);

check(
  "günstige und ungünstige Richtung werden getrennt",
  lean.overall - full.overall >= 2.0,
  `Differenz ${(lean.overall - full.overall).toFixed(1)} Punkte`,
);
// The property that matters is RELATIVE, not absolute: deviating the
// favoured way must cost markedly less than deviating the other way. An
// absolute bound would just be a threshold picked to pass.
const costFavoured = neutral.overall - lean.overall;
const costUnfavoured = neutral.overall - full.overall;
check(
  "günstige Abweichung kostet weniger als die Hälfte der ungünstigen",
  costFavoured < costUnfavoured / 2,
  `${costFavoured.toFixed(1)} vs ${costUnfavoured.toFixed(1)} Punkte`,
);
check(
  "kein Extrem schlägt die Referenz",
  lean.overall <= neutral.overall,
  `Referenz ${neutral.overall.toFixed(1)}, Extrem ${lean.overall.toFixed(1)}`,
);

console.log(
  `\n${failures === 0 ? "BESTANDEN" : "FEHLGESCHLAGEN"}\n`,
);
process.exit(failures === 0 ? 0 : 1);
