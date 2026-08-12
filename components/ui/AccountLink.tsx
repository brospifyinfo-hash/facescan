"use client";

import Link from "next/link";
import { UserRound } from "lucide-react";
import { useT } from "@/lib/i18n";

/**
 * Header entry to the customer's account.
 *
 * Shown to everyone, signed in or not — /konto handles both states, and a
 * link that appears only once you are already signed in is a link nobody can
 * use to sign in. The label is hidden on the narrowest screens so the header
 * row never wraps; the icon carries it, with the name still on the element
 * for screen readers.
 */
export function AccountLink({ className }: { className?: string }) {
  const t = useT();

  return (
    <Link
      href="/konto"
      aria-label={t.navAccount}
      className={
        className ??
        "flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1.5 text-[12px] font-medium text-[var(--color-ink-secondary)] transition-colors hover:border-white/20 hover:text-[var(--color-ink)]"
      }
    >
      <UserRound className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="hidden min-[380px]:inline">{t.navAccount}</span>
    </Link>
  );
}
