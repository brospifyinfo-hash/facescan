"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CATEGORY_EMOJI,
  CATEGORY_ORDER,
  METRIC_EMOJI,
  POSITION_ICON,
  type CategoryId,
  type Metric,
} from "@/lib/metrics";
import { MetricDial } from "./MetricDial";
import { RangeBar } from "./RangeBar";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/cn";

type Filter = "all" | CategoryId;

/**
 * All fifteen measurements in one panel: a filter row, a dense ring grid
 * where every ring means the same thing, and one shared detail strip
 * carrying the exact scale for whichever ring is selected.
 */
export function MetricsPanel({ metrics }: { metrics: Metric[] }) {
  const t = useT();
  const [filter, setFilter] = useState<Filter>("all");

  // Default to the weakest measurement — the most useful thing to read first.
  const weakest = useMemo(
    () => [...metrics].sort((a, b) => a.score - b.score)[0],
    [metrics],
  );
  const [selectedId, setSelectedId] = useState(weakest.id);
  const selected = metrics.find((m) => m.id === selectedId) ?? weakest;

  const shown = filter === "all" ? metrics : metrics.filter((m) => m.category === filter);
  const inRange = shown.filter((m) => m.position === "in").length;

  const categoryLabel: Record<CategoryId, string> = {
    eyes: t.results.eyes,
    jaw: t.results.jaw,
    proportions: t.results.ratios,
    midface: t.results.midface,
  };

  return (
    <section className="surface p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="t-title2 flex items-center gap-2">
          <span aria-hidden>🧬</span> {t.results.breakdown}
        </h2>
        <span className="fill tnum t-caption rounded-full px-2.5 py-1 text-[var(--color-ink-secondary)]">
          {inRange}/{shown.length} · {t.results.inRange}
        </span>
      </div>

      {/* Wraps rather than scrolls: a hidden horizontal strip is
          undiscoverable on a phone. */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {(["all", ...CATEGORY_ORDER] as Filter[]).map((f) => {
          const active = filter === f;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                "t-footnote relative shrink-0 rounded-full px-3 py-1.5 font-medium transition-colors",
                active ? "text-[var(--color-accent-ink)]" : "text-[var(--color-ink-secondary)] hover:text-[var(--color-ink)]",
              )}
            >
              {active ? (
                <motion.span
                  layoutId="metric-filter-pill"
                  className="absolute inset-0 rounded-full bg-accent"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              ) : null}
              <span className="relative">
                {f === "all"
                  ? `📋 ${t.results.allMeasurements}`
                  : `${CATEGORY_EMOJI[f]} ${categoryLabel[f]}`}
              </span>
            </button>
          );
        })}
      </div>

      {/* How to read the grid — stated once. */}
      <p className="t-caption mt-3 text-[var(--color-ink-tertiary)]">
        {t.results.ringLegend}
      </p>

      {/* Detail strip — one shared explanation with the full scale */}
      <AnimatePresence mode="wait">
        <motion.div
          key={selected.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="fill mt-3 rounded-[var(--r-inner)] p-4"
        >
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-base" aria-hidden>
              {METRIC_EMOJI[selected.id]}
            </span>
            <span className="t-title3 text-[var(--color-ink)]">
              {t.metrics[selected.id].label}
            </span>
            {/* The measured figure, not tinted: the accent belongs to the
                primary action, and a number is not an action. It already
                stands out through weight and ink level. */}
            <span className="tnum t-title3 text-[var(--color-ink)]">
              {selected.display}
            </span>
            <span
              className={cn(
                "t-caption ml-auto flex items-center gap-1 rounded-full px-2 py-0.5 font-medium",
                selected.position === "in"
                  ? "bg-[var(--color-accent)]/12 text-[var(--color-accent)]"
                  : "bg-[var(--color-caution)]/12 text-[var(--color-caution)]",
              )}
            >
              <span aria-hidden>{POSITION_ICON[selected.position]}</span>
              {t.statusShort[selected.position]}
            </span>
          </div>

          <RangeBar metric={selected} />

          <p className="t-footnote mt-2.5 text-[var(--color-ink-secondary)]">
            {t.metrics[selected.id].note}
          </p>
        </motion.div>
      </AnimatePresence>

      {/* 15 rings fill 3 and 5 columns exactly. */}
      <motion.div
        layout
        className="mt-3 grid grid-cols-3 gap-1 sm:grid-cols-5"
      >
        <AnimatePresence mode="popLayout">
          {shown.map((m, i) => (
            <motion.div key={m.id} layout exit={{ opacity: 0, scale: 0.9 }}>
              <MetricDial
                metric={m}
                index={i}
                selected={m.id === selected.id}
                onSelect={() => setSelectedId(m.id)}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
    </section>
  );
}
