"use client";

import { motion, useReducedMotion } from "framer-motion";
import { METRIC_EMOJI, type Metric } from "@/lib/metrics";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import { BRAND } from "@/lib/theme";

/**
 * One measurement as a compact ring.
 *
 * Every ring means the SAME thing: how close this measurement sits to its
 * reference range, 0-100. That is the point — the version before this drew
 * each dial on its own scale with its own unit, so fifteen side by side
 * could not be compared at a glance. Now the grid answers "which areas are
 * strong and which are not" instantly, and the exact position inside the
 * band lives in the detail strip below, where there is room to label it.
 *
 * WHAT CAME OUT OF THE RING, AND WHY
 *
 * It used to hold three things: an emoji, the measured value, and the 0-100
 * score as an 8px numeral. Two problems, both real:
 *
 *   * 8px, and a 9.5px label under it. Apple's smallest text style is 11pt
 *     and its whole Dynamic Type ladder starts there. Text that small is not
 *     a dense-UI style, it is text a large share of people cannot read, and
 *     no amount of design intent changes that.
 *   * The number was REDUNDANT. The arc already encodes the score — that is
 *     the entire job of the arc. Printing it again inside the same 68px
 *     circle spent the scarcest space in the component restating what the
 *     ring had just said.
 *
 * Dropping it leaves room for the measured value to sit at a legible size,
 * which is the one figure the ring genuinely cannot show. The score is still
 * announced to screen readers, where it costs no space at all.
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
  const color = inRange ? BRAND.accent : BRAND.caution;

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
      className={cn(
        "group interactive flex flex-col items-center rounded-[var(--r-control)] px-1 py-2.5",
        // A press, not a hover lift. The lift was a desktop-web idiom that
        // simply did not exist on touch, so on a phone — most of this
        // product's traffic — the dial had no pressed state at all.
        selected
          ? "bg-white/[0.09] ring-1 ring-inset"
          : "hover:bg-white/[0.05]",
      )}
      style={selected ? { boxShadow: `inset 0 0 0 1px ${color}66` } : undefined}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={BRAND.track}
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

        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
          <span className="text-[13px] leading-none" aria-hidden>
            {METRIC_EMOJI[metric.id]}
          </span>
          {/* The one figure the arc cannot express: the measured value in its
              own unit. Tabular so a column of dials does not jitter. */}
          <span className="tnum text-[13px] font-semibold leading-none tracking-[-0.01em] text-[var(--color-ink)]">
            {metric.display}
          </span>
        </div>
      </div>

      {/* Fixed two-line box keeps every grid row exactly the same height. */}
      <span className="mt-2 flex min-h-[28px] items-start justify-center">
        <span className="t-caption line-clamp-2 text-center text-[var(--color-ink-secondary)]">
          {t.metrics[metric.id].label}
        </span>
      </span>
    </motion.button>
  );
}
