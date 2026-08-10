// The brand palette has to exist twice. This makes the two agree.
//
//   npx tsx scripts/test-theme.mts
//
// globals.css declares the tokens for everything styled by CSS; lib/theme.ts
// declares them for SVG presentation attributes, the Stripe appearance API
// and the HTML email, none of which can read a custom property.
//
// Two copies of a value drift, and this pair already did: the design update
// moved the accent in the CSS and left #95BF47 hardcoded in twenty-four
// places, so the ring rendered one green while the button next to it
// rendered another. Nobody notices that in a diff. A test does.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BRAND } from "../lib/theme";

const css = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");

let failures = 0;
let checks = 0;

function check(name: string, ok: boolean, detail = "") {
  checks++;
  if (!ok) failures++;
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

/** Read a custom property out of the stylesheet. */
function token(name: string): string | null {
  const m = new RegExp(`--${name}\\s*:\\s*([^;]+);`).exec(css);
  return m ? m[1].trim().toLowerCase() : null;
}

console.log("\nTheme — CSS tokens vs lib/theme.ts\n----------------------------------");

const pairs: Array<[string, string]> = [
  ["color-accent", BRAND.accent],
  ["color-accent-bright", BRAND.accentBright],
  ["color-accent-press", BRAND.accentPress],
  ["color-accent-ink", BRAND.accentInk],
  ["color-canvas", BRAND.canvas],
  ["color-surface", BRAND.surface],
  ["color-surface-raised", BRAND.surfaceRaised],
  ["color-ink", BRAND.ink],
  ["color-ink-secondary", BRAND.inkSecondary],
  ["color-ink-tertiary", BRAND.inkTertiary],
  ["color-caution", BRAND.caution],
];

for (const [name, ts] of pairs) {
  const declared = token(name);
  check(`--${name}`, declared === ts.toLowerCase(), `css=${declared ?? "missing"} ts=${ts}`);
}

console.log("\nNo stale accent left behind\n---------------------------");

// The old accent, in any casing. Anything still carrying it is a surface
// rendering a different green from the rest of the page.
const { execSync } = await import("node:child_process");
let stale = "";
try {
  stale = execSync(
    'git grep -In -i -e 95bf47 -e aad35f -e 6f8f35 -e cff08a -- "*.ts" "*.tsx" ":!lib/theme.ts" ":!scripts/test-theme.mts"',
    { encoding: "utf8" },
  ).trim();
} catch {
  // git grep exits 1 when there are no matches, which is the passing case.
}
check("no hardcoded pre-redesign accent", stale === "", stale.split("\n")[0] ?? "");

console.log("\nContent layer carries no glass\n------------------------------");

// The rule the redesign turns on. .surface* are the content layer, so a
// backdrop-filter in any of their declarations is the bug coming back.
for (const cls of ["surface", "surface-raised", "surface-sunken"]) {
  const block = new RegExp(`\\.${cls}\\s*\\{([^}]*)\\}`).exec(css);
  check(`.${cls} has no backdrop-filter`, Boolean(block) && !/backdrop-filter/.test(block![1]));
}
check(
  ".material-nav does have one",
  /\.material-nav\s*\{[^}]*backdrop-filter/.test(css),
);

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures > 0) process.exitCode = 1;
