// The potential score is the easiest number in this product to fake.
//
//   npx tsx scripts/test-potential.mts
//
// "Your potential is 8.2" printed in green next to a 6.4 is exactly as
// persuasive whether it was derived or whether somebody wrote `overall + 1.8`.
// Nothing in the UI can tell the two apart, and nothing in a code review
// reliably does either once the function has a plausible name. So the
// properties that make it a real figure are asserted here:
//
//   * it is bounded by the headline below and by 10 above
//   * every driver is in ACTIONABLE — nothing skeletal is ever claimed
//   * pushing an ACTIONABLE measurement off reference increases the lift
//   * pushing a SKELETAL one off does not, and never names it as a driver
//
// The last pair is the one that matters. It is the difference between "here
// is what you could reach" and "here is what you could reach if you had a
// different skull", and only the first is honest to sell.

import { geometryAnalyzer } from "../lib/analysis/geometry";
import { WeightedScorer } from "../lib/analysis/engine";
import { DEFAULT_WEIGHTS } from "../lib/analysis/weights";
import { buildResponse } from "../lib/analysis/response";
import { ACTIONABLE, recommendationEngine } from "../lib/analysis/recommendations";
import type { QualityStage } from "../lib/analysis/types";
import { potentialFor } from "../lib/potential";
import { MALE, buildFace, type FaceParams } from "./synthetic-face.mts";
import type { ScanMetrics } from "../lib/store";

let failures = 0;
let checks = 0;

function check(name: string, ok: boolean, detail = "") {
  checks++;
  if (!ok) failures++;
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

/** A clean capture, so quality never confounds what is being measured here. */
const PERFECT_CAPTURE: QualityStage = {
  overall: 0.9,
  sharpness: 0.9,
  motionBlur: 1,
  noise: 0.1,
  exposure: 0.9,
  whiteBalance: 0.9,
  resolution: 0.9,
  frontality: 0.95,
  occlusion: 0,
  pose: { yaw: 0, pitch: 0, roll: 0 },
  issues: [],
};

/** The full pipeline over one synthetic face, in the shape the app carries. */
function scan(params: FaceParams): { metrics: ScanMetrics; overall: number } {
  const geometry = geometryAnalyzer.analyze(buildFace(params));
  const score = new WeightedScorer().score(
    {
      features: geometry.values,
      implausible: geometry.implausible,
      external: {},
      qualityOverall: PERFECT_CAPTURE.overall,
      embeddingStability: null,
      poseCompensated: geometry.aligned.poseCompensated,
    },
    DEFAULT_WEIGHTS,
  );

  const report = buildResponse({
    geometry,
    quality: PERFECT_CAPTURE,
    skin: null,
    score,
    explain: recommendationEngine.build(score.modules),
  });

  // Only the two fields potentialFor() reads. The rest of ScanMetrics is the
  // display adapter's business and cannot change the arithmetic.
  const metrics = { overall: score.overall, metrics: [], report } as unknown as ScanMetrics;
  return { metrics, overall: score.overall };
}

console.log("\nPotential — bounds and provenance\n---------------------------------");

const base = scan(MALE);
const p = potentialFor(base.metrics);

console.log(`  headline ${base.overall} → potential ${p?.score} (lift ${p?.lift})`);
console.log(`  drivers: ${p?.drivers.join(", ") || "(none)"}`);

check("a scan with a report yields a figure", p !== null);
check(
  "never below the headline",
  (p?.score ?? -1) >= base.overall,
  `${p?.score} vs ${base.overall}`,
);
check("never above 10", (p?.score ?? 99) <= 10, String(p?.score));
check(
  "every driver is actionable",
  (p?.drivers ?? []).every((d) => d in ACTIONABLE),
  (p?.drivers ?? []).filter((d) => !(d in ACTIONABLE)).join(", "),
);

console.log("\nPotential — what moves it\n-------------------------");

// Lip rest is in ACTIONABLE: how the lips sit at rest genuinely differs
// between two photographs of the same person.
const lipsOff = scan({ ...MALE, lowerVermillion: MALE.lowerVermillion * 0.55 });
// Bizygomatic width is bone. It is measured, reported, and never actioned.
const boneOff = scan({ ...MALE, bizygomatic: MALE.bizygomatic * 1.16 });

const pl = potentialFor(lipsOff.metrics);
const pb = potentialFor(boneOff.metrics);

console.log(`  lip rest off:  ${lipsOff.overall} → ${pl?.score} (lift ${pl?.lift})`);
console.log(`  cheekbones off: ${boneOff.overall} → ${pb?.score} (lift ${pb?.lift})`);

check(
  "an actionable deviation raises the lift",
  (pl?.lift ?? 0) > (p?.lift ?? 0),
  `${pl?.lift} vs baseline ${p?.lift}`,
);
check(
  "a skeletal deviation does not",
  (pb?.lift ?? 0) <= (p?.lift ?? 0) + 0.05,
  `${pb?.lift} vs baseline ${p?.lift}`,
);
check(
  "the skeletal measurement is never a driver",
  !(pb?.drivers ?? []).some((d) => String(d).startsWith("bizygomatic")),
  (pb?.drivers ?? []).join(", "),
);

console.log("\nPotential — no report, no number\n--------------------------------");

// The demo path has no measurements to re-score. It must return null rather
// than fall back to something plausible-looking.
check(
  "a scan without a report returns null",
  potentialFor({ overall: 6.4, metrics: [] } as unknown as ScanMetrics) === null,
);

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures > 0) process.exitCode = 1;
