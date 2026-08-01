"use client";

import { motion, useReducedMotion } from "framer-motion";
import { METRIC_EMOJI, type Metric } from "@/lib/metrics";
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

const frac = (v: number, [lo, hi]: [number, number]) =>
  Math.max(0, Math.min(1, (v - lo) / (hi - lo)));

/**
 * Compact radial gauge — one grid cell.
 *
 * The dial still carries the full measurement scale (track), the reference
 * band (accent arc) and this face's position (marker + fill); the written
 * explanation moved to the shared detail strip so sixteen of these fit on a
 * phone screen instead of sprawling over five.
 */
export function MetricDial({
  metric,
  selected,
  onSelect,
  index = 0,
}: {
  metric: Metric;
  selected: boolean;
  onSelect: () => void;
  index?: number;
}) {
  const t = useT();
  const reduce = useReducedMotion();
  const inRange = metric.position === "in";

  const size = 76;
  const cx = size / 2;
  const cy = size / 2;
  const stroke = 6;
  const r = size / 2 - stroke / 2 - 2;

  const bandA0 = START + frac(metric.ideal[0], metric.scale) * SWEEP;
  const bandA1 = START + frac(metric.ideal[1], metric.scale) * SWEEP;
  const valueA = START + frac(metric.value, metric.scale) * SWEEP;
  const marker = polar(cx, cy, r, valueA);

  const color = inRange ? "#95BF47" : "#E0A83E";
  const gid = `d-${metric.id}`;

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      initial={reduce ? false : { opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.4,
        delay: reduce ? 0 : index * 0.035,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={reduce ? undefined : { y: -3 }}
      className={cn(
        "group relative flex flex-col items-center rounded-2xl px-1.5 py-3 transition-colors duration-200",
        selected
          ? "bg-white/[0.09] ring-1 ring-accent/45"
          : "hover:bg-white/[0.05]",
      )}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="overflow-visible">
          <defs>
            <linearGradient id={`${gid}-g`} x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor={color} stopOpacity="0.45" />
              <stop offset="100%" stopColor={color} />
            </linearGradient>
          </defs>

          <path
            d={arcPath(cx, cy, r, START, START + SWEEP)}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={stroke}
            strokeLinecap="round"
          />
          <path
            d={arcPath(cx, cy, r, bandA0, bandA1)}
            fill="none"
            stroke="rgba(149,191,71,0.28)"
            strokeWidth={stroke}
            strokeLinecap="round"
          />
          <motion.path
            d={arcPath(cx, cy, r, START, valueA)}
            fill="none"
            stroke={`url(#${gid}-g)`}
            strokeWidth={stroke}
            strokeLinecap="round"
            initial={reduce ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{
              duration: 1,
              delay: reduce ? 0 : 0.25 + index * 0.035,
              ease: [0.22, 1, 0.36, 1],
            }}
          />
          <motion.circle
            cx={marker.x}
            cy={marker.y}
            r={4.5}
            fill="#09090b"
            initial={reduce ? false : { scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3, delay: reduce ? 0 : 1.1 + index * 0.035 }}
            style={{ transformOrigin: `${marker.x}px ${marker.y}px` }}
          />
          <motion.circle
            cx={marker.x}
            cy={marker.y}
            r={2.6}
            fill={color}
            initial={reduce ? false : { scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3, delay: reduce ? 0 : 1.15 + index * 0.035 }}
            style={{ transformOrigin: `${marker.x}px ${marker.y}px` }}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[13px] leading-none" aria-hidden>
            {METRIC_EMOJI[metric.id]}
          </span>
          <span className="mt-1 text-[12px] font-semibold leading-none tracking-tight text-zinc-50">
            {metric.display}
          </span>
        </div>
      </div>

      {/* Fixed two-line box keeps every grid row the same height regardless
          of how long the label runs. */}
      <span className="mt-2 flex min-h-[26px] items-start justify-center">
        <span className="line-clamp-2 text-center text-[10px] font-medium leading-[1.3] text-zinc-400">
          {t.metrics[metric.id].label}
        </span>
      </span>

      <span
        className={cn(
          "mt-1 h-1.5 w-1.5 rounded-full",
          inRange ? "bg-accent" : "bg-amber-400",
        )}
        aria-hidden
      />
      <span className="sr-only">{t.status[metric.position]}</span>
    </motion.button>
  );
}
