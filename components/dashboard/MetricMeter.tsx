"use client";

import { motion } from "framer-motion";
import { POSITION_ICON, POSITION_LABEL, type Metric } from "@/lib/metrics";
import { cn } from "@/lib/cn";

const pct = (v: number, [lo, hi]: [number, number]) =>
  Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100));

/**
 * Stat tile + meter. The track shows the full measurement scale, the accent
 * band shows the population reference range, and the marker is where this
 * face actually falls — so the number is readable as a position, not just a
 * score. Status ships as icon + label, never colour alone.
 */
export function MetricMeter({
  metric,
  delay = 0,
}: {
  metric: Metric;
  delay?: number;
}) {
  const inRange = metric.position === "in";
  const bandLeft = pct(metric.ideal[0], metric.scale);
  const bandRight = pct(metric.ideal[1], metric.scale);
  const marker = pct(metric.value, metric.scale);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
      className="group relative rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 transition-colors hover:border-white/15 hover:bg-white/[0.04]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-xl leading-none" aria-hidden>
            {metric.emoji}
          </span>
          <span className="text-[13px] font-medium text-zinc-300">
            {metric.label}
          </span>
        </div>
        {/* Value uses proportional figures — tabular-nums is for the table. */}
        <span className="text-lg font-semibold leading-none text-zinc-50">
          {metric.display}
        </span>
      </div>

      {/* Meter */}
      <div className="mt-4">
        <div className="relative h-1.5 w-full rounded-full bg-white/[0.07]">
          {/* Reference band */}
          <div
            className={cn(
              "absolute inset-y-0 rounded-full",
              inRange ? "bg-accent/35" : "bg-white/15",
            )}
            style={{
              left: `${bandLeft}%`,
              width: `${Math.max(2, bandRight - bandLeft)}%`,
            }}
          />
          {/* Marker — 2px surface ring keeps it legible over the band */}
          <motion.span
            className={cn(
              "absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-zinc-950",
              inRange ? "bg-accent" : "bg-amber-400",
            )}
            initial={{ left: "50%", opacity: 0 }}
            whileInView={{ left: `${marker}%`, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: delay + 0.1, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>

        <div className="mt-2.5 flex items-center justify-between text-[10px]">
          <span
            className={cn(
              "flex items-center gap-1 font-medium",
              inRange ? "text-accent" : "text-amber-400",
            )}
          >
            <span aria-hidden>{POSITION_ICON[metric.position]}</span>
            {POSITION_LABEL[metric.position]}
          </span>
          <span className="tabular-nums text-zinc-600">
            ref {metric.ideal[0]}–{metric.ideal[1]}
            {metric.unit === "°" ? "°" : ""}
          </span>
        </div>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
        {metric.note}
      </p>
    </motion.div>
  );
}
