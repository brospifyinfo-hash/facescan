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
    <section className="glass rounded-3xl p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight sm:text-lg">
          <span aria-hidden>🧬</span> {t.results.breakdown}
        </h2>
        <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] tabular-nums text-zinc-400">
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
                "relative shrink-0 rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors",
                active ? "text-zinc-950" : "text-zinc-400 hover:text-zinc-100",
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
      <p className="mt-3 text-[10px] leading-relaxed text-zinc-500">
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
          className="glass-subtle mt-3 rounded-2xl p-4"
        >
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-base" aria-hidden>
              {METRIC_EMOJI[selected.id]}
            </span>
            <span className="text-sm font-semibold text-zinc-100">
              {t.metrics[selected.id].label}
            </span>
            <span className="text-sm font-semibold tabular-nums text-accent">
              {selected.display}
            </span>
            <span
              className={cn(
                "ml-auto flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                selected.position === "in"
                  ? "bg-accent/12 text-accent"
                  : "bg-amber-400/12 text-amber-300",
              )}
            >
              <span aria-hidden>{POSITION_ICON[selected.position]}</span>
              {t.statusShort[selected.position]}
            </span>
          </div>

          <RangeBar metric={selected} />

          <p className="mt-2 text-[12px] leading-relaxed text-zinc-400">
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
