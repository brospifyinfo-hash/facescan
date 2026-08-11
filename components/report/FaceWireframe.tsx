"use client";

import { motion, useReducedMotion } from "framer-motion";
import { BRAND } from "@/lib/theme";

/**
 * The strengths panel's profile wireframe.
 *
 * PROVENANCE. The brief asks for an existing SVG to be carried over one to
 * one. There is none in this repository — no .svg file anywhere in the tree,
 * and no inline profile wireframe in any component (the two existing face
 * drawings are the dashed upload guides in components/ui/Silhouettes.tsx and
 * the generated front-facing point cloud in components/landing/HeroMesh.tsx,
 * neither of which is this). The only source is the reference PNG, and a
 * raster cannot be vector-extracted, so this is traced from it by hand.
 * Nothing was overwritten.
 *
 * IT IS A FIXED POINT AND EDGE LIST so that swapping in the original is a
 * data change and nothing else: replace P, OUTLINE, FACETS and NODES, leave
 * the component alone. A generated mesh would have made that impossible —
 * and a procedural blob does not read as a specific face anyway. The profile
 * needs a brow ridge, a nasion, a nose tip, a subnasale and a mentolabial
 * fold in the right places or the eye rejects it immediately.
 */

// Head in right profile, traced from the reference. Coordinates run
// x 40..160, y 18..200 — see the viewBox below.
const P: Array<[number, number]> = [
  // ---- Silhouette, clockwise from the crown down the face ----
  [92, 19], //  0 crown
  [116, 26], //  1 upper forehead
  [133, 42], //  2 forehead
  [142, 61], //  3 brow ridge
  [147, 72], //  4 brow
  [137, 81], //  5 nasion — the dip the whole profile hangs off
  [147, 93], //  6 dorsum
  [159, 106], //  7 nose tip
  [141, 116], //  8 subnasale
  [147, 125], //  9 upper lip
  [140, 131], // 10 oral commissure
  [148, 138], // 11 lower lip
  [139, 146], // 12 mentolabial fold
  [148, 156], // 13 pogonion
  [137, 167], // 14 gnathion
  [126, 178], // 15 neck front, upper
  [121, 200], // 16 neck front, lower
  [77, 200], // 17 neck back, lower
  [71, 175], // 18 neck back, upper
  [62, 157], // 19 ear base
  [47, 130], // 20 rear skull, lower
  [42, 99], // 21 occiput
  [52, 67], // 22 upper occiput
  [68, 35], // 23 skull, back

  // ---- Interior vertices — the facets ----
  [99, 55], // 24 temple
  [124, 85], // 25 orbit
  [110, 103], // 26 zygoma
  [91, 91], // 27 mid cheek
  [105, 133], // 28 lower cheek
  [88, 147], // 29 ramus
  [75, 89], // 30 skull interior
  [112, 159], // 31 jaw interior
  [92, 49], // 32 crown interior
  [65, 119], // 33 lower skull interior
  [99, 196], // 34 neck interior
  [86, 172], // 35 neck / jaw junction
];

/** The outline. Heavier — it is the face; the facets are the analysis. */
const OUTLINE: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9],
  [9, 10], [10, 11], [11, 12], [12, 13], [13, 14], [14, 15], [15, 16],
  [16, 17], [17, 18], [18, 19], [19, 20], [20, 21], [21, 22], [22, 23],
  [23, 0],
];

/** The triangulation. Thin, low opacity, never crossing the outline. */
const FACETS: Array<[number, number]> = [
  // Crown and temple
  [32, 0], [32, 1], [32, 23], [32, 24], [24, 1], [24, 2], [24, 23], [24, 22],
  [24, 27], [24, 30], [30, 22], [30, 23], [30, 21], [30, 27], [30, 33],
  // Brow, orbit, nose
  [25, 2], [25, 3], [25, 4], [25, 5], [25, 24], [25, 27], [25, 26], [25, 6],
  // Cheek and zygoma
  [26, 6], [26, 8], [26, 27], [26, 28], [26, 10], [27, 33],
  // Mouth and lower cheek
  [28, 10], [28, 12], [28, 29], [28, 31], [28, 14],
  // Jaw and ramus
  [29, 19], [29, 20], [29, 33], [29, 31], [29, 35], [31, 14], [31, 15],
  [31, 35], [33, 20], [33, 21],
  // Neck
  [35, 18], [35, 19], [35, 34], [34, 16], [34, 17], [34, 18], [34, 15],
];

