// The home page: what its numbers are allowed to say, and what may be
// rendered into an <img src>.
//
//   npx tsx scripts/test-home.mts
//
// TWO THINGS ARE BEING PROTECTED HERE.
//
// 1. THE STATISTICS MUST NOT INVENT A CUSTOMER RECORD. The layout was drawn
//    around four filled tiles — six scans, an average of 6.4, an improvement
//    of +0.8 — and the easy way to make every visitor's page look like the
//    design is to render those figures as placeholders. That is fabricating
//    somebody's history. Every tile has to be able to say "no data", and the
//    difference between "you scanned twice and nothing moved" (0.0) and
//    "there is no second scan" (null) has to survive.
//
// 2. THE IMAGE SLOTS ARE WRITTEN STRAIGHT INTO src. The admin is code-gated,
//    but "only an admin can reach it" is not a reason to accept a
//    javascript: URL — and the same field will one day be filled by an
//    upload endpoint rather than a human.

import { existsSync } from "node:fs";
import { join } from "node:path";
import { DEMO_SUMMARY, fmtDelta, fmtScore, summarise } from "../lib/home/summary";
import { cleanImageUrl, cleanSiteImages, resolveSlot, SLOT_SPECS, IMAGE_SLOTS } from "../lib/site-images";
import { categoryMatches, purposeAndBenefit, PRODUCT_CATEGORIES } from "../lib/products/presentation";
import { PROBLEM_TAGS, PLAN_FOR_TAG, type ProblemTag } from "../lib/products/types";
import { de } from "../lib/i18n/de";
import { en } from "../lib/i18n/en";
import { es } from "../lib/i18n/es";
import { fr } from "../lib/i18n/fr";

