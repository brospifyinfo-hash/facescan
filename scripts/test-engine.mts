// Test suite for the analysis engine.
//
//   npx tsx scripts/test-engine.mts
//
// Covers what the requirement asked for: symmetric and asymmetric faces,
// different capture angles, different lighting, men, women and age groups —
// plus the invariants the architecture depends on.
//
// Everything runs on the synthetic fixture, because the questions being
// asked ("does the SAME face score the same from another angle") need a
// ground truth that no photograph provides. What this suite cannot test is
// whether the norms describe real people; only real measurements can, and
// that is what /calibrate collects.

import { measure } from "../lib/measure";
import { geometryAnalyzer } from "../lib/analysis/geometry";
import { WeightedScorer } from "../lib/analysis/engine";
import { DEFAULT_WEIGHTS, validateWeights } from "../lib/analysis/weights";
import { validateNorms, NORMS, MEASUREMENT_IDS } from "../lib/analysis/norms";
import { scoreMeasurement, TOLERANCE_SD } from "../lib/analysis/modules";
import { recommendationEngine } from "../lib/analysis/recommendations";
import { fitRidge, pearson, toFeatureRow } from "../lib/analysis/training";
import {
  MALE, FEMALE, atAge, buildFace, jitter, pose, rescale,
  type FaceParams,
} from "./synthetic-face.mts";
import type { Point3 } from "../lib/analysis/landmarks";

let failures = 0;
let checks = 0;

