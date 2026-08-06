// Test suite for the GPT-4.1 Vision path.
//
//   npx tsx scripts/test-vision.mts
//
// NOT an integration test. Nothing here calls OpenAI: an assertion whose
// pass depends on a paid network round trip is an assertion nobody runs.
//
// What it does cover is everything between the model and the dashboard,
// which is where the failures that matter live:
//
//   * the contract still matches norms.ts (add a measurement, this fails)
//   * the JSON schema is legal STRICT-mode structured output
//   * a well-formed model answer produces a complete AnalysisResponse
//   * a hostile model answer — missing fields, out-of-range numbers,
//     contradictions, advice about bone — is repaired rather than trusted
//   * the rubric is monotone and its inverse agrees with the tier ladder

import {
  MEASUREMENT_IDS,
  NORMS,
  type MeasurementId,
} from "../lib/analysis/norms";
import { MODULE_MEASUREMENTS } from "../lib/analysis/modules";
import { bandFor } from "../lib/tiers";
import { METRIC_ORDER } from "../lib/specs";
import {
  MEASUREMENT_DEFS,
  RECOMMENDATION_KEYS,
  VISION_MODULE_IDS,
  assertContract,
} from "../lib/vision/contract";
import { VISION_JSON_SCHEMA, VISION_RESPONSE_FORMAT } from "../lib/vision/schema";
import { buildSystemPrompt } from "../lib/vision/prompt";
import { percentileOfVisionScore, SCORE_PERCENTILE_ANCHORS } from "../lib/vision/rubric";
import { validateVision } from "../lib/vision/validate";
import { adaptVision } from "../lib/vision/adapt";
import { VisionError } from "../lib/vision/openai";

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

/** A model answer that does everything right. Measurements sit at the norm mean. */
function goodAnswer(overrides: Record<string, unknown> = {}) {
  const measurements = Object.fromEntries(
    MEASUREMENT_IDS.map((id) => [id, NORMS[id].mean]),
  ) as Record<MeasurementId, number>;
  // goldenRatio is defined as the same quantity as facialIndex.
  measurements.goldenRatio = measurements.facialIndex;

  const modules = Object.fromEntries(
    VISION_MODULE_IDS.map((id) => [
      id,
      id === "faceShape" ? { score: null, confidence: 0 } : { score: 62, confidence: 0.8 },
    ]),
  );

  return JSON.stringify({
    faceDetected: true,
    refusalReason: null,
    measurements,
    unmeasurable: [],
    modules,
    faceShape: "oval",
    skin: { toneUniformity: 0.72, textureEnergy: 0.66 },
    overall: 5.4,
    percentile: 53,
    confidence: 0.88,
    quality: {
      sharpness: 0.9, motionBlur: 1, exposure: 0.85, noise: 0.92,
      whiteBalance: 0.95, resolution: 0.8, frontality: 0.94, occlusion: 1,
      overall: 0.89,
      pose: { yaw: 2.1, pitch: -1.4, roll: 0.6 },
      issues: [],
    },
    strengths: ["canthalTilt", "eyeAspect"],
    weaknesses: ["jawWidth", "lipRatio"],
    recommendations: [
      { key: "lowerFaceDefinition", source: "jawWidth" },
      { key: "lipRest", source: "lipRatio" },
    ],
    notes: ["The hairline is partly covered."],
    ...overrides,
  });
}

const adapt = (raw: string) =>
  adaptVision(validateVision(raw), {
    model: "gpt-4.1",
    promptVersion: "test",
    cached: false,
  });

// ---------------------------------------------------------------------------
section("Contract — does it still describe the model it mirrors?");

const drift = assertContract();
check("every norm has an operational definition", drift.length === 0, drift.map((d) => d.field).join(", "));
check(
  "25 measurements, matching norms.ts",
  MEASUREMENT_IDS.length === 25 && Object.keys(MEASUREMENT_DEFS).length === 25,
  `${MEASUREMENT_IDS.length} norms / ${Object.keys(MEASUREMENT_DEFS).length} definitions`,
);
check("9 response modules", VISION_MODULE_IDS.length === 9);
check(
  "every scored module's measurements are all defined",
  Object.entries(MODULE_MEASUREMENTS).every(([, ids]) =>
    ids.every((id) => (MEASUREMENT_IDS as string[]).includes(id)),
  ),
);

// ---------------------------------------------------------------------------
section("Schema — legal strict-mode structured output?");

type Node = { type?: unknown; properties?: Record<string, Node>; required?: string[]; additionalProperties?: unknown; items?: Node };

function walk(node: Node, path: string, visit: (n: Node, p: string) => void) {
  visit(node, path);
  if (node.properties) {
    for (const [k, v] of Object.entries(node.properties)) walk(v, `${path}.${k}`, visit);
  }
  if (node.items) walk(node.items, `${path}[]`, visit);
}

