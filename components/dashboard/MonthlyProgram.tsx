"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { buildPlan } from "@/lib/plan";
import { useT } from "@/lib/i18n";
import type { QuizAnswers, ScanMetrics } from "@/lib/store";
import { cn } from "@/lib/cn";

/**
 * The 4-week programme — the substance behind the higher tier.
 *
 * Rather than inventing a generic calendar, it sequences the SAME
 * personalised action items the scan already produced: week one starts the
 * highest-impact habits, and each following week layers on the next ones
 * while the earlier ones keep running. That way the programme is genuinely
 * derived from this face and these answers, not a stock 30-day template.
 */
export function MonthlyProgram({
  quiz,
  metrics,
}: {
  quiz: QuizAnswers;
  metrics: ScanMetrics;
}) {
  const t = useT();
  const plan = buildPlan(quiz, metrics);
  const [week, setWeek] = useState(0);

  // Front-load the strongest levers, then introduce the rest in pairs.
  const weeks: (typeof plan)[] = [[], [], [], []];
  plan.forEach((entry, i) => {
    const w = i < 3 ? 0 : i < 5 ? 1 : i < 7 ? 2 : 3;
    weeks[w].push(entry);
  });

  // Everything started earlier keeps running — that is what makes it a plan.
  const carried = weeks.slice(0, week).flat();
  const introduced = weeks[week];

  return (
    <section className="surface p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight sm:text-lg">
            {t.monthly.title}
          </h2>
          <p className="mt-1.5 text-[12px] text-[var(--color-ink-tertiary)]">{t.monthly.sub}</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-4 gap-1.5">
        {weeks.map((_, i) => {
          const active = i === week;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setWeek(i)}
              aria-pressed={active}
              className={cn(
                "relative rounded-xl px-2 py-2.5 text-center transition-colors",
                active ? "text-[var(--color-accent-ink)]" : "text-[var(--color-ink-secondary)] hover:text-[var(--color-ink)]",
              )}
            >
              {active ? (
                <motion.span
                  layoutId="week-pill"
                  className="absolute inset-0 rounded-xl bg-accent"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              ) : (
                <span className="absolute inset-0 rounded-xl bg-white/[0.04]" />
              )}
              <span className="relative block text-[10px] uppercase tracking-[0.12em] opacity-70">
                {t.monthly.weekLabel}
              </span>
              <span className="relative block text-base font-semibold tabular-nums">
                {i + 1}
              </span>
            </button>
          );
        })}
      </div>

      <motion.ol
        key={week}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="mt-5 flex flex-col gap-2"
      >
        {introduced.map((entry) => {
          const copy = t.plan[entry.id];
          return (
            <li
              key={entry.id}
              className="flex items-start gap-3 rounded-2xl border border-accent/25 bg-accent/[0.05] p-4"
            >
              <span className="mt-0.5 text-base" aria-hidden>
                {entry.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-2 text-[13px] font-medium text-[var(--color-ink)]">
                  {copy.title}
                  <span className="rounded-md bg-accent/15 px-1.5 py-0.5 text-[10px] text-accent">
                    {copy.cadence}
                  </span>
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-ink-secondary)]">
                  {copy.detail}
                </p>
              </div>
            </li>
          );
        })}

        {carried.map((entry) => {
          const copy = t.plan[entry.id];
          return (
            <li
              key={entry.id}
              className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 opacity-60"
            >
              <span className="text-[13px]" aria-hidden>
                {entry.emoji}
              </span>
              <span className="flex-1 text-[12px] text-[var(--color-ink-secondary)]">{copy.title}</span>
              <span className="text-[10px] tabular-nums text-[var(--color-ink-tertiary)]">
                {copy.cadence}
              </span>
            </li>
          );
        })}
      </motion.ol>
    </section>
  );
}
