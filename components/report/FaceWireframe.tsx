"use client";

import { motion, useReducedMotion } from "framer-motion";
import { BRAND } from "@/lib/theme";

/**
 * The strengths panel's profile wireframe.
 *
 * NOTE ON PROVENANCE: the brief asked for an existing SVG to be carried over
 * one-to-one and not redrawn. There was none — no .svg anywhere in the repo
 * and no inline profile wireframe in any component (the two existing face
 * drawings are the dashed upload guides in components/ui/Silhouettes.tsx and
 * the generated front-facing point cloud in components/landing/HeroMesh.tsx,
 * neither of which is this). So nothing was overwritten: this is a new asset
 * drawn to the reference. If the original turns up, swap the arrays below —
 * the geometry is data, and everything around it stays.
 *
 * It is a fixed point list, not a generated mesh, because a profile has to
 * read as a specific face: brow ridge, nasion, nose tip, subnasale, the
 * mentolabial fold. Procedural noise gives you a blob with dots on it.
 */

// Silhouette, clockwise from the crown down the face and back around the
// skull. Indices are referenced by both edge lists below, so inserting a
// point means fixing the edges — hence the names.
const P: Array<[number, number]> = [
  [86, 30], //  0 crown
  [56, 44], //  1 upper occiput
  [38, 74], //  2 occiput
  [34, 108], //  3 rear skull
  [42, 140], //  4 lower skull
  [54, 160], //  5 ear base
  [72, 176], //  6 gonion
  [98, 180], //  7 jaw
  [122, 168], //  8 chin base
  [132, 156], //  9 pogonion
  [124, 147], // 10 mentolabial fold
  [133, 139], // 11 lower lip
  [127, 132], // 12 mouth
  [134, 125], // 13 upper lip
  [128, 117], // 14 subnasale
  [148, 108], // 15 nose tip
  [134, 94], // 16 dorsum
  [121, 82], // 17 nasion
  [129, 71], // 18 brow
  [122, 62], // 19 brow ridge
  [108, 42], // 20 forehead
  // Interior vertices — the facets.
  [76, 60], // 21 temple
  [108, 88], // 22 orbit
  [92, 108], // 23 zygoma
  [78, 96], // 24 mid cheek
  [88, 138], // 25 lower cheek
  [72, 148], // 26 ramus
  [62, 100], // 27 skull interior
];

/** The outline. Drawn heavier — it is the face; the facets are the analysis. */
const OUTLINE: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9],
  [9, 10], [10, 11], [11, 12], [12, 13], [13, 14], [14, 15], [15, 16],
  [16, 17], [17, 18], [18, 19], [19, 20], [20, 0],
];

/** The triangulation. Thin, low opacity, and never crossing the outline. */
const FACETS: Array<[number, number]> = [
  [21, 0], [21, 1], [21, 2], [21, 20], [21, 24], [21, 27],
  [22, 17], [22, 19], [22, 20], [22, 24], [22, 23], [22, 16],
  [23, 14], [23, 12], [23, 24], [23, 25],
  [24, 27], [24, 2],
  [25, 12], [25, 10], [25, 8], [25, 26], [25, 7],
  [26, 4], [26, 5], [26, 6], [26, 27],
  [27, 2], [27, 3], [27, 4],
];

/** Vertices drawn as visible nodes — the feature points, not every corner. */
const NODES = [0, 2, 6, 8, 9, 12, 15, 17, 19, 21, 22, 23, 25, 26, 27];

export function FaceWireframe({ className }: { className?: string }) {
  const reduce = useReducedMotion();

  return (
    <svg
      viewBox="20 16 150 180"
      className={className}
      fill="none"
      aria-hidden
      // The mesh sits behind the strengths list on narrow screens, so it must
      // never intercept a tap meant for the text above it.
      style={{ pointerEvents: "none" }}
    >
      <defs>
        <radialGradient id="wireGlow" cx="58%" cy="46%" r="58%">
          <stop offset="0%" stopColor={BRAND.accent} stopOpacity="0.16" />
          <stop offset="100%" stopColor={BRAND.accent} stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx="96" cy="104" r="82" fill="url(#wireGlow)" />

      {FACETS.map(([a, b], i) => (
        <motion.line
          key={`f${i}`}
          x1={P[a][0]}
          y1={P[a][1]}
          x2={P[b][0]}
          y2={P[b][1]}
          stroke={BRAND.accent}
          strokeWidth={0.55}
          initial={reduce ? { opacity: 0.3 } : { pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.3 }}
          transition={{ duration: 0.9, delay: reduce ? 0 : 0.25 + i * 0.016 }}
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
          strokeWidth={0.9}
          strokeLinecap="round"
          initial={reduce ? { opacity: 0.72 } : { pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.72 }}
          transition={{ duration: 1.1, delay: reduce ? 0 : 0.1 + i * 0.022 }}
        />
      ))}

      {NODES.map((n, i) => (
        <motion.circle
          key={`n${n}`}
          cx={P[n][0]}
          cy={P[n][1]}
          r={1.5}
          fill={BRAND.accentBright}
          initial={reduce ? { opacity: 0.85 } : { opacity: 0, scale: 0 }}
          animate={{ opacity: 0.85, scale: 1 }}
          transition={{ duration: 0.35, delay: reduce ? 0 : 0.7 + i * 0.03 }}
          style={{ transformOrigin: `${P[n][0]}px ${P[n][1]}px` }}
        />
      ))}
    </svg>
  );
}
