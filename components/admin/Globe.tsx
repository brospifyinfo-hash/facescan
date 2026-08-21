"use client";

import { useEffect, useRef } from "react";

// The live globe, v3: ZOOM. Mouse wheel and two-finger pinch go from the
// whole planet down to state level (up to 16x), and the map sharpens in
// tiers as you approach:
//
//   zoom < 2   countries at 110m  (135 KB, loaded always)
//   zoom ≥ 2   countries at 50m   (1.4 MB, fetched once on first cross)
//   zoom ≥ 4   states/provinces at 10m — the Bundesländer (7.7 MB raw,
//              ~1.5 MB over the wire, fetched once on first cross), with
//              their names fading in from 6x
//
// Still canvas 2D. The frame budget survives the 10m layer through
// per-ring bounding-box culling (four projected corners decide before the
// ring's hundreds of points are touched) and dirty-flag rendering — the
// loop only paints when rotation, zoom, data or points changed. The slow
// auto-spin runs at overview zoom only; zoomed in, a spinning map under
// the cursor would be hostile.

export interface GlobePoint {
  /** ISO 3166-1 alpha-2, upper case. */
  country: string;
  count: number;
  /** Exact coordinates (from the visitor's IP) — the dot sits on the CITY.
   *  Absent: the country centroid stands in. */
  lat?: number;
  lon?: number;
  /** What the dot says — the city name, falling back to the country code. */
  label?: string;
}

interface CountryShape {
  c: string;
  n: string;
  r: [number, number][][];
}

