"use client";

import { Lock } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { DevUnlock } from "@/components/ui/DevUnlock";
import { AccountLink } from "@/components/ui/AccountLink";
import { useT } from "@/lib/i18n";

/**
 * The report's masthead.
 *
 * Two objects and nothing else: the mark, and a pill that states the one
 * property of this page a user cares about before they read a number. The
 * language switcher used to live up here and was moved to the footer — at
 * phone width a third control turned the row into a toolbar, and a toolbar
 * is not what a report opens with.
 *
 * The mark is wrapped in DevUnlock: a five-second press on it opens the
 * owner's code prompt. That is deliberately an invisible affordance on an
 * element that is already there.
 */
export function ReportHeader({ demo }: { demo?: boolean }) {
  const t = useT();

  return (
    <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <DevUnlock>
        <span className="flex items-center">
          <Logo height={28} />
        </span>
      </DevUnlock>

      <div className="flex shrink-0 items-center gap-2">
        <AccountLink />

        {/* Not a button — it has no action. A bordered pill at this weight
            reads as a state, which is what it is.

            Its label collapses below 380px, exactly as the account link's
            does. The wordmark is 194px and the three items together do not
            fit across a 375px phone; dropping both labels to their icons
            keeps them on one row instead of wrapping the header. */}
        <span
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/[0.06] px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-accent)]"
          title={t.results.confidential}
        >
          <Lock className="h-3 w-3" aria-hidden />
          <span className="hidden min-[380px]:inline">{t.results.confidential}</span>
        </span>
      </div>

      {/* basis-full, so it takes a line of its own rather than competing for
          the row. The wordmark plus both pills do not fit across 375px, and
          the two were landing on top of each other — DevUnlock's wrapper has
          no min-width:0, so the truncate that was meant to save it could
          never engage. A third item that wraps is the fix; shrinking type
          until it fits is not. */}
      {demo ? (
        <span className="t-caption basis-full rounded-full border border-[var(--color-caution)]/30 bg-[var(--color-caution)]/10 px-2 py-0.5 text-center font-medium text-[var(--color-caution)] sm:basis-auto">
          {t.results.demoData}
        </span>
      ) : null}
    </header>
  );
}