const violations: string[] = [];
walk(VISION_JSON_SCHEMA as Node, "root", (n, p) => {
  const isObject = n.type === "object";
  if (isObject && n.additionalProperties !== false) violations.push(`${p}: additionalProperties`);
  if (isObject && n.properties) {
    const props = Object.keys(n.properties);
    const required = n.required ?? [];
    if (props.length !== required.length || !props.every((k) => required.includes(k))) {
      violations.push(`${p}: required must list every property`);
    }
  }
  for (const banned of ["minimum", "maximum", "minItems", "maxItems", "pattern", "default"]) {
    if (banned in (n as Record<string, unknown>)) violations.push(`${p}: ${banned} is unsupported`);
  }
});
check("strict-mode rules hold everywhere", violations.length === 0, violations.slice(0, 3).join("; "));
check("schema is marked strict", VISION_RESPONSE_FORMAT.strict === true);
check(
  "measurements is an object with all 25 keys required",
  ((VISION_JSON_SCHEMA as Node).properties?.measurements?.required ?? []).length === 25,
);

// ---------------------------------------------------------------------------
section("Prompt — generated from the norms, not hand-typed");

const prompt = buildSystemPrompt();
const missingFromPrompt = MEASUREMENT_IDS.filter((id) => !prompt.includes(id));
check("every measurement id appears", missingFromPrompt.length === 0, missingFromPrompt.join(", "));
check(
  "every population mean appears",
  MEASUREMENT_IDS.every((id) => prompt.includes(`mean ${NORMS[id].mean}`)),
);
check("the rubric's anchors appear", prompt.includes("SCORE ANCHORS"));
check(
  "every recommendation key appears",
  RECOMMENDATION_KEYS.every((k) => prompt.includes(k)),
);

// ---------------------------------------------------------------------------
section("Rubric — monotone, and agreeing with the tier ladder");

let monotone = true;
for (let s = 1; s <= 10; s += 0.1) {
  if (percentileOfVisionScore(s + 0.1) < percentileOfVisionScore(s)) monotone = false;
}
check("percentile never decreases as the score rises", monotone);
check("1.0 is the floor and 10.0 the ceiling", percentileOfVisionScore(1) === 0 && percentileOfVisionScore(10) > 99.9);
check(
  "the median lands in the 'reference' band",
  bandFor(5.35).id === "reference",
  `5.35 → ${bandFor(5.35).id}`,
);
check(
  "'elite' is rarer than 3%",
  100 - percentileOfVisionScore(8.5) < 3,
  `top ${(100 - percentileOfVisionScore(8.5)).toFixed(1)}%`,
);
check("anchors are strictly increasing", SCORE_PERCENTILE_ANCHORS.every((a, i, arr) => i === 0 || a[0] > arr[i - 1][0]));

// ---------------------------------------------------------------------------
section("A well-formed answer produces a complete payload");

const ok = adapt(goodAnswer());
check("25 measurements reported", ok.report.measurements.length === 25);
check("all 25 usable and scored", ok.report.measurements.every((m) => m.used && m.z !== null && m.score !== null));
check("every measurement carries a source grade", ok.report.measurements.every((m) => Boolean(m.grade)));
check(
  "the 9 module payloads are present",
  ["symmetry", "proportions", "jaw", "eyes", "nose", "lips", "skin", "hair", "faceShape"].every(
    (k) => k in ok.report && typeof (ok.report as any)[k].confidence === "number",
  ),
);
check("faceShape carries a shape", ok.report.faceShape.shape === "oval");
check("hair is filled by vision, not declared unavailable", ok.report.hair.score !== null && ok.report.hair.weight === 0);
check("faceShape is reported but never scored", ok.report.faceShape.score === null && ok.report.faceShape.weight === 0);
check("headline is the model's", ok.report.overallScore === 5.4 && ok.scan.overall === 5.4);
check(
  "percentile comes from the rubric, not the model's claim",
  Math.abs(ok.report.percentile - percentileOfVisionScore(5.4)) < 0.11,
  `${ok.report.percentile}`,
);
check("composite is the confidence-weighted mean of the modules", ok.scan.harmony === 62, `${ok.scan.harmony}`);
check("15 display metrics for the dashboard", ok.scan.metrics.length === METRIC_ORDER.length);
check("three weakest metrics", ok.scan.weakest.length === 3);
check("category rings filled", [ok.scan.symmetry, ok.scan.eyesScore, ok.scan.jawScore, ok.scan.proportionsScore, ok.scan.midfaceScore].every((v) => v === 62));
check("findings carry a derived z", ok.report.strengths.every((f) => Number.isFinite(f.z)));
check(
  "recommendations only target actionable measurements",
  ok.report.recommendations.every((r) => r.source === "jawWidth" || r.source === "lipRatio"),
);
check("caveats state the vision path's limits", ok.report.meta.caveats.some((c) => c.includes("GPT-4.1 Vision")));
check("no repairs were needed", ok.meta.repairs === 0, `${ok.meta.repairs}`);

// ---------------------------------------------------------------------------
section("A hostile answer is repaired, not trusted");

