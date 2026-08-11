"use client";

import { ChevronRight } from "lucide-react";
import { IconBulb } from "./icons";
import { useT } from "@/lib/i18n";

/**
 * The closing card. A real button — it takes the user to the full plan, which
 * is the thing "more tips" has to mean if the card is going to look tappable.
 * A card styled as a control that does nothing is the cheapest way to make an
 * interface feel fake.
 */
export function TipCard({ onMore }: { onMore: () => void }) {
  const t = useT();

  return (
    <button
      type="button"
      onClick={onMore}
      className="panel interactive flex w-full items-center gap-3.5 p-[var(--pad-panel)] text-left hover:border-white/15"
    >
      <span
        aria-hidden
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-deep)]"
        style={{ boxShadow: "0 0 18px -4px rgba(95,227,138,0.35)" }}
      >
        <IconBulb className="h-5 w-5 text-[var(--color-accent)]" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--color-accent)]">
          {t.results.tipTitle}
        </span>
        <span className="t-caption mt-1 block leading-relaxed text-[var(--color-ink-secondary)]">
          {t.results.tipBody}
        </span>
      </span>

      <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-accent)]">
        <span className="hidden min-[400px]:inline">{t.results.moreTips}</span>
        <ChevronRight className="h-4 w-4" aria-hidden />
      </span>
    </button>
  );
}
