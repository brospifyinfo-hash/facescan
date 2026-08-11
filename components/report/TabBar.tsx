"use client";

import { useEffect, useState } from "react";
import { ChartPie, Home, Lightbulb, Sparkles } from "lucide-react";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/cn";

/**
 * The floating tab bar.
 *
 * IT NAVIGATES THE REPORT, NOT THE APP. The reference's fourth tab is
 * "history", and there is no scan history to show — nothing is stored server
 * side, and the current scan is dropped from memory when the session expires.
 * A tab that opens an empty screen, or worse a "coming soon", is the thing
 * that makes a paid product feel like a demo. The fourth tab is Strengths,
 * which is a section that exists.
 *
 * Each tab scrolls to a real section and the active state is driven by what
 * is actually on screen, so the bar cannot claim a position the page is not
 * in. `scroll-margin-top` on the sections is what keeps a target from landing
 * under the top of the viewport.
 */

export const REPORT_SECTIONS = ["result", "analysis", "strengths", "tips"] as const;
export type ReportSection = (typeof REPORT_SECTIONS)[number];

const ICONS: Record<ReportSection, typeof Home> = {
  result: Home,
  analysis: ChartPie,
  strengths: Sparkles,
  tips: Lightbulb,
};

export function TabBar() {
  const t = useT();
  const [active, setActive] = useState<ReportSection>("result");

  useEffect(() => {
    const nodes = REPORT_SECTIONS.map(
      (id) => [id, document.getElementById(id)] as const,
    ).filter((e): e is [ReportSection, HTMLElement] => e[1] !== null);
    if (nodes.length === 0) return;

    // "The last section whose top has crossed the reading line", plus one
    // rule: at the end of the document, the last section wins outright.
    //
    // THAT SECOND RULE IS NOT DEFENSIVE PADDING. This started as an
    // IntersectionObserver watching a band between 12% and 34% of the
    // viewport, and the Tips tab could never light up — Tips is the last
    // thing on the page, so at maximum scroll its top sits at 425px on an
    // 844px viewport and it is physically unable to enter a band that ends
    // at 287. Any band-based spy has this hole at the bottom of any
    // document; it is only invisible when the last section happens to be
    // tall enough to hide it.
    //
    // Crossing a line also behaves correctly through the long stretch of
    // paid detail between Strengths and Tips, where no section is near the
    // top of the screen: the tab stays on the last one passed instead of
    // going blank.
    const compute = () => {
      const doc = document.documentElement;
      if (window.scrollY + window.innerHeight >= doc.scrollHeight - 2) {
        setActive(nodes[nodes.length - 1][0]);
        return;
      }
      const line = window.innerHeight * 0.28;
      let current = nodes[0][0];
      for (const [id, el] of nodes) {
        if (el.getBoundingClientRect().top <= line) current = id;
      }
      setActive(current);
    };

    // Four getBoundingClientRect calls per scroll event, on elements that are
    // already laid out. Cheap enough not to need rAF coalescing, and reading
    // synchronously means the tab is never a frame behind the content.
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
      style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
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
              <Icon className="h-[18px] w-[18px]" strokeWidth={on ? 2.2 : 1.8} aria-hidden />
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
