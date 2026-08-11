"use client";

import { useEffect, useState } from "react";
import { ChartPie, Home, Lightbulb } from "lucide-react";
import { IconHistory } from "./icons";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/cn";

/**
 * The floating tab bar — Ergebnis, Analyse, Tipps, Verlauf, as the reference
 * sets them.
 *
 * THE FOURTH TAB HAS SOMEWHERE REAL TO GO. There is no scan history in this
 * product and there deliberately never will be one of the usual kind:
 * nothing is stored server-side, and the current scan is dropped from memory
 * when the session expires. So Verlauf opens the record of THIS scan and
 * states that plainly — which is the privacy promise, not a gap in it. A tab
 * that opens an empty screen, or a "coming soon", is what makes a paid
 * product feel like a demo.
 */

export const REPORT_SECTIONS = ["result", "analysis", "tips", "history"] as const;
export type ReportSection = (typeof REPORT_SECTIONS)[number];

const ICONS: Record<ReportSection, (p: { className?: string }) => React.ReactNode> = {
  result: (p) => <Home {...p} />,
  analysis: (p) => <ChartPie {...p} />,
  tips: (p) => <Lightbulb {...p} />,
  history: (p) => <IconHistory {...p} />,
};

export function TabBar() {
  const t = useT();
  const [active, setActive] = useState<ReportSection>("result");

  useEffect(() => {
    // THE ELEMENTS ARE LOOKED UP ON EVERY TICK, NOT CACHED AT MOUNT.
    //
    // Caching them is the obvious optimisation and it is wrong here. Unlocking
    // the report swaps LockedSection's blurred wrapper for a plain one, which
    // replaces the whole subtree — so the cached #analysis node becomes
    // detached. A detached element's getBoundingClientRect() is all zeros, its
    // top reads as 0, it therefore counts as "already crossed the line" at
    // every scroll position, and the tab bar sticks on Analyse forever. That
    // fires the moment a customer pays, which is the worst possible time.
    //
    // Four getElementById calls per scroll event cost nothing measurable.

    // "The last section whose top has crossed the reading line", plus one
    // rule: at the end of the document, the last section wins outright.
    //
    // THAT SECOND RULE IS NOT DEFENSIVE PADDING. This started as an
    // IntersectionObserver watching a band between 12% and 34% of the
    // viewport, and the final tab could never light up — the last section on
    // the page sits at 425px on an 844px viewport at maximum scroll and is
    // physically unable to enter a band that ends at 287. Any band-based spy
    // has this hole at the bottom of any document; it is only invisible when
    // the last section happens to be tall enough to hide it.
    //
    // Crossing a line also behaves correctly through the long stretch of paid
    // detail where no section is near the top of the screen: the tab stays on
    // the last one passed instead of going blank.
    const compute = () => {
      const present = REPORT_SECTIONS.map(
        (id) => [id, document.getElementById(id)] as const,
      ).filter((e): e is [ReportSection, HTMLElement] => e[1] !== null);
      if (present.length === 0) return;

      const doc = document.documentElement;
      if (window.scrollY + window.innerHeight >= doc.scrollHeight - 2) {
        setActive(present[present.length - 1][0]);
        return;
      }
      const line = window.innerHeight * 0.28;
      let current = present[0][0];
      for (const [id, el] of present) {
        if (el.getBoundingClientRect().top <= line) current = id;
      }
      setActive(current);
    };

    // Reading synchronously rather than coalescing into rAF: the work is four
    // lookups and four rects on elements that are already laid out, and it
    // means the tab is never a frame behind the content.
    compute();
    window.addEventListener("scroll", compute, { passive: true });
    window.addEventListener("resize", compute);
    return () => {
      window.removeEventListener("scroll", compute);
      window.removeEventListener("resize", compute);
    };
  }, []);

  const go = (id: ReportSection) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-3"
      style={{ paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}
      aria-label={t.results.tabsLabel}
    >
      <div className="tabbar grid w-full max-w-sm grid-cols-4 gap-1 rounded-[26px] p-1.5">
        {REPORT_SECTIONS.map((id) => {
          const Icon = ICONS[id];
          const on = active === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => go(id)}
              aria-current={on ? "true" : undefined}
              className={cn(
                "flex flex-col items-center gap-1 rounded-[20px] px-1 py-2",
                "transition-colors duration-[180ms] ease-[cubic-bezier(0.32,0.72,0,1)]",
                on
                  ? "bg-[var(--color-accent)]/[0.1] text-[var(--color-accent)]"
                  : "text-[var(--color-ink-tertiary)] active:bg-white/[0.05]",
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
              <span className="truncate text-[10px] font-medium leading-none">
                {t.results.tabs[id]}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
