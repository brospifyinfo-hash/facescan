"use client";

import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { IconHistory } from "./icons";
import { useT } from "@/lib/i18n";

/**
 * What the Verlauf tab opens.
 *
 * The reference's fourth tab is a history, and this product has none — by
 * construction, not by omission. Photos and results live in the tab's memory
 * and are discarded when the session expires, which is the claim the landing
 * page makes and the reason the free scan can make it honestly.
 *
 * So the tab shows the one scan that exists, and says why there is only one.
 * That is a feature stated as a feature. The alternative — a tab that opens
 * an empty list, or a greyed-out "coming soon" — would be the single fastest
 * way to make a paid report feel unfinished.
 */
export function HistoryCard({
  reference,
  date,
  score,
}: {
  reference: string;
  date: string;
  score: number;
}) {
  const t = useT();
  const router = useRouter();

  return (
    <section className="panel p-[var(--pad-panel)]">
      <div className="flex items-center gap-2">
        <IconHistory className="h-4 w-4 shrink-0 text-[var(--color-accent)]" aria-hidden />
        <h2 className="text-[12.5px] font-semibold uppercase tracking-[0.11em] text-[var(--color-ink)]">
          {t.results.tabs.history}
        </h2>
      </div>

      <div className="mt-3.5 flex items-center gap-3 rounded-[14px] border border-white/[0.06] bg-white/[0.022] p-3">
        <span className="tnum text-[22px] font-semibold leading-none tracking-[-0.02em] text-[var(--color-accent)]">
          {score.toFixed(1)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[11.5px] font-medium text-[var(--color-ink)]">
            {date}
          </span>
          <span className="tnum block truncate text-[10.5px] text-[var(--color-ink-tertiary)]">
            {reference}
          </span>
        </span>
      </div>

      <p className="mt-3 text-[11px] leading-[1.5] text-[var(--color-ink-secondary)]">
        {t.results.historyBody}
      </p>

      <button
        type="button"
        onClick={() => router.push("/upload")}
        className="interactive mt-3 flex w-full items-center justify-center gap-1 rounded-full border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/[0.06] py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-accent)]"
      >
        {t.results.newScan}
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
      </button>
    </section>
  );
}
