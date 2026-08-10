"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { BRAND } from "@/lib/theme";

/**
 * Animated landmark mesh over an abstract face.
 *
 * A product illustration of the actual technique — a point cloud with
 * triangulated connections, drawing itself in — rather than a stock photo of
 * someone who never used the product. Everything here is generated, so it
 * shows the method without implying a customer.
 */

type P = { x: number; y: number };

/** Face-shaped outline in a 0..1 box. */
function ovalPoint(a: number, r: number): P {
  // Slightly egg-shaped: narrower toward the chin.
  const taper = 1 - 0.22 * Math.max(0, Math.sin(a));
  // Rounded, because Math.sin/cos can differ in the last bit between the
  // Node build that renders the HTML and the browser that hydrates it.
  // React then reports a hydration mismatch and refuses to patch the tree.
  // Four decimals is 0.04px at this viewBox — invisible, and identical on
  // both sides.
  return {
    x: round(0.5 + Math.cos(a) * 0.30 * r * taper),
    y: round(0.5 + Math.sin(a) * 0.40 * r),
  };
}

function round(v: number) {
  return Math.round(v * 1e4) / 1e4;
}

function buildMesh() {
  const pts: P[] = [];

  // Concentric rings give a triangulable, face-like distribution.
  const rings = [
    { r: 1.0, n: 26 },
    { r: 0.82, n: 24 },
    { r: 0.62, n: 20 },
    { r: 0.42, n: 16 },
    { r: 0.22, n: 10 },
  ];
  const ringStart: number[] = [];
  for (const { r, n } of rings) {
    ringStart.push(pts.length);
    for (let i = 0; i < n; i++) {
      pts.push(ovalPoint((Math.PI * 2 * i) / n - Math.PI / 2, r));
    }
  }
  const centre = pts.length;
  pts.push({ x: 0.5, y: 0.5 });

  // Feature points that read as a face.
  const feat = {
    eyeR: pts.length,
    eyeL: pts.length + 1,
    nose: pts.length + 2,
    mouthR: pts.length + 3,
    mouthL: pts.length + 4,
    chin: pts.length + 5,
  };
  pts.push(
    { x: 0.385, y: 0.42 },
    { x: 0.615, y: 0.42 },
    { x: 0.5, y: 0.565 },
    { x: 0.425, y: 0.655 },
    { x: 0.575, y: 0.655 },
    { x: 0.5, y: 0.86 },
  );

  const edges: Array<[number, number]> = [];

  // Ring edges + spokes to the next ring in.
  rings.forEach(({ n }, ri) => {
    const start = ringStart[ri];
    for (let i = 0; i < n; i++) {
      edges.push([start + i, start + ((i + 1) % n)]);
      if (ri + 1 < rings.length) {
        const nextN = rings[ri + 1].n;
        const nextStart = ringStart[ri + 1];
        const j = Math.round((i / n) * nextN) % nextN;
        edges.push([start + i, nextStart + j]);
        edges.push([start + ((i + 1) % n), nextStart + j]);
      } else {
        edges.push([start + i, centre]);
      }
    }
  });

  for (const f of Object.values(feat)) edges.push([f, centre]);
  edges.push([feat.eyeR, feat.eyeL], [feat.mouthR, feat.mouthL]);
  edges.push([feat.eyeR, feat.nose], [feat.eyeL, feat.nose]);
  edges.push([feat.nose, feat.mouthR], [feat.nose, feat.mouthL]);
  edges.push([feat.mouthR, feat.chin], [feat.mouthL, feat.chin]);

  return { pts, edges, feat };
}

export function HeroMesh({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  const { pts, edges, feat } = useMemo(buildMesh, []);
  const S = 400;

  return (
    <div className={className}>
      <svg viewBox={`0 0 ${S} ${S}`} className="h-full w-full" aria-hidden>
        <defs>
          <radialGradient id="heroGlow" cx="50%" cy="45%" r="55%">
            <stop offset="0%" stopColor={BRAND.accent} stopOpacity="0.16" />
            <stop offset="100%" stopColor={BRAND.accent} stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle cx={S / 2} cy={S * 0.46} r={S * 0.44} fill="url(#heroGlow)" />

        {edges.map(([a, b], i) => (
          <motion.line
            key={i}
            x1={pts[a].x * S}
            y1={pts[a].y * S}
            x2={pts[b].x * S}
            y2={pts[b].y * S}
            stroke={BRAND.accent}
            strokeWidth={0.6}
            initial={reduce ? { opacity: 0.16 } : { pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.16 }}
            transition={{
              duration: 1.1,
              delay: reduce ? 0 : 0.25 + (i % 40) * 0.014,
              ease: "easeOut",
            }}
          />
        ))}

        {pts.map((p, i) => {
          const isFeature = Object.values(feat).includes(i);
          return (
            <motion.circle
              key={i}
              cx={p.x * S}
              cy={p.y * S}
              r={isFeature ? 2.6 : 1.3}
              fill={isFeature ? BRAND.accentBright : BRAND.accent}
              initial={reduce ? { opacity: 1 } : { opacity: 0, scale: 0 }}
              animate={{ opacity: isFeature ? 0.95 : 0.6, scale: 1 }}
              transition={{
                duration: 0.4,
                delay: reduce ? 0 : 0.15 + (i % 30) * 0.02,
              }}
              style={{ transformOrigin: `${p.x * S}px ${p.y * S}px` }}
            />
          );
        })}

        {/* Sweep, matching the scan screen's beam */}
        {reduce ? null : (
          <motion.rect
            x={0}
            width={S}
            height={S * 0.14}
            fill="url(#heroGlow)"
            animate={{ y: [S * 0.05, S * 0.85, S * 0.05] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </svg>
    </div>
  );
}
