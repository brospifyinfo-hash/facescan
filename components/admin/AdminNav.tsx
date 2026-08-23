"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

// The cockpit's own navigation — four rooms, one line.
//
// It became a client component when the affiliate area arrived: the payout
// tab carries a live count of open requests, and that number has to come from
// somewhere. Fetching it here rather than threading it through five server
// pages keeps the pages thin, and a nav that renders links is nothing to ship
// to the browser.
const TABS = [
  { key: "live", href: "/admin/live", label: "Live" },
  { key: "kunden", href: "/admin/kunden", label: "Kunden" },
  { key: "produkte", href: "/admin/products", label: "Produkte & Bilder" },
  { key: "affiliate", href: "/admin/affiliate", label: "Affiliate" },
] as const;

export function AdminNav({ active }: { active: (typeof TABS)[number]["key"] }) {
  return (
    <nav className="mt-4 flex flex-wrap gap-1.5" aria-label="Admin-Bereiche">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={active === t.key ? "page" : undefined}
          className={
            active === t.key
              ? "rounded-full bg-[var(--color-accent)] px-4 py-2 text-[12.5px] font-semibold text-[var(--color-accent-ink)]"
              : "rounded-full border border-white/[0.1] px-4 py-2 text-[12.5px] font-medium text-[var(--color-ink-secondary)] hover:border-white/25"
          }
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

// The affiliate area is five screens. Hanging all five off the main bar would
// double its length for one feature, so they get their own second row —
// visually subordinate (underline, not pill) so it reads as "inside Affiliate"
// rather than "next to Kunden".
const AFF_TABS = [
  { key: "uebersicht", href: "/admin/affiliate", label: "Übersicht" },
  { key: "partner", href: "/admin/affiliate/partner", label: "Partner" },
  { key: "einstellungen", href: "/admin/affiliate/einstellungen", label: "Einstellungen" },
  { key: "codes", href: "/admin/affiliate/codes", label: "Codes" },
  { key: "auszahlungen", href: "/admin/affiliate/auszahlungen", label: "Auszahlungen" },
] as const;

export type AffiliateTabKey = (typeof AFF_TABS)[number]["key"];

export function AffiliateTabs({ active }: { active: AffiliateTabKey }) {
  const [open, setOpen] = useState<number | null>(null);

  // Open payout requests are the one thing in this area that waits on a human,
  // so the count travels with the navigation instead of only living on the
  // payouts screen. Counted from the list rather than from an overview field:
  // the list is the same data the payouts screen acts on, so the badge can
  // never disagree with the table underneath it.
  useEffect(() => {
    let alive = true;
    void (async () => {
      const res = await fetch("/api/admin/affiliate/payouts", { cache: "no-store" }).catch(
        () => null,
      );
      if (!alive || !res?.ok) return;
      const data = (await res.json().catch(() => null)) as {
        payouts?: Array<{ status?: string }>;
      } | null;
      if (!alive || !Array.isArray(data?.payouts)) return;
      setOpen(
        data.payouts.filter((p) => p.status === "requested" || p.status === "approved").length,
      );
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <nav
      className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-white/[0.08]"
      aria-label="Affiliate-Ansichten"
    >
      {AFF_TABS.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={active === t.key ? "page" : undefined}
          className={cn(
            "-mb-px inline-flex items-center gap-1.5 border-b-2 px-0.5 pb-2 pt-1 text-[12.5px]",
            active === t.key
              ? "border-[var(--color-accent)] font-semibold text-[var(--color-ink)]"
              : "border-transparent font-medium text-[var(--color-ink-tertiary)] hover:text-[var(--color-ink-secondary)]",
          )}
        >
          {t.label}
          {t.key === "auszahlungen" && open !== null && open > 0 ? (
            <span className="tnum rounded-full bg-[var(--color-caution)]/20 px-1.5 py-px text-[10px] font-semibold text-[var(--color-caution)]">
              {open}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
