"use client";

import { useEffect, useRef } from "react";

// The live globe, v2: real country outlines (Natural Earth 110m, public
// domain, compacted to /world-110m.json at 135 KB) on an orthographic
// sphere, and the owner can GRAB it — drag rotates in both axes, and the
// slow auto-spin resumes a few seconds after letting go.
//
// Still canvas 2D, still no dependency. Per frame: batched strokes per
// country ring, front hemisphere only (~10k points total — comfortable).
// Countries with active visitors glow: accent border, and a soft fill when
// the whole outline faces the viewer (filling a limb-crossing polygon in an
// orthographic projection needs horizon clipping, which buys nothing here).

export interface GlobePoint {
  /** ISO 3166-1 alpha-2, upper case. */
  country: string;
  count: number;
}

interface CountryShape {
  c: string;
  n: string;
  r: [number, number][][];
}

/** Dot anchors — rough centroids; unknown codes land mid-Atlantic. */
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

/** How long after a drag before the auto-spin picks back up. */
const RESUME_MS = 4_000;

export function Globe({ points, size = 360 }: { points: GlobePoint[]; size?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const live = useRef<GlobePoint[]>(points);
  live.current = points;
  const world = useRef<CountryShape[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/world-110m.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (alive && Array.isArray(data)) world.current = data as CountryShape[];
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    el.width = size * dpr;
    el.height = size * dpr;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let yaw = 0.55; // start with Europe facing the viewer
    let pitch = (-24 * Math.PI) / 180;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let idleSince = 0;

    const R = (size / 2) * 0.84;
    const cx = size / 2;
    const cy = size / 2;

    // Projection: sphere → yaw around Y → pitch around X → orthographic.
    let sinYaw = 0, cosYaw = 1, sinPitch = 0, cosPitch = 1;
    const setAngles = () => {
      sinYaw = Math.sin(yaw);
      cosYaw = Math.cos(yaw);
      sinPitch = Math.sin(pitch);
      cosPitch = Math.cos(pitch);
    };
    const project = (latDeg: number, lonDeg: number) => {
      const lat = (latDeg * Math.PI) / 180;
      const lon = (lonDeg * Math.PI) / 180;
      const cosLat = Math.cos(lat);
      const x0 = cosLat * Math.sin(lon);
      const y0 = Math.sin(lat);
      const z0 = cosLat * Math.cos(lon);
      const x1 = x0 * cosYaw + z0 * sinYaw;
      const z1 = -x0 * sinYaw + z0 * cosYaw;
      const y2 = y0 * cosPitch - z1 * sinPitch;
      const z2 = y0 * sinPitch + z1 * cosPitch;
      return { x: cx + x1 * R, y: cy - y2 * R, z: z2 };
    };

    /** One ring as a batched path of its front-facing stretches. */
    const tracePath = (ring: [number, number][]): { allFront: boolean } => {
      let allFront = true;
      let pen = false;
      ctx.beginPath();
      for (const [lon, lat] of ring) {
        const p = project(lat, lon);
        if (p.z > 0) {
          if (pen) ctx.lineTo(p.x, p.y);
          else {
            ctx.moveTo(p.x, p.y);
            pen = true;
          }
        } else {
          allFront = false;
          pen = false;
        }
      }
      return { allFront };
    };

    const draw = () => {
      const now = performance.now();
      if (!dragging && !reduce && now - idleSince > RESUME_MS) yaw += 0.0022;
      setAngles();

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);

      // Sphere limb + a whisper of ocean so the disk reads as a body.
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(95, 227, 138, 0.028)";
      ctx.fill();
      ctx.strokeStyle = "rgba(95, 227, 138, 0.4)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Light graticule under the land, front only.
      ctx.lineWidth = 1;
      const grat = (ptsList: Array<{ lat: number; lon: number }>) => {
        ctx.beginPath();
        let pen = false;
        for (const g of ptsList) {
          const p = project(g.lat, g.lon);
          if (p.z > 0) {
            if (pen) ctx.lineTo(p.x, p.y);
            else {
              ctx.moveTo(p.x, p.y);
              pen = true;
            }
          } else pen = false;
        }
        ctx.strokeStyle = "rgba(95, 227, 138, 0.07)";
        ctx.stroke();
      };
      for (let lat = -60; lat <= 60; lat += 30) {
        const row = [];
        for (let i = 0; i <= 90; i++) row.push({ lat, lon: (i / 90) * 360 });
        grat(row);
      }
      for (let lon = 0; lon < 360; lon += 30) {
        const col = [];
        for (let i = 0; i <= 60; i++) col.push({ lat: -90 + (i / 60) * 180, lon });
        grat(col);
      }

      // Countries. Visitors' countries glow; everyone else is a quiet line.
      const activeSet = new Set(live.current.map((p) => p.country));
      const shapes = world.current ?? [];
      for (const shape of shapes) {
        const active = activeSet.has(shape.c);
        for (const ring of shape.r) {
          const { allFront } = tracePath(ring);
          if (active) {
            if (allFront) {
              ctx.fillStyle = "rgba(95, 227, 138, 0.14)";
              ctx.fill();
            }
            ctx.strokeStyle = "rgba(95, 227, 138, 0.85)";
            ctx.lineWidth = 1.2;
          } else {
            ctx.strokeStyle = "rgba(190, 230, 205, 0.22)";
            ctx.lineWidth = 0.8;
          }
          ctx.stroke();
        }
      }

      // Visitor dots + labels on top.
      for (const p of live.current) {
        const [lat, lon] = COORDS[p.country] ?? [0, 0];
        const pos = project(lat, lon);
        if (pos.z <= 0) continue;
        const r = Math.min(11, 3.5 + Math.log2(p.count + 1) * 2.5);
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(95, 227, 138, 0.95)";
        ctx.shadowColor = "rgba(95, 227, 138, 0.9)";
        ctx.shadowBlur = 14;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(245, 247, 248, 0.92)";
        ctx.font = "600 10px ui-monospace, monospace";
        ctx.fillText(`${p.country} ${p.count}`, pos.x + r + 4, pos.y + 3);
      }

      frame = requestAnimationFrame(draw);
    };

    // Grab to rotate — pointer events cover mouse and touch alike.
    const onDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      el.setPointerCapture(e.pointerId);
      el.style.cursor = "grabbing";
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      yaw += (e.clientX - lastX) * 0.006;
      pitch += (e.clientY - lastY) * 0.005;
      // Keep the poles from flipping over the top.
      pitch = Math.max(-1.35, Math.min(1.35, pitch));
      lastX = e.clientX;
      lastY = e.clientY;
      idleSince = performance.now();
    };
    const onUp = (e: PointerEvent) => {
      dragging = false;
      idleSince = performance.now();
      el.style.cursor = "grab";
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);

    idleSince = -RESUME_MS; // spin immediately on load
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    };
  }, [size]);

  return (
    <canvas
      ref={canvas}
      style={{ width: size, height: size, touchAction: "none", cursor: "grab" }}
      className="mx-auto select-none"
      aria-label="Live-Weltkugel der Besucher — ziehen zum Drehen"
      role="img"
    />
  );
}
