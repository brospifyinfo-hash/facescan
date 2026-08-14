"use client";

import Link from "next/link";
import { ChevronRight, UserRound } from "lucide-react";
import { useT } from "@/lib/i18n";

/**
 * The report's link into the account.
 *
 * This replaces a card that summarised "this scan" and explained that no
 * older one could exist. That was true when nothing was stored; it is not
 * true now, because a paid scan is filed under the customer's address. Copy
 * that contradicts what the app does is worse than no copy at all, so the
 * card states which of the two situations the reader is actually in.
 */
export function AccountCard({ signedIn }: { signedIn: boolean }) {
  const t = useT();
  const saved = signedIn;

  return (
    <Link
      href="/konto"
      className="panel interactive flex w-full items-center gap-3.5 p-[var(--pad-panel)] text-left hover:border-white/15"
    >
      <span
        aria-hidden
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-deep)]"
      >
        <UserRound className="h-5 w-5 text-[var(--color-accent)]" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--color-accent)]">
          {t.account.title}
        </span>
        <span className="t-caption mt-1 block leading-relaxed text-[var(--color-ink-secondary)]">
          {saved ? t.account.savedBody : t.account.teaserBody}
        </span>
      </span>

      <ChevronRight
        className="h-4 w-4 shrink-0 text-[var(--color-accent)]"
        aria-hidden
      />
    </Link>
  );
}
