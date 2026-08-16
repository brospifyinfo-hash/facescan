// Generates the tip-of-the-day chart for the home page.
//
//   npx tsx scripts/gen-hero-art.mts
//
// WHY GENERATED AND NOT DRAWN BY HAND
// -----------------------------------
// Fourteen bars and an eight-point line. Hand-writing them is transcription,
// not editing — nobody would adjust it again, and "make it climb harder"
// would mean starting over. As a generator the curve is an exponent and the
// output is reproducible: same seed, same file, so a rerun produces no diff
// unless a parameter actually changed.
//
// The hero figure used to be generated here too, as a point cloud filled into
// a head-shaped polygon. It was replaced by the supplied artwork — a real
// triangulated head reads as a scan, and a procedural silhouette only ever
// approximated one. See SLOT_SPECS in lib/site-images.ts.
//
// COMMITTED, NOT GENERATED AT RUNTIME. The page must render the design with
// zero configuration and no request, and an SVG in public/ is the cheapest
// possible way to do that. The admin override replaces it; this is what the
// slot shows until then.

import { writeFileSync } from "node:fs";

// ---------------------------------------------------------------------------
// Deterministic randomness
// ---------------------------------------------------------------------------
// mulberry32. Seeded so the committed file is stable — an unseeded Math.random
// would reshuffle every vertex on every run and make the diff unreadable.
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Pt = { x: number; y: number };

function buildTip(): string {
  const rand = rng(7788);
  // Bars that climb, then a line over them that climbs faster — "small daily
  // improvements compound", drawn.
  const bars: string[] = [];
  const N = 14;
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const h = 6 + t * t * 52 + rand() * 5;
    const x = 6 + i * 6.6;
    bars.push(
      `<rect x="${x.toFixed(2)}" y="${(72 - h).toFixed(2)}" width="3.6" height="${h.toFixed(2)}" rx="1.3" fill="#5fe38a" fill-opacity="${(0.13 + t * 0.5).toFixed(2)}"/>`,
    );
  }

  const pts: Pt[] = [];
  for (let i = 0; i < 8; i++) {
    const t = i / 7;
    pts.push({ x: 8 + t * 84, y: 66 - Math.pow(t, 1.7) * 52 - rand() * 3 });
  }
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
  const nodes = pts
    .map((p) => `<circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="1.5" fill="#5fe38a"/>`)
    .join("\n");

  const last = pts[pts.length - 1];

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 80" width="100" height="80" role="img" aria-label="">
<g>
${bars.join("\n")}
</g>
<path d="${path}" fill="none" stroke="#5fe38a" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="0.9"/>
${nodes}
<circle cx="${last.x.toFixed(2)}" cy="${last.y.toFixed(2)}" r="6.4" fill="#05080d" stroke="#5fe38a" stroke-width="1.1"/>
<path d="M${last.x.toFixed(2)} ${(last.y - 3.4).toFixed(2)} l1.0 2.1 2.3 0.3 -1.7 1.6 0.4 2.3 -2.0 -1.1 -2.0 1.1 0.4 -2.3 -1.7 -1.6 2.3 -0.3 z" fill="#5fe38a"/>
</svg>
`;
}

writeFileSync("public/tip-chart.svg", buildTip());
console.log("public/tip-chart.svg geschrieben");
