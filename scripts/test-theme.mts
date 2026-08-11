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
  ["color-accent-deep", BRAND.accentDeep],
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

// Every accent this product has ever shipped, in any casing, INCLUDING the
// rgb() triples. That last part is why the check kept passing while the app
// was visibly wrong: the olive #95bf47 survived in nine files as
// `rgba(149,191,71,…)` — the same colour written in decimal — so a hex-only
// grep saw nothing and the radar, the tier ladder, the drop zone, the pay
// button and the Stripe inputs all rendered the accent from two generations
// ago. A colour is stale in whatever notation it is written in.
// execFileSync, NOT execSync. The previous version built one command string
// with single-quoted patterns in it. cmd.exe does not strip single quotes, so
// on Windows git received `'149,` as a revision, died with "unable to resolve
// revision", and the catch below swallowed it — the check reported ok while
// grepping nothing at all. A test that cannot fail is worse than no test.
// Passing argv directly means no shell and no quoting rules to get wrong.
//
// --untracked, because a colour introduced in a file that is not committed
// yet is exactly the one worth catching before it is.
const { execFileSync } = await import("node:child_process");

const SUPERSEDED = [
  // First-generation green, in hex and in the decimal it hid as.
  "95bf47", "aad35f", "6f8f35", "cff08a", "149, ?191, ?71",
  // The olive pass this redesign replaced.
  "9ecb4f", "b4de69", "85ae3f", "158, ?203, ?79",
];

let stale = "";
let grepFailed = "";
try {
  stale = execFileSync(
    "git",
    [
      "grep", "-In", "-iE", "--untracked",
      ...SUPERSEDED.flatMap((p) => ["-e", p]),
      "--", "*.ts", "*.tsx", ":!lib/theme.ts", ":!scripts/test-theme.mts",
    ],
    { encoding: "utf8" },
  ).trim();
} catch (err) {
  // git grep exits 1 with no output when there are no matches — the passing
  // case. Any other exit code means the search did not run, and that has to
  // surface as a failure rather than as silence.
  const e = err as { status?: number; stderr?: string };
  if (e.status !== 1) grepFailed = e.stderr?.trim() || `git grep exited ${e.status}`;
}

check("stale-accent search ran", grepFailed === "", grepFailed);
check("no hardcoded superseded accent", stale === "", stale.split("\n")[0] ?? "");

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
