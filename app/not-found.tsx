import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/lib/seo";

// A real 404.
//
// Next ships a default one, and it is a bare "404 | This page could not be
// found" on white — which on a dark site reads as a broken deploy rather
// than a missing page. It also matters for crawling: a soft or ugly 404 is
// where crawl budget goes to die, and every mistyped or expired link (a
// stale /results, an old share) lands here. The status code is already 404;
// this gives it a way back into the funnel instead of a dead end.

export const metadata: Metadata = {
  title: "Seite nicht gefunden",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <span className="font-mono-terminal text-[12px] uppercase tracking-[0.28em] text-[var(--color-ink-tertiary)]">
        404
      </span>
      <h1 className="mt-5 max-w-md text-[26px] font-bold leading-[1.15] tracking-[-0.025em] sm:text-[34px]">
        Diese Seite gibt es nicht{" "}
        <span className="text-[var(--color-accent)]">(mehr).</span>
      </h1>
      <p className="mt-3 max-w-sm text-[13px] leading-relaxed text-[var(--color-ink-tertiary)]">
        Vielleicht ist der Link alt, oder eine Analyse ist abgelaufen — Scans leben
        nur im Speicher deines Tabs. Starte einfach neu, das dauert keine Minute.
      </p>

      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
        <Link
          href="/quiz"
          className="rounded-full bg-[var(--color-accent)] px-6 py-3 text-[13px] font-semibold text-[#05080d] transition-opacity hover:opacity-90"
        >
          Analyse starten
        </Link>
        <Link
          href="/"
          className="px-6 py-3 text-[13px] font-medium text-[var(--color-ink-secondary)] transition-colors hover:text-[var(--color-ink)]"
        >
          Zurück zu {BRAND}
        </Link>
      </div>
    </main>
  );
}
