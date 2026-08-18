"use client";

import Link from "next/link";
import { CalendarDays, ChevronRight, Crown, Droplet, Eye, Moon, Scissors, Sun, Zap } from "lucide-react";
import { useT } from "@/lib/i18n";

// The daily routine and the upgrade banner.
//
// THE ROUTINE IS GENERAL ADVICE AND IS PRESENTED AS SUCH. It is the same five
// steps for everyone — wash, treat, eye area, hair, overnight — which is true
// of any daily routine and is why it can live on a page that does not know
// who is reading it. The PERSONALISED version is the action plan on the
// report, and the link goes there; this strip is the shape of a day, not a
// prescription derived from a scan the home page has not seen.
//
// The last step's icon is a moon rather than the accent mark, matching the
// reference — the one place on the page where a different colour carries
// meaning, because it is the one step that happens while you sleep.

const STEP_ICONS = [Sun, Droplet, Eye, Scissors, Moon];

export function RoutineStrip() {
  const t = useT();

  return (
    <>
      <section className="border-t border-[var(--color-hairline)] pt-6 sm:pt-7">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--color-ink)] sm:text-[13.5px]">
              <CalendarDays className="h-4 w-4 shrink-0 text-[var(--color-accent)] sm:h-[18px] sm:w-[18px]" aria-hidden />
              {t.home.routine.title}
            </h2>
            <p className="mt-2 max-w-[48ch] text-[12.5px] leading-[1.5] text-[var(--color-ink-secondary)] sm:text-[14px]">
              {t.home.routine.sub}
            </p>
          </div>
          <Link
            href="/results"
            className="interactive flex shrink-0 items-center gap-1 rounded-full border border-white/[0.11] bg-white/[0.04] px-3 py-2 text-[11px] font-medium text-[var(--color-ink-secondary)] sm:text-[12.5px]"
          >
            {t.home.routine.cta}
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>

        {/* Five columns, scrolling sideways on a phone. A wrap would break the
            dashed thread that makes it read as a sequence rather than a list. */}
        <div className="mt-5 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <ol className="relative flex w-max gap-1 sm:w-full sm:justify-between">
            {/* The thread. Behind the marks, inset so it starts and ends at
                the first and last circle rather than at the container edge. */}
            <span
              aria-hidden
              className="absolute left-[14%] right-[14%] top-[26px] border-t border-dashed border-[var(--color-accent)]/30 sm:top-[30px]"
            />
            {t.home.routine.steps.map((step, i) => {
              const Icon = STEP_ICONS[i];
              const last = i === t.home.routine.steps.length - 1;
              return (
                <li key={i} className="relative w-[104px] shrink-0 text-center sm:w-auto sm:flex-1">
                  <span
                    className={`mx-auto flex h-[52px] w-[52px] items-center justify-center rounded-full border sm:h-[60px] sm:w-[60px] ${
                      last
                        ? "border-[#8f7bff]/40 bg-[#8f7bff]/10"
                        : "border-[var(--color-accent)]/35 bg-[var(--color-accent-deep)]/70"
                    }`}
                  >
                    <Icon
                      className={`h-5 w-5 sm:h-6 sm:w-6 ${last ? "text-[#a99bff]" : "text-[var(--color-accent)]"}`}
                      aria-hidden
                    />
                  </span>
                  <p
                    className={`mt-2.5 text-[9.5px] font-bold uppercase tracking-[0.07em] sm:text-[11px] ${
                      last ? "text-[#a99bff]" : "text-[var(--color-accent)]"
                    }`}
                  >
                    {step.phase}
                  </p>
                  <p className="mt-1 text-[11.5px] font-semibold text-[var(--color-ink)] sm:text-[13px]">
                    {step.title}
                  </p>
                  <p className="mt-1 text-[10px] leading-[1.35] text-[var(--color-ink-tertiary)] sm:text-[11.5px]">
                    {step.text}
                  </p>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* ---- Upgrade --------------------------------------------------- */}
      {/* The one conversion banner keeps a thin outline — it is a control-
          sized object asking for a tap, not a content card. */}
      <section className="relative overflow-hidden rounded-[var(--r-card)] border border-white/[0.08] bg-white/[0.02] p-4 sm:p-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          aria-hidden
          src="/strengths-mesh.webp"
          alt=""
          className="pointer-events-none absolute -right-6 -top-4 h-[150%] w-[38%] object-contain opacity-[0.16]"
        />
        <div className="relative flex items-center gap-3.5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[var(--color-accent)]/35 bg-[var(--color-accent-deep)]/70 sm:h-14 sm:w-14">
            <Crown className="h-6 w-6 text-[var(--color-accent)] sm:h-7 sm:w-7" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-bold leading-tight text-[var(--color-ink)] sm:text-[19px]">
              {t.home.upgrade.title}
            </h2>
            <p className="mt-1 max-w-[38ch] text-[11.5px] leading-[1.4] text-[var(--color-ink-secondary)] sm:text-[13.5px]">
              {t.home.upgrade.sub}
            </p>
          </div>
          <Link
            href="/quiz"
            className="interactive hidden shrink-0 items-center gap-1.5 rounded-full bg-[var(--color-accent)] px-4 py-2.5 text-[12px] font-semibold text-[var(--color-accent-ink)] hover:bg-[var(--color-accent-bright)] sm:flex sm:text-[13.5px]"
          >
            {t.home.upgrade.cta}
            <Zap className="h-4 w-4" aria-hidden />
          </Link>
        </div>
        {/* On a phone the button goes full width underneath rather than being
            squeezed to three characters beside the text. */}
        <Link
          href="/quiz"
          className="interactive relative mt-3.5 flex items-center justify-center gap-1.5 rounded-full bg-[var(--color-accent)] py-2.5 text-[12px] font-semibold text-[var(--color-accent-ink)] hover:bg-[var(--color-accent-bright)] sm:hidden"
        >
          {t.home.upgrade.cta}
          <Zap className="h-4 w-4" aria-hidden />
        </Link>
      </section>
    </>
  );
}
