"use client";

import { useState } from "react";
import { buildPlan } from "@/lib/plan";
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
  const plan = buildPlan(quiz, metrics);
  const [done, setDone] = useState<Set<number>>(new Set());

  const toggle = (i: number) => {
    if (!interactive) return;
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const completed = done.size;

  return (
    <section className="rounded-3xl border border-white/[0.07] bg-white/[0.02] p-7 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2.5 text-lg font-semibold tracking-tight">
            <span aria-hidden>✨</span> Your Glow-Up Plan
          </h2>
          <p className="mt-1.5 text-[13px] text-zinc-500">
            Ordered by projected impact for your specific measurements.
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-zinc-100">
            {completed}
            <span className="text-zinc-600"> / {plan.length}</span>
          </p>
          <p className="text-[10px] uppercase tracking-[0.12em] text-zinc-600">
            Completed
          </p>
        </div>
      </div>

      {/* Progress meter */}
      <div className="mt-5 h-1 w-full overflow-hidden rounded-full bg-white/[0.07]">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-500"
          style={{ width: `${(completed / plan.length) * 100}%` }}
        />
      </div>

      <ol className="mt-6 flex flex-col gap-2.5">
        {plan.map((item, i) => {
          const isDone = done.has(i);
          return (
            <li key={item.title}>
              <button
                type="button"
                onClick={() => toggle(i)}
                className={cn(
                  "flex w-full items-start gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-left transition-all",
                  interactive && "hover:border-white/15 hover:bg-white/[0.045]",
                  isDone && "opacity-55",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border text-sm transition-colors",
                    isDone
                      ? "border-accent bg-accent text-zinc-950"
                      : "border-white/10 bg-white/[0.03]",
                  )}
                  aria-hidden
                >
                  {isDone ? "✓" : item.emoji}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <span
                      className={cn(
                        "text-[14px] font-medium text-zinc-100",
                        isDone && "line-through",
                      )}
                    >
                      {item.title}
                    </span>
                    <span className="rounded-md bg-accent/12 px-2 py-0.5 text-[10px] font-medium tabular-nums text-accent">
                      {item.cadence}
                    </span>
                  </span>
                  <span className="mt-1.5 block text-[12px] leading-relaxed text-zinc-500">
                    {item.detail}
                  </span>
                </span>

                <span className="hidden shrink-0 rounded-full border border-white/[0.07] px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500 sm:block">
                  {item.tag}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