let failed = 0;
let checks = 0;
function ok(name: string, cond: boolean, detail = "") {
  checks++;
  if (!cond) failed++;
  console.log(`${cond ? "  ok  " : "  FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

// ---------------------------------------------------------------------------
console.log("\nStatistics — nothing is invented");

const none = summarise([]);
ok("no scans means zero, not a placeholder", none.count === 0);
ok("no average without scans", none.avgScore === null);
ok("no improvement without scans", none.improvement === null);
ok("no potential without scans", none.avgPotential === null);
ok("no latest scan", none.latest === null);
ok("an absent number prints as a dash", fmtScore(null) === "—" && fmtDelta(null) === "—");

const one = summarise([{ at: 100, overall: 6.4, potential: 8.2 }]);
ok("one scan counts as one", one.count === 1);
ok("one scan averages to itself", one.avgScore === 6.4);
ok(
  "one scan has NO improvement figure",
  one.improvement === null,
  "+0.0 on a first scan would be a claim about a comparison that does not exist",
);
ok("its potential is used", one.avgPotential === 8.2);

const three = summarise([
  { at: 300, overall: 7.0, potential: 8.4 },
  { at: 100, overall: 6.0, potential: 8.0 },
  { at: 200, overall: 6.5 },
]);
ok("out-of-order rows are sorted before anything is derived", three.latest?.overall === 7.0);
ok("the average covers every scan", Math.abs((three.avgScore ?? 0) - 6.5) < 1e-9);
ok(
  "improvement is latest minus earliest",
  Math.abs((three.improvement ?? 0) - 1.0) < 1e-9,
  "not latest minus previous",
);
ok(
  "the potential average skips rows that carry none",
  Math.abs((three.avgPotential ?? 0) - 8.2) < 1e-9,
  "older rows predate the column",
);

const flat = summarise([
  { at: 1, overall: 6.0 },
  { at: 2, overall: 6.0 },
]);
ok("two identical scans DO produce an improvement of zero", flat.improvement === 0);
ok("and zero prints with a sign, not as a dash", fmtDelta(0) === "±0.0");
ok("a decline is shown as a decline", fmtDelta(-0.8) === "−0.8");
ok("a gain carries a plus", fmtDelta(0.8) === "+0.8");

// A hand-edited spreadsheet row is the realistic source of junk here.
const junk = summarise([
  { at: 1, overall: 6.0 },
  { at: Number.NaN, overall: 7.0 },
  { at: 3, overall: Number.NaN },
]);
ok("rows with unusable numbers are dropped, not averaged in", junk.count === 1);
ok("and the survivor still reads correctly", junk.avgScore === 6.0);

// ---------------------------------------------------------------------------
console.log("\nThe example figures");

ok("the example matches the design", DEMO_SUMMARY.count === 6 && DEMO_SUMMARY.avgScore === 6.4);
ok("it fills every tile", DEMO_SUMMARY.improvement !== null && DEMO_SUMMARY.avgPotential !== null);
ok("it carries a latest reading for the card below", DEMO_SUMMARY.latest !== null);
// The line that keeps it honest: summarise() must never produce these on its
// own, so the only way they reach the screen is the branch that also renders
// the marker.
ok(
  "summarise() never invents them",
  summarise([]).count === 0 && summarise([]).avgScore === null,
  "the example is a separate constant, not a fallback inside the maths",
);
for (const [code, dict] of Object.entries({ de, en, es, fr })) {
  ok(`${code}: the example marker is translated`, dict.home.preview.trim().length > 0);
}

// ---------------------------------------------------------------------------
console.log("\nImage slots — what may reach an src attribute");

ok("an https URL is kept", cleanImageUrl("https://cdn.example.com/a.png") !== null);
ok("an http URL is kept", cleanImageUrl("http://example.com/a.png") !== null);
ok("a site-relative path is kept", cleanImageUrl("/tip-chart.svg") === "/tip-chart.svg");
ok("surrounding whitespace is trimmed", cleanImageUrl("  /a.svg  ") === "/a.svg");

ok("javascript: is refused", cleanImageUrl("javascript:alert(1)") === null);
ok("data: is refused", cleanImageUrl("data:text/html,<script>") === null);
ok("vbscript: is refused", cleanImageUrl("vbscript:msgbox") === null);
ok(
  "a protocol-relative URL is refused",
  cleanImageUrl("//evil.example/a.png") === null,
  "the browser reads // as absolute",
);
ok("an empty value is refused", cleanImageUrl("   ") === null);
ok("a non-string is refused", cleanImageUrl(42) === null);
ok("an absurdly long value is refused", cleanImageUrl("https://x/" + "a".repeat(3000)) === null);

const cleaned = cleanSiteImages({
  hero: "https://ok.example/a.png",
  tip: "javascript:alert(1)",
  nonsense: "https://ok.example/b.png",
});
ok("a good slot survives cleaning", cleaned.hero === "https://ok.example/a.png");
ok("a bad URL is dropped rather than stored", cleaned.tip === undefined);
ok("an unknown slot is dropped", !("nonsense" in cleaned));
ok("cleaning a non-object yields nothing", Object.keys(cleanSiteImages("nope")).length === 0);

// ---------------------------------------------------------------------------
console.log("\nDefaults — the page renders before anything is configured");

for (const slot of IMAGE_SLOTS) {
  const fallback = SLOT_SPECS[slot].fallback;
  ok(`${slot} has a site-relative fallback`, fallback.startsWith("/"));
  // The check that matters: the file has to be there. A default pointing at a
  // deleted asset is a broken image on the landing page, and every other test
  // here would still pass.
  ok(`${slot}: ${fallback} exists in public/`, existsSync(join("public", fallback.slice(1))));
  ok(`${slot} resolves to it when unset`, resolveSlot({}, slot) === fallback);
}
ok(
  "an override wins over the fallback",
  resolveSlot({ hero: "https://x/y.png" }, "hero") === "https://x/y.png",
);

// ---------------------------------------------------------------------------
console.log("\nCopy — four languages, no gaps");

for (const [code, dict] of Object.entries({ de, en, es, fr })) {
  const h = dict.home;
  ok(`${code}: three chips`, h.chips.length === 3 && h.chips.every((c) => c.trim().length > 0));
  ok(
    `${code}: four quick tiles with both lines`,
    h.tiles.length === 4 && h.tiles.every((x) => x.title.trim() && x.sub.trim()),
  );
  ok(`${code}: four tab labels`, Object.values(h.tabs).filter((v) => v.trim().length > 0).length === 4);
  ok(
    `${code}: the empty state explains itself`,
    h.emptyTitle.trim().length > 0 && h.emptyBody.trim().length > 20,
  );
  const flatCopy = JSON.stringify(h);
  ok(`${code}: no empty strings anywhere in the home copy`, !/:""/.test(flatCopy));
  ok(`${code}: admin image section is translated`, dict.admin.images.title.trim().length > 0);
}

// ---------------------------------------------------------------------------
console.log("\nProduct cards — purpose and benefit");

// The card copy is DERIVED from the tags, so the vocabulary and the copy have
// to stay in step. A tag with no benefit line renders an empty second line on
// every product carrying it, and nothing else in this suite would notice.
for (const [code, dict] of Object.entries({ de, en, es, fr })) {
  const gaps = PROBLEM_TAGS.filter((tag) => !dict.products.improves[tag]?.trim());
  ok(`${code}: every problem tag says what improves`, gaps.length === 0, gaps.join(", "));
  const stubs = PROBLEM_TAGS.filter((tag) => (dict.products.improves[tag] ?? "").length < 25);
  ok(`${code}: none of those lines is a stub`, stubs.length === 0, stubs.join(", "));
}

// The purpose reuses the plan step label, so a card cannot promise something
// the matching logic disagrees with.
const derived = purposeAndBenefit(de, ["skin_routine"]);
ok("purpose comes from the plan step", derived?.purpose === de.plan[PLAN_FOR_TAG.skin_routine].short);
ok("benefit comes from the tag", derived?.benefit === de.products.improves.skin_routine);
ok(
  "the FIRST tag decides the copy",
  purposeAndBenefit(de, ["hair", "sleep"])?.benefit === de.products.improves.hair,
  "all of them would read as a list that says nothing",
);
ok("no tags means no derived copy", purposeAndBenefit(de, []) === null);

// ---------------------------------------------------------------------------
console.log("\nCategories");

ok("the first category is the unfiltered one", PRODUCT_CATEGORIES[0].id === "all");
ok("and it matches anything", categoryMatches("all", []) && categoryMatches("all", ["hair"]));
ok("a category matches a product carrying one of its tags", categoryMatches("skin", ["skin_routine"]));
ok("and rejects one that carries none", !categoryMatches("skin", ["hair"]));

// A tag in no category is a product reachable only through the "for you"
// filter — invisible the moment somebody taps any other one, and silent.
const covered = new Set<ProblemTag>(
  PRODUCT_CATEGORIES.flatMap((c) => (c.tags ? [...c.tags] : [])),
);
const orphans = PROBLEM_TAGS.filter((tag) => !covered.has(tag));
ok("every problem tag belongs to a category", orphans.length === 0, orphans.join(", "));

console.log(
  failed === 0
    ? `\nALLE TESTS BESTANDEN — ${checks}/${checks} Prüfungen ok`
    : `\n${failed} von ${checks} Prüfungen FEHLGESCHLAGEN`,
);
process.exit(failed === 0 ? 0 : 1);
