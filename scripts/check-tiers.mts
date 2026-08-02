// What share of the modelled population lands in each tier?
// Guards against a threshold set that dumps most people in the bottom rung.
//
// Run:  npx tsx scripts/check-tiers.mts

import { bandFor } from "../lib/tiers";
import { PERCENTILE_TABLE } from "../lib/percentile";
import { TIER_ORDER } from "../lib/metrics";

const counts: Record<string, number> = {};
let prev = 0;
for (let i = 0; i < PERCENTILE_TABLE.length; i++) {
  const overall = (i + 10) / 10;
  const share = PERCENTILE_TABLE[i] - prev;
  prev = PERCENTILE_TABLE[i];
  const b = bandFor(overall).id;
  counts[b] = (counts[b] ?? 0) + share;
}

console.log("tier share of the modelled population:");
for (const id of TIER_ORDER) {
  const pct = counts[id] ?? 0;
  const bar = "█".repeat(Math.max(0, Math.round(pct / 2)));
  console.log(`  ${id.padEnd(12)} ${pct.toFixed(1).padStart(5)}%  ${bar}`);
}
