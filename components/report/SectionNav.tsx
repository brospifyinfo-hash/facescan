"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/cn";

// The report's floating section navigation — the answer to "everything is
// one endless scroll". A glass pill on the navigation layer (the one place
// glass is allowed) with a chip per chapter: Result, Analysis, Plan, and
// Extras once they exist.
//
// ELEMENTS ARE RESOLVED PER TICK, NEVER CACHED. The sections live behind
// LockedSection wrappers that React replaces wholesale when the customer
// pays, and a cached reference to a replaced subtree measures as all zeros —
// which pinned the old tab bar to "Analysis" forever, exactly for paying
// customers (footgun #4 in the project's history). getElementById on every
// scroll tick is cheap and always current.

export interface NavSection {
  id: string;
  label: string;
}

export function SectionNav({ sections }: { sections: NavSection[] }) {
  const t = useT();
  const [active, setActive] = useState(sections[0]?.id ?? "");
  const frame = useRef(0);

  useEffect(() => {
    const measure = () => {
      frame.current = 0;
      // The active chapter is the LAST one whose top has passed the reading
      // line (a third down the screen reads as "what I am looking at" better
      // than the very top edge does).
      const line = window.innerHeight * 0.33;
      let current = sections[0]?.id ?? "";
      for (const s of sections) {
        const el = document.getElementById(s.id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= line) current = s.id;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (frame.current === 0) frame.current = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame.current !== 0) cancelAnimationFrame(frame.current);
    };
  }, [sections]);

  const go = (id: string) => {
    // Resolved on click, not at mount — see the header.
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActive(id);
  };

  return (
    <nav
      aria-label={t.results.tabsLabel}
      className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4"
    >
      <div className="tabbar pointer-events-auto flex gap-1 rounded-full p-1">
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => go(s.id)}
            aria-current={active === s.id ? "true" : undefined}
            className={cn(
              "interactive whitespace-nowrap rounded-full px-3.5 py-2 text-[12px] font-semibold sm:px-4 sm:text-[13px]",
              active === s.id
                ? "bg-[var(--color-accent)] text-[var(--color-accent-ink)]"
                : "text-[var(--color-ink-secondary)]",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
