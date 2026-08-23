"use client";

import { Check } from "lucide-react";
import type { LevelRule } from "@/lib/affiliate/model";
import { fill, useT } from "@/lib/i18n";
import { cn } from "@/lib/cn";

// The five rungs, as rungs: hairlines and whitespace, no cards.
//
// Every figure here comes from the server's copy of the configuration. The
// component knows nothing about what a level is worth — the owner can move
// a threshold in the admin and this redraws, which is the whole reason the
// ladder is data rather than markup.

interface Props {
  levels: LevelRule[];
  /** The rung the partner is standing on. */
  current: number;
  /** The next rung, or null at the top. */
  next: number | null;
}

export function LevelLadder({ levels, current, next }: Props) {
  const t = useT();

  return (
    <section className="border-t border-[var(--color-hairline)] pt-6">
      <h2 className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--color-accent)]">
        {t.partner.dash.ladderTitle}
      </h2>

      <ul className="mt-3">
        {levels.map((rule) => {
          const reached = rule.level <= current;
          const isNext = rule.level === next;
          return (
            <li
              key={rule.level}
              className={cn(
                "flex items-center gap-3 border-t border-[var(--color-hairline)] py-3.5 first:border-t-0",
                !reached && !isNext && "opacity-45",
              )}
            >
              {/* The rung marker. A control-sized outline, filled once the
                  rung is behind you — the only place the accent appears in
                  this list, so "how far am I" is readable at a glance. */}
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-[13px] font-bold tnum",
                  reached
                    ? "border-[var(--color-accent)]/50 bg-[var(--color-accent-deep)] text-[var(--color-accent)]"
                    : "border-white/[0.08] bg-white/[0.02] text-[var(--color-ink-tertiary)]",
                )}
              >
                {reached ? <Check className="h-4 w-4" aria-hidden /> : rule.level}
              </span>

              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-[14px] font-semibold leading-tight text-[var(--color-ink)]">
                  <span className="truncate">{rule.label}</span>
                  {isNext ? (
                    <span className="shrink-0 rounded-full border border-[var(--color-accent)]/45 px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.06em] text-[var(--color-accent)]">
                      {t.partner.dash.ladderNext}
                    </span>
                  ) : null}
                </p>
                <p className="mt-0.5 text-[11.5px] leading-tight text-[var(--color-ink-tertiary)]">
                  {rule.minReferrals === 0
                    ? t.partner.dash.ladderFromZero
                    : fill(t.partner.dash.ladderFrom, { count: rule.minReferrals })}
                </p>
              </div>

              <p
                className={cn(
                  "tnum shrink-0 text-[16px] font-bold leading-none",
                  reached ? "text-[var(--color-accent)]" : "text-[var(--color-ink-secondary)]",
                )}
              >
                {rule.percent} %
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
