// Product matching.
//
//   npx tsx scripts/test-products.mts
//
// A ranking bug here is invisible. Nothing crashes, nothing logs, the page
// still shows three products — they are just the wrong three, and the only
// symptom is affiliate revenue that was never earned. So the properties are
// asserted rather than eyeballed.

import { recommend, tagWeights, TOP_N } from "../lib/products/match";
import { validateProduct, PROBLEM_TAGS, TAG_FOR_PLAN } from "../lib/products/types";
import type { Product, ProblemTag } from "../lib/products/types";
import { parseCsv, productsFromRows } from "../lib/products/sheet-csv";
import { rewardsCodeOf, sharedRewardsCode } from "../lib/products/rewards";
import { buildPlan } from "../lib/plan";
import type { QuizAnswers, ScanMetrics } from "../lib/store";
import { makeMetric, METRIC_ORDER, SPECS } from "../lib/specs";

let failures = 0;
let checks = 0;

function check(name: string, ok: boolean, detail = "") {
  checks++;
  if (!ok) failures++;
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

// ---- Fixtures --------------------------------------------------------------

/** A scan whose metrics all sit mid-range, so the quiz drives the plan. */
function scan(overrides: Partial<ScanMetrics> = {}): ScanMetrics {
  const metrics = METRIC_ORDER.map((id) =>
    makeMetric(id, (SPECS[id].demo[0] + SPECS[id].demo[1]) / 2),
  );
  return {
    overall: 6.4,
    harmony: 70,
    symmetry: 80,
    eyesScore: 75,
    jawScore: 70,
    proportionsScore: 75,
    midfaceScore: 75,
    metrics,
    weakest: [],
    interocularPx: 100,
    landmarkCount: 478,
    aspect: 0.8,
    mesh: null,
    sideMesh: null,
    sideAspect: null,
    confidence: 0.9,
    qualityIssues: [],
    ...overrides,
  } as ScanMetrics;
}

let seq = 0;
function product(tags: ProblemTag[], title = `p${++seq}`): Product {
  return {
    id: `id-${title}`,
    title,
    description: "",
    imageUrl: "https://example.com/i.png",
    affiliateLink: "https://example.com/p",
    tags,
    active: true,
    createdAt: seq,
    updatedAt: seq,
  };
}

// A user whose dominant lever is body fat.
//
// Getting this fixture to actually mean that took reading buildPlan rather
// than assuming: `sleep: "under6"` is a flat 90, while body fat is scaled by
// the jaw score (100 − jawScore + 30). With a mid-range jaw and short sleep,
// SLEEP dominates — which is correct behaviour and was the first thing this
// suite caught. Well-slept, and a weak jaw, to put body fat on top.
const QUIZ: QuizAnswers = {
  bodyFat: "over25",
  training: "none",
  skincare: "none",
  sleep: "7-8",
  smoking: "no",
  insecurity: "jawline",
  mewing: "never",
  goal: "dating",
};

/** The tag carrying this user's largest weight. */
function topTag(q: QuizAnswers, s: ScanMetrics): ProblemTag {
  return [...tagWeights(q, s).entries()].sort((a, b) => b[1] - a[1])[0][0];
}

console.log("\nVocabulary\n----------");

check(
  "every plan entry maps to a known tag",
  Object.values(TAG_FOR_PLAN).every((t) => (PROBLEM_TAGS as readonly string[]).includes(t)),
);
check(
  "the mapping is injective — no two levers share a tag",
  new Set(Object.values(TAG_FOR_PLAN)).size === Object.values(TAG_FOR_PLAN).length,
);

console.log("\nWeights come from the action plan\n---------------------------------");

// A weak jaw, so the body-fat rule outweighs the skin routine.
const m = scan({ jawScore: 20 });
const weights = tagWeights(QUIZ, m);
const planIds = buildPlan(QUIZ, m).map((e) => e.id);

check("the user has weighted problems", weights.size > 0, `${weights.size} tags`);
check(
  "every weighted tag traces back to a plan entry",
  [...weights.keys()].every((tag) =>
    planIds.some((id) => TAG_FOR_PLAN[id] === tag),
  ),
);
check(
  "body fat is this user's strongest lever",
  [...weights.entries()].sort((a, b) => b[1] - a[1])[0][0] === "body_fat",
  [...weights.entries()].sort((a, b) => b[1] - a[1])[0].join("="),
);

console.log("\nRanking\n-------");

const onTarget = product(["body_fat"], "on-target");
const offTarget = product(["skin_routine"], "off-target");
const unrelated = product(["tongue_posture"], "unrelated");

const r1 = recommend([offTarget, onTarget], QUIZ, m);
check(
  "the product matching the strongest problem ranks first",
  r1.top[0]?.product.title === "on-target",
  r1.top.map((e) => e.product.title).join(" > "),
);

const r2 = recommend([product(["hair"], "no-overlap")], QUIZ, m);
check(
  "a product with no overlapping tag is not shown at all",
  r2.top.length === 0 && r2.others.length === 0,
);

check(
  "matched tags are reported, strongest first",
  r1.top[0]?.matched[0] === "body_fat",
  String(r1.top[0]?.matched),
);

console.log("\nBreadth cannot buy a position\n-----------------------------");

// The failure this guards: a plain sum over matched weights would let a
// product tick every box in the admin form and outrank one that precisely
// addresses the user's biggest problem, by an unbounded margin.
//
// The comparison has to be against a product matching the SAME top problem.
// Against a product matching a WEAKER one, breadth winning is correct — a
// product that addresses your first and second problem should beat one that
// only addresses your fourth.
//
// CONTRIBUTION is [1, 0.35, 0.12], so the ceiling is 1.47x and is reached
// only when the second and third matched weights equal the first.
const shotgun = product([...PROBLEM_TAGS], "shotgun");
const focused = product([topTag(QUIZ, m)], "focused");
const r3 = recommend([shotgun, focused], QUIZ, m);
const shotgunScore = r3.top.find((e) => e.product.title === "shotgun")?.score ?? 0;
const focusedScore = r3.top.find((e) => e.product.title === "focused")?.score ?? 0;

check(
  "tagging everything is worth at most 47% over a precise match, never more",
  shotgunScore <= focusedScore * 1.47,
  `shotgun=${shotgunScore} focused=${focusedScore} ratio=${(shotgunScore / focusedScore).toFixed(2)}`,
);
check(
  "a matched tag outside the user's top three contributes nothing",
  (() => {
    // The three highest-weighted tags for this fixture, and a fourth that is
    // genuinely weaker. Adding a STRONGER fourth tag would displace one of
    // the three and legitimately change the score — the property is "only
    // the best three count", not "a fourth is ignored whatever it is".
    const ranked = [...tagWeights(QUIZ, m).entries()].sort((a, b) => b[1] - a[1]);
    const bestThree = ranked.slice(0, 3).map(([tag]) => tag);
    const weakest = ranked[ranked.length - 1][0];

    const three = recommend([product(bestThree, "three")], QUIZ, m).top[0].score;
    const four = recommend(
      [product([...bestThree, weakest], "four")],
      QUIZ,
      m,
    ).top[0].score;
    return three === four;
  })(),
);

console.log("\nSplit and determinism\n---------------------");

const many = Array.from({ length: 7 }, (_, i) =>
  product(["body_fat"], `many-${i}`),
);
const r4 = recommend(many, QUIZ, m);
check("top holds at most three", r4.top.length === TOP_N, String(r4.top.length));
check("the rest go to others", r4.others.length === many.length - TOP_N);
check(
  "no product appears in both lists",
  r4.others.every((o) => !r4.top.some((t) => t.product.id === o.product.id)),
);

const orderA = recommend(many, QUIZ, m).top.map((e) => e.product.id).join(",");
const orderB = recommend([...many].reverse(), QUIZ, m).top.map((e) => e.product.id).join(",");
check(
  "the same scan and catalogue give the same order regardless of input order",
  orderA === orderB,
  `${orderA} vs ${orderB}`,
);

check(
  "an inactive product is never recommended",
  recommend([{ ...onTarget, active: false }], QUIZ, m).top.length === 0,
);

console.log("\nValidation\n----------");

const good = {
  title: "T",
  description: "D",
  imageUrl: "https://example.com/i.png",
  affiliateLink: "https://example.com/p",
  tags: ["body_fat"],
};

check("a well-formed product validates", validateProduct(good).ok);
check(
  "an unknown tag is rejected, not stored",
  !validateProduct({ ...good, tags: ["puffy-face"] }).ok,
);
check("a product with no tags is rejected", !validateProduct({ ...good, tags: [] }).ok);
check(
  "a javascript: image URL is rejected",
  !validateProduct({ ...good, imageUrl: "javascript:alert(1)" }).ok,
);
check(
  "a javascript: affiliate link is rejected",
  !validateProduct({ ...good, affiliateLink: "javascript:alert(1)" }).ok,
);
check(
  "a data: image URL is rejected",
  !validateProduct({ ...good, imageUrl: "data:text/html;base64,PHN2Zz4=" }).ok,
);
check("a missing title is rejected", !validateProduct({ ...good, title: "  " }).ok);
check(
  "duplicate tags are collapsed, so they cannot double-count",
  validateProduct({ ...good, tags: ["body_fat", "body_fat"] }).value?.tags.length === 1,
);

console.log("\nSheet CSV\n---------");

// Every field in this sheet can legitimately contain a comma: a description,
// an affiliate URL with query parameters, and the tag list by definition.
// split(",") would shred exactly the rows a catalogue is made of, so the
// parser is checked against the shapes that break naive ones.
//
// The fixture still carries a price COLUMN. Products no longer have a price,
// but sheets created before that do, and the reader has to skip past it
// without shifting every field after it.
{
  const csv = [
    "id,title,description,price,imageUrl,affiliateLink,tags,active",
    '1,"Serum, mild","Für trockene Haut, abends","24,90 €",https://e.de/i.png,"https://e.de/p?a=1,2","skin_routine,sun_protection",TRUE',
    '2,Bürste,"Zeile eins\nZeile zwei","9 €",https://e.de/b.png,https://e.de/b,grooming,FALSE',
    '3,"Er sagte ""hallo""",Beschreibung,"1.299,00 €",https://e.de/c.png,https://e.de/c,sleep,',
  ].join("\n");

  const rows = parseCsv(csv);
  check("a quoted field keeps its comma", rows[1][1] === "Serum, mild", rows[1][1]);
  check("a European price survives", rows[1][3] === "24,90 €", rows[1][3]);
  check("a URL with a comma in the query survives", rows[1][5] === "https://e.de/p?a=1,2", rows[1][5]);
  check("a newline inside quotes stays one field", rows[2][2].includes("\n"), JSON.stringify(rows[2][2]));
  check("a doubled quote becomes one", rows[3][1] === 'Er sagte "hallo"', rows[3][1]);

  const parsed = productsFromRows(rows);
  check("the header row is not a product", parsed.length === 3, String(parsed.length));
  check("tags are split and validated", parsed[0].tags.join("|") === "skin_routine|sun_protection", parsed[0].tags.join("|"));
  check("FALSE in the active column disables the row", parsed[1].active === false);
  check("an empty active column defaults to active", parsed[2].active === true);
}

{
  // A sheet with no header row still has to work — the columns are then
  // taken in the canonical order.
  const rows = parseCsv('9,Titel,Text,5 €,https://e.de/i.png,https://e.de/p,sleep,TRUE');
  const parsed = productsFromRows(rows);
  check("a headerless sheet is read positionally", parsed.length === 1 && parsed[0].title === "Titel");
}

{
  const rows = parseCsv(
    [
      "title,affiliateLink,tags",
      "Ohne Tag,https://e.de/a,",
      "Falscher Tag,https://e.de/b,puffy-face",
      ",https://e.de/c,sleep",
      "Ohne Link,,sleep",
      "Gut,https://e.de/d,sleep",
    ].join("\n"),
  );
  const parsed = productsFromRows(rows);
  check(
    "rows that can never match or never be clicked are skipped",
    parsed.length === 1 && parsed[0].title === "Gut",
    parsed.map((p) => p.title).join(","),
  );
}

check("an empty sheet is an empty catalogue, not a crash", productsFromRows(parseCsv("")).length === 0);

// ---- The merchant discount code --------------------------------------------
//
// The paid tiers ADVERTISE this code, so the property that matters is not
// "does it parse" but "does it ever show a code the customer cannot use".
// Every case below is a way that could happen.

function withLinks(...links: string[]) {
  return links.map((affiliateLink, i) => ({
    id: String(i),
    title: `P${i}`,
    description: "",
    imageUrl: "",
    affiliateLink,
    tags: [],
    active: true,
    createdAt: 0,
  })) as unknown as Parameters<typeof sharedRewardsCode>[0];
}

console.log("\nRabattcode aus den Links");

check(
  "reads rcode off a real iHerb link",
  rewardsCodeOf("https://iherb.co/jLK1UB8M?rcode=GAO0633&utm_medium=appshare") === "GAO0633",
);
check(
  "accepts the older pcode and rsref spellings",
  rewardsCodeOf("https://de.iherb.com/pr/x/1?pcode=ABC123") === "ABC123" &&
    rewardsCodeOf("https://de.iherb.com/pr/x/1?rsref=ABC123") === "ABC123",
);
check("a link without the parameter has no code", rewardsCodeOf("https://de.iherb.com/pr/x/1") === null);
check(
  "a truncated '?rcode' with no value is not a code",
  rewardsCodeOf("https://de.iherb.com/pr/x/1?rcode") === null,
);
check("a link that is not a URL does not throw", rewardsCodeOf("kaputt") === null);

check(
  "one shared code across the catalogue is the code",
  sharedRewardsCode(withLinks("https://a.de/1?rcode=X1", "https://b.de/2?rcode=X1")) === "X1",
);
check(
  "ONE product without a code silences the whole claim",
  sharedRewardsCode(withLinks("https://a.de/1?rcode=X1", "https://b.de/2")) === null,
);
check(
  "two different codes are not a shared code",
  sharedRewardsCode(withLinks("https://a.de/1?rcode=X1", "https://b.de/2?rcode=X2")) === null,
);
check("an empty catalogue advertises nothing", sharedRewardsCode(withLinks()) === null);

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures > 0) process.exitCode = 1;
