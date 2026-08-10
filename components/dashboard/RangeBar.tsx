"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { Metric } from "@/lib/metrics";
import { useT } from "@/lib/i18n";

const pct = (v: number, [lo, hi]: [number, number]) =>
  Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100));

const tick = (v: number) =>
  Math.abs(v) >= 100 ? String(Math.round(v)) : String(Number(v.toFixed(2)));

/**
 * Horizontal scale for one measurement, with the reference range shaded and
 * a marker where this face falls. This is the readable home for the "where
 * in the range" information — laid out flat there is room for the scale
 * endpoints, the band bounds and the marker value, none of which fit legibly
 * around a 68px ring.
 */
export function RangeBar({ metric }: { metric: Metric }) {
  const t = useT();
  const reduce = useReducedMotion();
  const inRange = metric.position === "in";

  const bandL = pct(metric.ideal[0], metric.scale);
  const bandR = pct(metric.ideal[1], metric.scale);
  const marker = pct(metric.value, metric.scale);
  const color = inRange ? "#95BF47" : "#E0A83E";

  return (
    <div className="pt-1">
      <div className="relative h-8">
        {/* Track */}
        <div className="absolute inset-x-0 top-3 h-2 rounded-full bg-white/[0.07]" />

        {/* Reference range */}
        <div
          className="absolute top-3 h-2 rounded-full bg-accent/35"
          style={{ left: `${bandL}%`, width: `${Math.max(1.5, bandR - bandL)}%` }}
        />

        {/* Band bounds */}
        {[bandL, bandR].map((p, i) => (
          <span
            key={i}
            className="absolute top-1.5 h-5 w-px bg-accent/60"
            style={{ left: `${p}%` }}
          />
        ))}

        {/* Marker */}
        <motion.span
          className="absolute top-1.5 h-5 w-[3px] rounded-full ring-2 ring-zinc-950"
          style={{ backgroundColor: color }}
          initial={reduce ? false : { left: "50%", opacity: 0 }}
          animate={{ left: `${marker}%`, opacity: 1 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>

      <div className="flex items-center justify-between text-[9.5px] tabular-nums text-[var(--color-ink-tertiary)]">
        <span>{tick(metric.scale[0])}</span>
        <span className="text-accent/80">
          {t.results.legendBand} {tick(metric.ideal[0])}–{tick(metric.ideal[1])}
        </span>
        <span>{tick(metric.scale[1])}</span>
      </div>
    </div>
  );
}