interface PreparedShape {
  c: string;
  n: string;
  rings: {
    pts: [number, number][];
    /** [minLon, minLat, maxLon, maxLat] */
    bbox: [number, number, number, number];
    wide: boolean;
  }[];
  /** Label anchor: centroid of the largest ring. */
  center: [number, number];
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

const RESUME_MS = 4_000;
const MAX_ZOOM = 16;
const DETAIL_50M_AT = 2;
const STATES_AT = 4;
const STATE_LABELS_AT = 6;

function prepare(shapes: CountryShape[]): PreparedShape[] {
  return shapes.map((s) => {
    let largest: [number, number][] = s.r[0] ?? [];
    const rings = s.r.map((pts) => {
      let minLon = 180, minLat = 90, maxLon = -180, maxLat = -90;
      for (const [lon, lat] of pts) {
        if (lon < minLon) minLon = lon;
        if (lon > maxLon) maxLon = lon;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
      if (pts.length > largest.length) largest = pts;
      return {
        pts,
        bbox: [minLon, minLat, maxLon, maxLat] as [number, number, number, number],
        wide: maxLon - minLon > 120,
      };
    });
    let cx = 0, cy = 0;
    for (const [lon, lat] of largest) {
      cx += lon;
      cy += lat;
    }
    const n = Math.max(1, largest.length);
    return { c: s.c, n: s.n, rings, center: [cy / n, cx / n] };
  });
}

export function Globe({
  points,
  size = 360,
  initial,
}: {
  points: GlobePoint[];
  size?: number;
  /** Start view — used by the demo page to open on a place; the live view
   *  starts at the overview and leaves the navigating to the owner. */
  initial?: { zoom?: number; lat?: number; lon?: number };
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const live = useRef<GlobePoint[]>(points);
  const dirty = useRef(true);
  live.current = points;
  dirty.current = true;

  const world110 = useRef<PreparedShape[] | null>(null);
  const world50 = useRef<PreparedShape[] | null>(null);
  const states10 = useRef<PreparedShape[] | null>(null);
  const loading = useRef<{ w50: boolean; s10: boolean }>({ w50: false, s10: false });

  useEffect(() => {
    let alive = true;
    fetch("/world-110m.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (alive && Array.isArray(data)) {
          world110.current = prepare(data as CountryShape[]);
          dirty.current = true;
        }
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
    // Centering lat0/lon0: yaw cancels the longitude, pitch equals the
    // latitude — that puts the point on the sphere's forward axis.
    let yaw =
      typeof initial?.lon === "number" ? (-initial.lon * Math.PI) / 180 : 0.55;
    let pitch =
      typeof initial?.lat === "number"
        ? (initial.lat * Math.PI) / 180
        : (-24 * Math.PI) / 180;
    let zoom = Math.max(1, Math.min(MAX_ZOOM, initial?.zoom ?? 1));
    let idleSince = -RESUME_MS;
    const pointers = new Map<number, { x: number; y: number }>();
    let pinchDist = 0;

    const cx = size / 2;
    const cy = size / 2;

    /** Fetch the sharper tiers exactly once, when zoom first needs them. */
    const ensureDetail = () => {
      if (zoom >= DETAIL_50M_AT && !world50.current && !loading.current.w50) {
        loading.current.w50 = true;
        fetch("/world-50m.json")
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => {
            if (Array.isArray(data)) {
              world50.current = prepare(data as CountryShape[]);
              dirty.current = true;
            }
          })
          .catch(() => {});
      }
      if (zoom >= STATES_AT && !states10.current && !loading.current.s10) {
        loading.current.s10 = true;
        fetch("/states-10m.json")
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => {
            if (Array.isArray(data)) {
              states10.current = prepare(data as CountryShape[]);
              dirty.current = true;
            }
          })
          .catch(() => {});
      }
    };

    let sinYaw = 0, cosYaw = 1, sinPitch = 0, cosPitch = 1, R = (size / 2) * 0.84;
    const setAngles = () => {
      sinYaw = Math.sin(yaw);
      cosYaw = Math.cos(yaw);
      sinPitch = Math.sin(pitch);
      cosPitch = Math.cos(pitch);
      R = (size / 2) * 0.84 * zoom;
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

    const margin = size * 0.35;
    const onScreen = (p: { x: number; y: number }) =>
      p.x > -margin && p.x < size + margin && p.y > -margin && p.y < size + margin;

    /** Cheap ring rejection: four projected bbox corners decide. */
    const ringVisible = (ring: PreparedShape["rings"][number]): boolean => {
      if (ring.wide) return true;
      const [minLon, minLat, maxLon, maxLat] = ring.bbox;
      const corners = [
        project(minLat, minLon),
        project(minLat, maxLon),
        project(maxLat, minLon),
        project(maxLat, maxLon),
      ];
      if (corners.every((p) => p.z <= 0)) return false;
      if (zoom > 1.5 && corners.every((p) => !onScreen(p))) return false;
      return true;
    };

    const tracePath = (pts: [number, number][]): { allFront: boolean } => {
      let allFront = true;
      let pen = false;
      ctx.beginPath();
      for (const [lon, lat] of pts) {
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

    const drawLayer = (
      shapes: PreparedShape[],
      activeSet: Set<string> | null,
      stroke: string,
      width: number,
    ) => {
      for (const shape of shapes) {
        const active = activeSet?.has(shape.c) ?? false;
        for (const ring of shape.rings) {
          if (!ringVisible(ring)) continue;
          const { allFront } = tracePath(ring.pts);
          if (active) {
            if (allFront) {
              ctx.fillStyle = "rgba(95, 227, 138, 0.12)";
              ctx.fill();
            }
            ctx.strokeStyle = "rgba(95, 227, 138, 0.85)";
            ctx.lineWidth = Math.max(width, 1.2);
          } else {
            ctx.strokeStyle = stroke;
            ctx.lineWidth = width;
          }
          ctx.stroke();
        }
      }
    };

    const draw = () => {
      frame = requestAnimationFrame(draw);
      const now = performance.now();
      // Auto-spin only at overview zoom, and only after the hands are off.
      if (!reduce && zoom < 1.3 && pointers.size === 0 && now - idleSince > RESUME_MS) {
        yaw += 0.0022;
        dirty.current = true;
      }
      if (!dirty.current) return;
      dirty.current = false;
      setAngles();
      ensureDetail();

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);

      // Sphere disk + limb (clipped to canvas at high zoom anyway).
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(95, 227, 138, 0.028)";
      ctx.fill();
      ctx.strokeStyle = "rgba(95, 227, 138, 0.4)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Graticule fades out as the map takes over.
      if (zoom < 3) {
        const alpha = 0.07 * Math.max(0, (3 - zoom) / 2);
        ctx.strokeStyle = `rgba(95, 227, 138, ${alpha.toFixed(3)})`;
        ctx.lineWidth = 1;
        const grat = (pts: Array<{ lat: number; lon: number }>) => {
          ctx.beginPath();
          let pen = false;
          for (const g of pts) {
            const p = project(g.lat, g.lon);
            if (p.z > 0) {
              if (pen) ctx.lineTo(p.x, p.y);
              else {
                ctx.moveTo(p.x, p.y);
                pen = true;
              }
            } else pen = false;
          }
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
      }

      const activeSet = new Set(live.current.map((p) => p.country));

      // States first (under the country borders), from 4x.
      if (zoom >= STATES_AT && states10.current) {
        drawLayer(states10.current, null, "rgba(190, 230, 205, 0.16)", 0.6);
      }

      // Countries: the sharpest tier that has arrived.
      const countries =
        zoom >= DETAIL_50M_AT && world50.current ? world50.current : (world110.current ?? []);
      drawLayer(countries, activeSet, "rgba(190, 230, 205, 0.26)", 0.9);

      // State names, from 6x — front-facing, on-screen, capped.
      if (zoom >= STATE_LABELS_AT && states10.current) {
        ctx.font = "500 9px ui-monospace, monospace";
        let drawn = 0;
        for (const s of states10.current) {
          if (drawn >= 60) break;
          const p = project(s.center[0], s.center[1]);
          if (p.z <= 0.05 || !onScreen(p)) continue;
          ctx.fillStyle = "rgba(190, 230, 205, 0.55)";
          ctx.fillText(s.n, p.x + 3, p.y);
          drawn++;
        }
      }

      // Visitor dots + city labels on top.
      for (const p of live.current) {
        const [lat, lon] =
          typeof p.lat === "number" && typeof p.lon === "number"
            ? [p.lat, p.lon]
            : (COORDS[p.country] ?? [0, 0]);
        const pos = project(lat, lon);
        if (pos.z <= 0 || !onScreen(pos)) continue;
        const r = Math.min(11, 3.5 + Math.log2(p.count + 1) * 2.5);
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(95, 227, 138, 0.95)";
        ctx.shadowColor = "rgba(95, 227, 138, 0.9)";
        ctx.shadowBlur = 14;
        ctx.fill();
        ctx.shadowBlur = 0;
        const label = `${p.label || p.country}${p.count > 1 ? ` · ${p.count}` : ""}`;
        ctx.font = "600 10px ui-monospace, monospace";
        const w = ctx.measureText(label).width;
        ctx.fillStyle = "rgba(5, 8, 13, 0.72)";
        ctx.fillRect(pos.x + r + 2, pos.y - 6, w + 6, 13);
        ctx.fillStyle = "rgba(245, 247, 248, 0.94)";
        ctx.fillText(label, pos.x + r + 5, pos.y + 4);
      }

      // Zoom badge, so the owner knows where the tiers switch.
      ctx.font = "500 10px ui-monospace, monospace";
      ctx.fillStyle = "rgba(154, 164, 174, 0.7)";
      ctx.fillText(`${zoom.toFixed(1)}x`, 8, size - 10);
    };

    // ---- Interaction: drag rotates, wheel and pinch zoom. ----
    const onDown = (e: PointerEvent) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      el.setPointerCapture(e.pointerId);
      el.style.cursor = "grabbing";
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      }
    };
    const onMove = (e: PointerEvent) => {
      const prev = pointers.get(e.pointerId);
      if (!prev) return;
      const cur = { x: e.clientX, y: e.clientY };
      if (pointers.size === 2) {
        pointers.set(e.pointerId, cur);
        const [a, b] = [...pointers.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinchDist > 0) {
          zoom = Math.max(1, Math.min(MAX_ZOOM, zoom * (dist / pinchDist)));
          dirty.current = true;
        }
        pinchDist = dist;
      } else {
        // Slower per pixel the closer you are — constant feel on screen.
        yaw += ((cur.x - prev.x) * 0.006) / zoom;
        pitch += ((cur.y - prev.y) * 0.005) / zoom;
        pitch = Math.max(-1.5, Math.min(1.5, pitch));
        pointers.set(e.pointerId, cur);
        dirty.current = true;
      }
      idleSince = performance.now();
    };
    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      pinchDist = 0;
      idleSince = performance.now();
      if (pointers.size === 0) el.style.cursor = "grab";
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoom = Math.max(1, Math.min(MAX_ZOOM, zoom * Math.exp(-e.deltaY * 0.0016)));
      idleSince = performance.now();
      dirty.current = true;
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("wheel", onWheel, { passive: false });

    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("wheel", onWheel);
    };
  }, [size]);

  return (
    <canvas
      ref={canvas}
      style={{ width: size, height: size, touchAction: "none", cursor: "grab" }}
      className="mx-auto select-none"
      aria-label="Live-Weltkugel der Besucher — ziehen zum Drehen, Rad oder Fingerspreizen zum Zoomen"
      role="img"
    />
  );
}