function check(name: string, ok: boolean, detail = "") {
  checks++;
  if (!ok) failures++;
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

function section(title: string) {
  console.log(`\n${title}\n${"-".repeat(title.length)}`);
}

const scorer = new WeightedScorer();

/** Score a mesh exactly as the runtime does, minus the pixel stages. */
function scoreOf(pts: Point3[], quality = 1) {
  const geometry = geometryAnalyzer.analyze(pts);
  const score = scorer.score(
    {
      features: geometry.values,
      implausible: geometry.implausible,
      external: {},
      qualityOverall: quality,
      embeddingStability: null,
      poseCompensated: geometry.aligned.poseCompensated,
    },
    DEFAULT_WEIGHTS,
  );
  return { geometry, score };
}

const spread = (a: number[]) => Math.max(...a) - Math.min(...a);

// ---------------------------------------------------------------------------
section("1. Konfiguration");

const normProblems = validateNorms();
check("norms sind in sich konsistent", normProblems.length === 0,
  normProblems.map((p) => `${p.id}: ${p.problem}`).join("; "));

const weightProblems = validateWeights();
check("Gewichte summieren sich korrekt", weightProblems.length === 0,
  weightProblems.map((p) => `${p.field}: ${p.problem}`).join("; "));

check(
  "jede Metrik im Modul-Mapping hat eine Norm",
  MEASUREMENT_IDS.every((id) => NORMS[id] !== undefined),
);

// The kernel must be monotone in |z| — no local maximum a face could game.
const zs = [0, 0.5, 1, 1.5, 2, 3, 4];
const kernel = zs.map((z) => 100 * Math.exp(-0.5 * (z / TOLERANCE_SD) ** 2));
check(
  "Score fällt monoton mit |z|",
  kernel.every((v, i) => i === 0 || v < kernel[i - 1]),
  kernel.map((v) => v.toFixed(0)).join(" > "),
);

// The old scorer's defect: an extreme value outranking a moderate one.
const moderate = scoreMeasurement("canthalTilt", NORMS.canthalTilt.mean + 1.0);
const extreme = scoreMeasurement("canthalTilt", NORMS.canthalTilt.mean + 4.0);
check(
  "extremer Wert schlägt moderaten NICHT mehr",
  extreme.score < moderate.score,
  `moderat ${moderate.score.toFixed(1)} vs extrem ${extreme.score.toFixed(1)}`,
);

// A deviation measure must not be punished for being below average.
const perfect = scoreMeasurement("symmetryDeviation", 0);
check(
  "perfekte Symmetrie wird nicht bestraft",
  perfect.score > 99,
  `score ${perfect.score.toFixed(1)}`,
);

// ---------------------------------------------------------------------------
section("2. Stabilität — dasselbe Gesicht, andere Aufnahme");

const base = buildFace(MALE);
const reference = scoreOf(base).score.overall;

const variants: Array<[string, Point3[]]> = [
  ["frontal", base],
  ["yaw +10°", pose(base, { yawDeg: 10 })],
  ["yaw -10°", pose(base, { yawDeg: -10 })],
  ["yaw +20°", pose(base, { yawDeg: 20 })],
  ["pitch +10°", pose(base, { pitchDeg: 10 })],
  ["pitch -8°", pose(base, { pitchDeg: -8 })],
  ["roll +12°", pose(base, { rollDeg: 12 })],
  ["kombiniert", pose(base, { yawDeg: 14, pitchDeg: -7, rollDeg: 6 })],
  ["näher (1.25×)", rescale(base, 1.25)],
  ["weiter (0.8×)", rescale(base, 0.8)],
  ["Landmark-Rauschen", jitter(base, 0.0012, 7)],
  ["Rauschen + yaw", jitter(pose(base, { yawDeg: 12 }), 0.0012, 11)],
];

const scores = variants.map(([label, pts]) => {
  const s = scoreOf(pts).score.overall;
  console.log(`         ${label.padEnd(20)} ${s.toFixed(1)}`);
  return s;
});

const drift = spread(scores);
check(
  "Streuung über alle Aufnahmen ≤ 0.4 Punkte",
  drift <= 0.4,
  `Streuung ${drift.toFixed(2)} (Referenz ${reference.toFixed(1)})`,
);

// Pose compensation must be doing the work — verify it is actually active.
check(
  "Pose-Kompensation ist aktiv (z nutzbar)",
  scoreOf(pose(base, { yawDeg: 20 })).geometry.aligned.poseCompensated,
);

// ---------------------------------------------------------------------------
section("3. Symmetrie");

const symmetric = buildFace({ ...MALE, asymmetryMm: 0 });
const slightlyOff = buildFace({ ...MALE, asymmetryMm: 3 });
const clearlyOff = buildFace({ ...MALE, asymmetryMm: 8 });

const symScores = [symmetric, slightlyOff, clearlyOff].map(
  (f) => scoreOf(f).geometry.values.symmetryDeviation,
);
console.log(
  `         Abweichung: ${symScores.map((v) => v.toFixed(4)).join("  ")}`,
);
check(
  "Asymmetrie wird monoton erkannt",
  symScores[0] < symScores[1] && symScores[1] < symScores[2],
);

const symOverall = [symmetric, slightlyOff, clearlyOff].map(
  (f) => scoreOf(f).score.overall,
);
console.log(`         Score:      ${symOverall.map((v) => v.toFixed(1)).join("     ")}`);
check(
  "symmetrisches Gesicht schlägt asymmetrisches",
  symOverall[0] > symOverall[2],
  `${symOverall[0].toFixed(1)} vs ${symOverall[2].toFixed(1)}`,
);

// The regression that started this: a symmetric face photographed turned
// must not be read as asymmetric.
const symTurned = scoreOf(pose(symmetric, { yawDeg: 18 })).geometry.values
  .symmetryDeviation;
check(
  "gedrehtes symmetrisches Gesicht bleibt symmetrisch",
  symTurned < symScores[1],
  `gedreht ${symTurned.toFixed(4)} vs leicht asymmetrisch ${symScores[1].toFixed(4)}`,
);

// ---------------------------------------------------------------------------
section("4. Bildqualität beeinflusst nur die Confidence");

const good = scoreOf(base, 0.95);
const poor = scoreOf(base, 0.35);
check(
  "schlechtes Licht ändert den Score nicht",
  good.score.overall === poor.score.overall,
  `${good.score.overall.toFixed(1)} vs ${poor.score.overall.toFixed(1)}`,
);
check(
  "schlechtes Licht senkt die Confidence",
  poor.score.confidence < good.score.confidence,
  `${good.score.confidence.toFixed(3)} → ${poor.score.confidence.toFixed(3)}`,
);

// ---------------------------------------------------------------------------
section("5. Demografie — kein systematischer Einbruch");

const cohorts: Array<[string, FaceParams]> = [
  ["Mann 25", atAge(MALE, 25)],
  ["Mann 40", atAge(MALE, 40)],
  ["Mann 60", atAge(MALE, 60)],
  ["Frau 25", atAge(FEMALE, 25)],
  ["Frau 40", atAge(FEMALE, 40)],
  ["Frau 60", atAge(FEMALE, 60)],
];

const cohortScores = cohorts.map(([label, params]) => {
  const { score, geometry } = scoreOf(buildFace(params));
  console.log(
    `         ${label.padEnd(10)} ${score.overall.toFixed(1)}  ` +
      `(Perzentil ${score.percentile.toFixed(0)}, ` +
      `${geometry.implausible.length} unplausibel)`,
  );
  return score.overall;
});

check(
  "keine Kohorte fällt unter 2.0",
  Math.min(...cohortScores) >= 2.0,
  `Minimum ${Math.min(...cohortScores).toFixed(1)}`,
);
check(
  "keine Kohorte ist an der Decke",
  Math.max(...cohortScores) <= 9.9,
  `Maximum ${Math.max(...cohortScores).toFixed(1)}`,
);
check(
  "Geschlechter-Differenz bleibt unter 2 Punkten",
  Math.abs(
    (cohortScores[0] + cohortScores[1] + cohortScores[2]) / 3 -
      (cohortScores[3] + cohortScores[4] + cohortScores[5]) / 3,
  ) < 2,
);

// ---------------------------------------------------------------------------
section("6. Robustheit gegen Landmark-Ausfälle");

const broken = buildFace(MALE);
// Drag the chin somewhere impossible — a hand or a collar in the way.
broken[152] = { x: 0.5, y: 0.2, z: broken[152].z };
const brokenResult = scoreOf(broken);
check(
  "unplausible Messwerte werden erkannt",
  brokenResult.geometry.implausible.length > 0,
  brokenResult.geometry.implausible.join(", "),
);
check(
  "Confidence sinkt statt des Scores",
  brokenResult.score.confidence < scoreOf(base).score.confidence,
  `${scoreOf(base).score.confidence.toFixed(3)} → ${brokenResult.score.confidence.toFixed(3)}`,
);

// ---------------------------------------------------------------------------
section("7. Explainability");

const explained = scoreOf(base);
const explain = recommendationEngine.build(explained.score.modules);
check("Stärken werden gemeldet", explain.strengths.length > 0);
check("Schwächen werden gemeldet", explain.weaknesses.length > 0);
check(
  "Empfehlungen nur zu beeinflussbaren Merkmalen",
  explain.recommendations.every((r) =>
    explain.weaknesses.some((w) => w.id === r.source && w.changeable),
  ),
);
check(
  "Stärken sind näher an der Norm als Schwächen",
  Math.abs(explain.strengths[0].z) < Math.abs(explain.weaknesses[0].z),
);

// ---------------------------------------------------------------------------
section("8. Trainings-Seam");

// Fit on a synthetic target that is a known linear function of two
// features. If the plumbing is right the fit recovers it.
const rows: number[][] = [];
const targets: number[] = [];
for (let i = 0; i < 400; i++) {
  const params: FaceParams = {
    ...MALE,
    asymmetryMm: (i % 13) * 0.6,
    bigonial: 106 + ((i % 17) - 8) * 1.2,
  };
  const g = geometryAnalyzer.analyze(buildFace(params));
  rows.push(toFeatureRow(g.values, g.implausible));
  targets.push(80 - 3 * g.values.symmetryDeviation * 100 + 12 * g.values.jawWidth);
}
const model = fitRidge(rows, targets, 1);
const predicted = rows.map(
  (r) => model.intercept + r.reduce((s, v, i) => s + v * model.coefficients[i], 0),
);
const r = pearson(predicted, targets);
check("Ridge-Fit rekonstruiert ein bekanntes Ziel", r > 0.95, `r = ${r.toFixed(3)}`);

// ---------------------------------------------------------------------------
section("9. Display-Adapter (UI-Vertrag)");

const display = measure(base);
check("15 Metriken für das Dashboard", display.metrics.length === 15);
check(
  "alle Metriken haben endliche Werte",
  display.metrics.every((m) => Number.isFinite(m.value) && Number.isFinite(m.score)),
);
check(
  "Kategorie-Ringe liegen in 0-100",
  [display.symmetry, display.eyesScore, display.jawScore,
   display.proportionsScore, display.midfaceScore]
    .every((v) => v >= 0 && v <= 100),
);
check(
  "Headline stimmt mit der Engine überein",
  Math.abs(display.overall - scoreOf(base).score.overall) < 1e-9,
);

// ---------------------------------------------------------------------------
console.log(
  `\n${failures === 0 ? "ALLE TESTS BESTANDEN" : "FEHLGESCHLAGEN"} — ` +
    `${checks - failures}/${checks} Prüfungen ok\n`,
);
process.exit(failures === 0 ? 0 : 1);
