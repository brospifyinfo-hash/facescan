"use client";

import { motion, useReducedMotion } from "framer-motion";
import { METRIC_EMOJI, type Metric } from "@/lib/metrics";
import { CountUp } from "./CountUp";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/cn";

/**
 * One measurement as a compact ring.
 *
 * Every ring means the SAME thing: how close this measurement sits to its
 * reference range, 0-100. That is the whole point of the change — the
 * previous version drew each dial on its own scale with its own unit, so
 * fifteen of them side by side could not be compared at a glance and every
 * one had to be decoded separately. Now the grid answers "which areas are
 * strong and which are not" instantly, and the exact position inside the
 * band lives in the detail strip below, where there is room to label it.
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

  const size = 68;
  const stroke = 6;
  const r = (size - stroke) / 2 - 1;
  const c = 2 * Math.PI * r;
  const color = inRange ? "#95BF47" : "#E0A83E";

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`${t.metrics[metric.id].label}: ${metric.display}, ${t.status[metric.position]}, ${metric.score}/100`}
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
        selected ? "bg-white/[0.09] ring-1 ring-accent/45" : "hover:bg-white/[0.05]",
      )}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={stroke}
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            initial={reduce ? false : { strokeDashoffset: c }}
            animate={{ strokeDashoffset: c - (c * metric.score) / 100 }}
            transition={{
              duration: 1,
              delay: reduce ? 0 : 0.15 + index * 0.03,
              ease: [0.22, 1, 0.36, 1],
            }}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[12px] leading-none" aria-hidden>
            {METRIC_EMOJI[metric.id]}
          </span>
          <span className="mt-0.5 text-[12px] font-semibold leading-none tracking-tight text-zinc-50">
            {metric.display}
          </span>
          <span
            className="mt-0.5 text-[8px] font-medium leading-none tabular-nums"
            style={{ color }}
          >
            <CountUp value={metric.score} delay={200 + index * 30} />
          </span>
        </div>
      </div>

      {/* Fixed two-line box keeps every grid row exactly the same height */}
      <span className="mt-1.5 flex min-h-[24px] items-start justify-center">
        <span className="line-clamp-2 text-center text-[9.5px] font-medium leading-[1.3] text-zinc-400">
          {t.metrics[metric.id].label}
        </span>
      </span>
    </motion.button>
  );
}
