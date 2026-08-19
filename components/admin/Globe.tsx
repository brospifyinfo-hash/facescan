"use client";

import { useEffect, useRef } from "react";

// The live globe: a wireframe sphere in the scanner's own language, with an
// accent dot per country that currently has visitors. Canvas 2D and ~90
// lines of projection math — no three.js for one sphere.
//
// The rotation runs on requestAnimationFrame, which stops by itself when
// the tab is hidden — an admin dashboard left open in a background tab
// costs nothing.

export interface GlobePoint {
  /** ISO 3166-1 alpha-2, upper case. */
  country: string;
  count: number;
}

/** Rough centroids for the countries that plausibly show up. Unknown codes
 *  fall back to (0,0) mid-Atlantic — visible, honest, slightly lost. */
const COORDS: Record<string, [number, number]> = {
  AD: [42.5, 1.5], AE: [24, 54], AL: [41, 20], AR: [-34, -64], AT: [47.5, 14],
  AU: [-25, 133], BA: [44, 18], BE: [50.8, 4.5], BG: [43, 25], BR: [-10, -55],
  CA: [56, -106], CH: [47, 8], CL: [-30, -71], CN: [35, 105], CO: [4, -72],
  CZ: [49.8, 15.5], DE: [51, 10], DK: [56, 10], DZ: [28, 3], EE: [59, 26],
  EG: [27, 30], ES: [40, -4], FI: [64, 26], FR: [46, 2], GB: [54, -2],
  GR: [39, 22], HR: [45, 15.5], HU: [47, 20], ID: [-5, 120], IE: [53, -8],
  IL: [31, 35], IN: [21, 78], IQ: [33, 44], IR: [32, 53], IS: [65, -18],
  IT: [43, 12], JP: [36, 138], KE: [1, 38], KR: [36, 128], KZ: [48, 68],
  LI: [47.1, 9.5], LT: [55, 24], LU: [49.8, 6.1], LV: [57, 25], MA: [32, -6],
  MD: [47, 29], ME: [42.5, 19], MK: [41.6, 21.7], MX: [23, -102], MY: [3, 112],
  NG: [9, 8], NL: [52.3, 5.5], NO: [61, 9], NZ: [-42, 172], PE: [-10, -76],
  PH: [12, 122], PK: [30, 70], PL: [52, 19], PT: [39.5, -8], RO: [46, 25],
  RS: [44, 21], RU: [60, 90], SA: [24, 45], SE: [62, 15], SG: [1.35, 103.8],
  SI: [46, 15], SK: [48.7, 19.5], TH: [15, 101], TN: [34, 9], TR: [39, 35],
  TW: [23.7, 121], UA: [49, 32], US: [38, -97], UY: [-33, -56], VE: [7, -66],
  VN: [16, 108], ZA: [-29, 24],
};

const TILT = (-22 * Math.PI) / 180;

function project(
  latDeg: number,
  lonDeg: number,
  theta: number,
  radius: number,
): { x: number; y: number; z: number } {
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180 + theta;
  // Sphere → 3D.
  let x = Math.cos(lat) * Math.sin(lon);
  let y = Math.sin(lat);
  let z = Math.cos(lat) * Math.cos(lon);
  // Tilt around X so the northern hemisphere faces the viewer a little.
  const y2 = y * Math.cos(TILT) - z * Math.sin(TILT);
  const z2 = y * Math.sin(TILT) + z * Math.cos(TILT);
  return { x: x * radius, y: y2 * radius, z: z2 };
}

export function Globe({ points, size = 360 }: { points: GlobePoint[]; size?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const live = useRef<GlobePoint[]>(points);
  live.current = points;

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    el.width = size * dpr;
    el.height = size * dpr;

    let frame = 0;
    let theta = 0;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const draw = () => {
      const R = (size / 2) * 0.82;
      const cx = size / 2;
      const cy = size / 2;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);

      // Sphere limb.
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(95, 227, 138, 0.35)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Graticule: latitude rings and meridians, front brighter than back.
      const seg = 72;
      const stroke = (pts: Array<{ x: number; y: number; z: number }>) => {
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1];
          const b = pts[i];
          ctx.beginPath();
          ctx.moveTo(cx + a.x, cy - a.y);
          ctx.lineTo(cx + b.x, cy - b.y);
          ctx.strokeStyle =
            a.z > 0 && b.z > 0 ? "rgba(95, 227, 138, 0.22)" : "rgba(95, 227, 138, 0.05)";
          ctx.stroke();
        }
      };
      for (let lat = -60; lat <= 60; lat += 30) {
        const pts = [];
        for (let i = 0; i <= seg; i++) pts.push(project(lat, (i / seg) * 360, theta, R));
        stroke(pts);
      }
      for (let lon = 0; lon < 360; lon += 30) {
        const pts = [];
        for (let i = 0; i <= seg; i++) pts.push(project(-90 + (i / seg) * 180, lon, theta, R));
        stroke(pts);
      }

      // Visitor dots — one per country, sized by head count.
      for (const p of live.current) {
        const [lat, lon] = COORDS[p.country] ?? [0, 0];
        const pos = project(lat, lon, theta, R);
        const front = pos.z > 0;
        const r = Math.min(11, 3.5 + Math.log2(p.count + 1) * 2.5);
        ctx.beginPath();
        ctx.arc(cx + pos.x, cy - pos.y, front ? r : r * 0.55, 0, Math.PI * 2);
        if (front) {
          ctx.fillStyle = "rgba(95, 227, 138, 0.95)";
          ctx.shadowColor = "rgba(95, 227, 138, 0.9)";
          ctx.shadowBlur = 14;
        } else {
          ctx.fillStyle = "rgba(95, 227, 138, 0.16)";
          ctx.shadowBlur = 0;
        }
        ctx.fill();
        ctx.shadowBlur = 0;
        if (front) {
          ctx.fillStyle = "rgba(245, 247, 248, 0.9)";
          ctx.font = "600 10px ui-monospace, monospace";
          ctx.fillText(`${p.country} ${p.count}`, cx + pos.x + r + 4, cy - pos.y + 3);
        }
      }

      theta += reduce ? 0 : 0.0035;
      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [size]);

  return (
    <canvas
      ref={canvas}
      style={{ width: size, height: size }}
      className="mx-auto"
      aria-label="Live-Weltkarte der Besucher"
      role="img"
    />
  );
}
