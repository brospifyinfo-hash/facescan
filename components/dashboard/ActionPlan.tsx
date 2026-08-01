"use client";

import { useState } from "react";
import { buildPlan } from "@/lib/plan";
import { useT } from "@/lib/i18n";
import type { QuizAnswers, ScanMetrics } from "@/lib/store";
import { cn } from "@/lib/cn";

export function ActionPlan({
  quiz,
  metrics,
  interactive = true,
}: {
  quiz: QuizAnswers;
  metrics: ScanMetrics;
  interactive?: boolean;
}) {
  const t = useT();
  const plan = buildPlan(quiz, metrics);
  const [done, setDone] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    if (!interactive) return;
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <section className="glass rounded-[30px] p-7 sm:p-9">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2.5 text-xl font-semibold tracking-tight">
            <span aria-hidden>✨</span> {t.results.planTitle}
          </h2>
          <p className="mt-1.5 text-[13px] text-zinc-500">{t.results.planSub}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold text-zinc-100">
            {done.size}
            <span className="text-zinc-600"> / {plan.length}</span>
          </p>
          <p className="text-[10px] uppercase tracking-[0.12em] text-zinc-600">
            {t.results.completed}
          </p>
        </div>
      </div>

      <div className="mt-5 h-1 w-full overflow-hidden rounded-full bg-white/[0.07]">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-500"
          style={{ width: `${(done.size / plan.length) * 100}%` }}
        />
      </div>

      <ol className="mt-6 flex flex-col gap-2.5">
        {plan.map((entry) => {
          const copy = t.plan[entry.id];
          const isDone = done.has(entry.id);
          return (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => toggle(entry.id)}
                className={cn(
                  "glass-subtle flex w-full items-start gap-4 rounded-2xl p-4 text-left transition-all duration-200",
                  interactive && "hover:bg-white/[0.06]",
                  isDone && "opacity-55",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border text-sm transition-colors",
                    isDone
                      ? "border-accent bg-accent text-zinc-950"
                      : "border-white/10 bg-white/[0.04]",
                  )}
                  aria-hidden
                >
                  {isDone ? "✓" : entry.emoji}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <span
                      className={cn(
                        "text-[14px] font-medium text-zinc-100",
                        isDone && "line-through",
                      )}
                    >
                      {copy.title}
                    </span>
                    <span className="rounded-md bg-accent/12 px-2 py-0.5 text-[10px] font-medium text-accent">
                      {copy.cadence}
                    </span>
                  </span>
                  <span className="mt-1.5 block text-[12px] leading-relaxed text-zinc-500">
                    {copy.detail}
                  </span>
                </span>

                <span className="hidden shrink-0 rounded-full border border-white/[0.08] px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500 sm:block">
                  {copy.tag}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
