"use client";

import { motion, useReducedMotion } from "framer-motion";
import { POSITION_ICON, type Metric } from "@/lib/metrics";
import { METRIC_EMOJI } from "@/lib/metrics";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/cn";

// 270° gauge with the gap at the bottom. With SVG's y-down coordinates,
// 90° points straight down, so sweeping 135° → 405° leaves the bottom open.
const START = 135;
const SWEEP = 270;

const polar = (cx: number, cy: number, r: number, deg: number) => {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + Math.cos(rad) * r, y: cy + Math.sin(rad) * r };
};

function arcPath(cx: number, cy: number, r: number, a0: number, a1: number) {
  if (a1 - a0 < 0.01) return "";
  const p0 = polar(cx, cy, r, a0);
  const p1 = polar(cx, cy, r, a1);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A${r} ${r} 0 ${large} 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
}

/** Position of a value on the dial, as a 0..1 fraction of the scale. */
const frac = (v: number, [lo, hi]: [number, number]) =>
  Math.max(0, Math.min(1, (v - lo) / (hi - lo)));

/**
 * A single measurement as a radial gauge.
 *
 * The dial carries four things at once, which is why it beats a bare
 * percentage: the full measurement scale (track), the population reference
 * band (the brighter arc segment), where this face actually falls (the
 * marker and the filled arc), and the raw figure in the middle. The reader
 * sees a value *in context*, not a number stripped of its meaning.
 */
export function MetricDial({
  metric,
  size = 148,
  delay = 0,
}: {
  metric: Metric;
  size?: number;
  delay?: number;
}) {
  const t = useT();
  const reduce = useReducedMotion();
  const info = t.metrics[metric.id];
  const inRange = metric.position === "in";

  const cx = size / 2;
  const cy = size / 2;
  const stroke = 9;
  const r = size / 2 - stroke / 2 - 8;

  const bandA0 = START + frac(metric.ideal[0], metric.scale) * SWEEP;
  const bandA1 = START + frac(metric.ideal[1], metric.scale) * SWEEP;
  const valueF = frac(metric.value, metric.scale);
  const valueA = START + valueF * SWEEP;
  const marker = polar(cx, cy, r, valueA);

  const color = inRange ? "#95BF47" : "#E0A83E";
  const gid = `dial-${metric.id}`;

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className="glass glass-interactive flex flex-col items-center rounded-[26px] p-5"
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="overflow-visible">
          <defs>
            <linearGradient id={`${gid}-grad`} x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor={color} stopOpacity="0.5" />
              <stop offset="100%" stopColor={color} />
            </linearGradient>
            <filter id={`${gid}-glow`} x="-120%" y="-120%" width="340%" height="340%">
              <feGaussianBlur stdDeviation="3.2" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Track — the full measurement scale */}
          <path
            d={arcPath(cx, cy, r, START, START + SWEEP)}
            fill="none"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth={stroke}
            strokeLinecap="round"
          />

          {/* Reference band */}
          <path
            d={arcPath(cx, cy, r, bandA0, bandA1)}
            fill="none"
            stroke="rgba(149,191,71,0.3)"
            strokeWidth={stroke}
            strokeLinecap="round"
          />

          {/* Filled arc up to this face's value */}
          <motion.path
            d={arcPath(cx, cy, r, START, valueA)}
            fill="none"
            stroke={`url(#${gid}-grad)`}
            strokeWidth={stroke}
            strokeLinecap="round"
            initial={reduce ? false : { pathLength: 0, opacity: 0 }}
            whileInView={{ pathLength: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.1, delay: delay + 0.12, ease: [0.22, 1, 0.36, 1] }}
          />

          {/* Marker — surface ring keeps it legible where it crosses the band */}
          <motion.g
            initial={reduce ? false : { opacity: 0, scale: 0.4 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45, delay: delay + 0.85 }}
            style={{ transformOrigin: `${marker.x}px ${marker.y}px` }}
          >
            <circle cx={marker.x} cy={marker.y} r={6.5} fill="#09090b" />
            <circle
              cx={marker.x}
              cy={marker.y}
              r={4}
              fill={color}
              filter={`url(#${gid}-glow)`}
            />
          </motion.g>
        </svg>

        {/* Centre readout */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[17px] leading-none" aria-hidden>
            {METRIC_EMOJI[metric.id]}
          </span>
          <span className="mt-1.5 text-[22px] font-semibold leading-none tracking-tight text-zinc-50">
            {metric.display}
          </span>
          <span className="mt-1.5 text-[9px] font-medium uppercase tracking-[0.12em] text-zinc-600">
            {t.results.reference} {metric.ideal[0]}–{metric.ideal[1]}
          </span>
        </div>
      </div>

      <p className="mt-3 text-center text-[12px] font-medium leading-tight text-zinc-200">
        {info.label}
      </p>

      <span
        className={cn(
          "mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium",
          inRange
            ? "bg-accent/12 text-accent"
            : "bg-amber-400/12 text-amber-300",
        )}
      >
        <span aria-hidden>{POSITION_ICON[metric.position]}</span>
        {t.statusShort[metric.position]}
      </span>

      <p className="mt-3 text-center text-[11px] leading-relaxed text-zinc-500">
        {info.note}
      </p>
    </motion.div>
  );
}
