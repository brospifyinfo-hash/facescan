// Generates the two default artworks for the home page.
//
//   npx tsx scripts/gen-hero-art.mts
//
// WHY GENERATED AND NOT DRAWN BY HAND
// -----------------------------------
// The hero is a triangulated point cloud in the shape of a head. Hand-writing
// four hundred <line> elements is not editing, it is transcription — nobody
// would ever adjust it again, and a "make the mesh denser" request would mean
// starting over. As a generator the shape is a polygon, the density is a
// number, and the output is reproducible: same seed, same file, so a rerun
// produces no diff unless a parameter actually changed.
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

/**
 * A head in right-facing profile, as a closed polygon.
 *
 * Traced front-first from the crown: forehead, brow, the bridge and tip of
 * the nose, the lips, the chin, along the jaw to the neck, then up the back
 * of the skull. In a 100x100 box; the renderer scales it.
 */
const HEAD: Pt[] = [
  // Crown, then down the face: forehead, brow ridge, the dip at the nasion,
  // the bridge and tip of the nose, philtrum, both lips, the crease above the
  // chin, the chin itself, back along the jaw to the neck, and up the skull.
  { x: 47, y: 4 },
  { x: 57, y: 4.5 },
  { x: 65, y: 8 },
  { x: 71, y: 14 },
  { x: 74, y: 21 },
  { x: 75.5, y: 27 },
  { x: 73, y: 30 },
  { x: 75, y: 33 },
  { x: 78, y: 37 },
  { x: 83, y: 40 },
  { x: 88, y: 44 },
  { x: 80, y: 46 },
  { x: 76, y: 47 },
  { x: 77, y: 49 },
  { x: 79.5, y: 51 },
  { x: 77, y: 53.5 },
  { x: 79, y: 56 },
  { x: 75, y: 59 },
  { x: 77, y: 62 },
  { x: 79.5, y: 66 },
  { x: 73, y: 71 },
  { x: 66, y: 75 },
  { x: 57, y: 78 },
  { x: 51, y: 80 },
  { x: 49, y: 86 },
  { x: 48, y: 93 },
  { x: 29, y: 93 },
  { x: 28, y: 84 },
  { x: 25, y: 76 },
  { x: 19, y: 67 },
  { x: 15, y: 56 },
  { x: 14, y: 44 },
  { x: 17, y: 31 },
  { x: 23, y: 19 },
  { x: 31, y: 10 },
  { x: 39, y: 5 },
];

function inside(p: Pt, poly: Pt[]): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      hit = !hit;
    }
  }
  return hit;
}

/** Shortest distance from a point to the polygon edge — used to fade the rim. */
function edgeDistance(p: Pt, poly: Pt[]): number {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = dx * dx + dy * dy;
    const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len));
    const cx = a.x + t * dx;
    const cy = a.y + t * dy;
    best = Math.min(best, Math.hypot(p.x - cx, p.y - cy));
  }
  return best;
}

function buildHead(): string {
  const rand = rng(20260815);
  const pts: Pt[] = [];

  // The outline itself, resampled evenly so the silhouette reads as a line of
  // vertices rather than as a polygon with clustered corners.
  const PERIM_STEP = 2.9;
  for (let i = 0; i < HEAD.length; i++) {
    const a = HEAD[i];
    const b = HEAD[(i + 1) % HEAD.length];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.round(seg / PERIM_STEP));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      pts.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  const rimCount = pts.length;

  // Interior, on a jittered grid. A pure random fill clumps and leaves holes;
  // jittering a grid keeps the spacing even while still looking organic.
  const STEP = 4.7;
  for (let y = 4; y < 98; y += STEP) {
    for (let x = 10; x < 90; x += STEP) {
      const p = {
        x: x + (rand() - 0.5) * STEP * 0.85,
        y: y + (rand() - 0.5) * STEP * 0.85,
      };
      if (inside(p, HEAD) && edgeDistance(p, HEAD) > 1.2) pts.push(p);
    }
  }

  // Connect near neighbours. Not a Delaunay triangulation: at this density a
  // radius join produces the same read for a fraction of the code, and the
  // few extra crossings are indistinguishable at the size this renders.
  const LINK = 5.5;
  const lines: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
      if (d > LINK) continue;
      const key = `${i}:${j}`;
      if (seen.has(key)) continue;
      seen.add(key);
      // Nearer pairs read as structure, far ones as noise — fade with length.
      const o = (0.34 - (d / LINK) * 0.22).toFixed(2);
      lines.push(
        `<line x1="${pts[i].x.toFixed(1)}" y1="${pts[i].y.toFixed(1)}" x2="${pts[j].x.toFixed(1)}" y2="${pts[j].y.toFixed(1)}" stroke="#5fe38a" stroke-width="0.16" stroke-opacity="${o}"/>`,
      );
    }
  }

  const dots = pts.map((p, i) => {
    const rim = i < rimCount;
    const r = rim ? 0.5 : 0.34 + rand() * 0.2;
    const o = rim ? 0.95 : 0.4 + rand() * 0.45;
    return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r.toFixed(2)}" fill="#5fe38a" fill-opacity="${o.toFixed(2)}"/>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 114" width="100" height="114" role="img" aria-label="">
<g>
${lines.join("\n")}
</g>
<g>
${dots.join("\n")}
</g>
<!-- The plinth the head sits on, as in the reference. -->
<ellipse cx="38" cy="104" rx="34" ry="7.5" fill="none" stroke="#5fe38a" stroke-width="0.35" stroke-opacity="0.5"/>
<ellipse cx="38" cy="104" rx="24" ry="5.2" fill="none" stroke="#5fe38a" stroke-width="0.25" stroke-opacity="0.28"/>
<ellipse cx="38" cy="104" rx="13" ry="2.8" fill="none" stroke="#5fe38a" stroke-width="0.2" stroke-opacity="0.16"/>
</svg>
`;
}

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

writeFileSync("public/hero-mesh.svg", buildHead());
writeFileSync("public/tip-chart.svg", buildTip());
console.log("public/hero-mesh.svg und public/tip-chart.svg geschrieben");
