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

/** Trim trailing zeros so scale ends read "4.2" and "6.6", not "4.20". */
const tick = (v: number) =>
  Math.abs(v) >= 100 ? String(Math.round(v)) : String(Number(v.toFixed(2)));

/**
 * One measurement as a speedometer.
 *
 * The earlier version filled the arc from the start of the scale up to the
 * value, which reads as "more is better" — wrong for a metric where the
 * target is a BAND in the middle. This version uses the gauge idiom
 * everybody already knows: a grey scale, a green zone marking the normal
 * range, and a needle showing where this face lands. Nothing to decode.
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

  const size = 86;
  const cx = size / 2;
  const cy = size / 2;
  const stroke = 7;
  const r = size / 2 - stroke / 2 - 3;

  const bandA0 = START + frac(metric.ideal[0], metric.scale) * SWEEP;
  const bandA1 = START + frac(metric.ideal[1], metric.scale) * SWEEP;
  const valueA = START + frac(metric.value, metric.scale) * SWEEP;

  const needleTip = polar(cx, cy, r - stroke / 2 - 1.5, valueA);
  const needleTail = polar(cx, cy, 7, valueA + 180);
  const color = inRange ? "#95BF47" : "#E0A83E";

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`${t.metrics[metric.id].label}: ${metric.display}, ${t.status[metric.position]}`}
      initial={reduce ? false : { opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.4,
        delay: reduce ? 0 : index * 0.03,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={reduce ? undefined : { y: -3 }}
      className={cn(
        "group flex flex-col items-center rounded-2xl px-1 py-2.5 transition-colors duration-200",
        selected
          ? "bg-white/[0.09] ring-1 ring-accent/45"
          : "hover:bg-white/[0.05]",
      )}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="overflow-visible">
          {/* Full measurement scale */}
          <path
            d={arcPath(cx, cy, r, START, START + SWEEP)}
            fill="none"
            stroke="rgba(255,255,255,0.09)"
            strokeWidth={stroke}
            strokeLinecap="round"
          />

          {/* The normal range — the whole point of the dial */}
          <motion.path
            d={arcPath(cx, cy, r, bandA0, bandA1)}
            fill="none"
            stroke="#95BF47"
            strokeWidth={stroke}
            strokeLinecap="round"
            opacity={0.75}
            initial={reduce ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{
              duration: 0.7,
              delay: reduce ? 0 : 0.15 + index * 0.03,
              ease: [0.22, 1, 0.36, 1],
            }}
          />

          {/* Needle */}
          <motion.g
            initial={reduce ? false : { rotate: -SWEEP / 2, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            transition={{
              duration: 0.9,
              delay: reduce ? 0 : 0.35 + index * 0.03,
              ease: [0.22, 1, 0.36, 1],
            }}
            style={{ transformOrigin: `${cx}px ${cy}px` }}
          >
            <line
              x1={needleTail.x}
              y1={needleTail.y}
              x2={needleTip.x}
              y2={needleTip.y}
              stroke="#09090b"
              strokeWidth={4.5}
              strokeLinecap="round"
            />
            <line
              x1={needleTail.x}
              y1={needleTail.y}
              x2={needleTip.x}
              y2={needleTip.y}
              stroke={color}
              strokeWidth={2}
              strokeLinecap="round"
            />
            <circle cx={cx} cy={cy} r={3.5} fill="#09090b" />
            <circle cx={cx} cy={cy} r={2} fill={color} />
          </motion.g>
        </svg>

        {/* Scale ends, in the gap at the bottom */}
        <span className="absolute -bottom-0.5 left-0 text-[7px] tabular-nums text-zinc-600">
          {tick(metric.scale[0])}
        </span>
        <span className="absolute -bottom-0.5 right-0 text-[7px] tabular-nums text-zinc-600">
          {tick(metric.scale[1])}
        </span>

        {/* Value sits above the needle pivot so the two never collide */}
        <div className="pointer-events-none absolute inset-x-0 top-[22%] flex flex-col items-center">
          <span className="text-[11px] leading-none" aria-hidden>
            {METRIC_EMOJI[metric.id]}
          </span>
          <span className="mt-0.5 text-[12px] font-semibold leading-none tracking-tight text-zinc-50">
            {metric.display}
          </span>
        </div>
      </div>

      {/* Fixed two-line box keeps every grid row exactly the same height */}
      <span className="mt-1.5 flex min-h-[26px] items-start justify-center">
        <span className="line-clamp-2 text-center text-[10px] font-medium leading-[1.3] text-zinc-400">
          {t.metrics[metric.id].label}
        </span>
      </span>
    </motion.button>
  );
}