const measurements = Object.fromEntries(
  MEASUREMENT_IDS.map((id) => [id, NORMS[id].mean]),
) as Record<MeasurementId, number>;

const bad = adapt(
  goodAnswer({
    measurements: {
      ...measurements,
      // Outside its plausible range: a landmark failure, not a wide face.
      jawWidth: 4.2,
      // Contradicts facialIndex, which is the same quantity.
      goldenRatio: 1.618,
      // A magnitude reported negative.
      symmetryDeviation: -0.05,
      // Not a number at all.
      noseWidth: null,
    },
    modules: {
      ...Object.fromEntries(VISION_MODULE_IDS.map((id) => [id, { score: 55, confidence: 0.7 }])),
      // Out of range, and faceShape must never carry a score.
      symmetry: { score: 180, confidence: 2 },
      faceShape: { score: 71, confidence: 0.9 },
    },
    overall: 14.7,
    percentile: 99,
    faceShape: "trapezoid",
    recommendations: [
      // Bone. recommendations.ts exists to refuse exactly this.
      { key: "lowerFaceDefinition", source: "bizygomaticRatio" },
      { key: "lipRest", source: "lipRatio" },
      { key: "lipRest", source: "philtrumRatio" },
    ],
  }),
);

check("out-of-range overall is clamped to the scale", bad.report.overallScore === 10, `${bad.report.overallScore}`);
check("implausible measurement is dropped, not scored", bad.report.meta.implausible.includes("jawWidth"));
check(
  "a dropped measurement is still reported in full",
  bad.report.measurements.find((m) => m.id === "jawWidth")?.value === 4.2,
);
check(
  "a dropped measurement carries no z and no score",
  bad.report.measurements.find((m) => m.id === "jawWidth")?.z === null,
);
check("goldenRatio is forced back onto facialIndex", bad.report.measurements.find((m) => m.id === "goldenRatio")?.value === measurements.facialIndex);
check("a negative magnitude is taken as a magnitude", (bad.report.measurements.find((m) => m.id === "symmetryDeviation")?.value ?? -1) > 0);
check("a missing measurement is marked unusable", bad.report.measurements.find((m) => m.id === "noseWidth")?.used === false);
check("module score is clamped to 0-100", bad.report.symmetry.score === 100);
check("module confidence is clamped to 0-1", bad.report.symmetry.confidence === 1);
check("faceShape's score is stripped", bad.report.faceShape.score === null);
check("an unknown face shape falls back", bad.report.faceShape.shape === "oval");
check("advice about bone is discarded", bad.report.recommendations.every((r) => r.source !== "bizygomaticRatio"));
check("duplicate recommendation keys are collapsed", new Set(bad.report.recommendations.map((r) => r.key)).size === bad.report.recommendations.length);
check("repairs are counted", bad.meta.repairs > 0, `${bad.meta.repairs}`);
check("repairs are surfaced as a caveat", bad.report.meta.caveats.some((c) => c.includes("corrected before scoring")));
check(
  "percentile still follows the clamped score",
  bad.report.percentile === Number(percentileOfVisionScore(10).toFixed(1)),
);

// ---------------------------------------------------------------------------
section("Refusals and malformed input");

const refuses = (raw: string, why: string) => {
  try {
    validateVision(raw);
    check(why, false, "no error thrown");
  } catch (e) {
    check(why, e instanceof VisionError && (e.kind === "refused" || e.kind === "malformed"), String(e));
  }
};

refuses(goodAnswer({ faceDetected: false, refusalReason: "The subject appears to be a minor." }), "faceDetected:false is a refusal");
refuses("not json at all", "unparseable output is rejected");
refuses("[1,2,3]", "a non-object payload is rejected");

// ---------------------------------------------------------------------------
section("Consistency — the property the rubric exists to buy");

// Two readings of the same face that differ only in what a photograph can
// change must not move the headline. The model owns the number, so this is
// a check on the ADAPTER: nothing downstream may perturb it.
const dim = adapt(
  goodAnswer({
    quality: {
      sharpness: 0.35, motionBlur: 0.7, exposure: 0.4, noise: 0.55,
      whiteBalance: 0.6, resolution: 0.45, frontality: 0.7, occlusion: 0.9,
      overall: 0.48,
      pose: { yaw: 12, pitch: -6, roll: 3 },
      issues: ["blurry", "underexposed"],
    },
    confidence: 0.52,
  }),
);
check("capture quality does not move the headline", dim.report.overallScore === ok.report.overallScore);
check("capture quality does move confidence", dim.report.confidence < ok.report.confidence);
check("quality issues reach the dashboard", dim.scan.qualityIssues.length === 2);

const twice = [adapt(goodAnswer()), adapt(goodAnswer())];
check("the same answer adapts identically", JSON.stringify(twice[0]) === JSON.stringify(twice[1]));

// ---------------------------------------------------------------------------
console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures > 0) process.exit(1);