/** Vertices drawn as nodes — feature points, not every corner. */
const NODES = [
  0, 2, 4, 5, 7, 9, 11, 13, 14, 16, 19, 21, 23, 24, 25, 26, 27, 28, 29, 30,
  31, 32, 33, 35,
];

/**
 * A few facets carry a faint fill. Depth, not decoration: an unfilled
 * triangulation reads as a wire cage, and the reference reads as a surface.
 */
const SHADED: Array<[number, number, number]> = [
  [25, 26, 27],
  [24, 25, 27],
  [26, 28, 10],
  [28, 29, 31],
  [30, 27, 33],
  [32, 24, 23],
];

export function FaceWireframe({ className }: { className?: string }) {
  const reduce = useReducedMotion();

  return (
    <svg
      viewBox="34 12 134 196"
      className={className}
      fill="none"
      aria-hidden
      // It sits beside the strengths list, so it must never intercept a tap
      // meant for the text.
      style={{ pointerEvents: "none" }}
    >
      <defs>
        <radialGradient id="wireGlow" cx="56%" cy="46%" r="58%">
          <stop offset="0%" stopColor={BRAND.accent} stopOpacity="0.18" />
          <stop offset="100%" stopColor={BRAND.accent} stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx="100" cy="108" r="86" fill="url(#wireGlow)" />

      {SHADED.map(([a, b, c], i) => (
        <motion.polygon
          key={`s${i}`}
          points={`${P[a][0]},${P[a][1]} ${P[b][0]},${P[b][1]} ${P[c][0]},${P[c][1]}`}
          fill={BRAND.accent}
          initial={reduce ? { opacity: 0.07 } : { opacity: 0 }}
          animate={{ opacity: 0.07 }}
          transition={{ duration: 0.8, delay: reduce ? 0 : 0.9 + i * 0.05 }}
        />
      ))}

      {FACETS.map(([a, b], i) => (
        <motion.line
          key={`f${i}`}
          x1={P[a][0]}
          y1={P[a][1]}
          x2={P[b][0]}
          y2={P[b][1]}
          stroke={BRAND.accent}
          strokeWidth={0.5}
          initial={reduce ? { opacity: 0.34 } : { pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.34 }}
          transition={{ duration: 0.85, delay: reduce ? 0 : 0.25 + i * 0.011 }}
        />
      ))}

      {OUTLINE.map(([a, b], i) => (
        <motion.line
          key={`o${i}`}
          x1={P[a][0]}
          y1={P[a][1]}
          x2={P[b][0]}
          y2={P[b][1]}
          stroke={BRAND.accentBright}
          strokeWidth={0.85}
          strokeLinecap="round"
          initial={reduce ? { opacity: 0.8 } : { pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.8 }}
          transition={{ duration: 1, delay: reduce ? 0 : 0.1 + i * 0.02 }}
        />
      ))}

      {NODES.map((n, i) => (
        <motion.circle
          key={`n${n}`}
          cx={P[n][0]}
          cy={P[n][1]}
          r={1.4}
          fill={BRAND.accentBright}
          initial={reduce ? { opacity: 0.9 } : { opacity: 0, scale: 0 }}
          animate={{ opacity: 0.9, scale: 1 }}
          transition={{ duration: 0.32, delay: reduce ? 0 : 0.75 + i * 0.022 }}
          style={{ transformOrigin: `${P[n][0]}px ${P[n][1]}px` }}
        />
      ))}
    </svg>
  );
}
