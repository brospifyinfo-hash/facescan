"use client";

import { useT } from "@/lib/i18n";

// Split out of the page so the page itself stays a server component: the
// heading is translated, and translation lives in a client context.
export function SupportHeader() {
  const t = useT();
  return (
    <header>
      <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-[var(--color-ink)]">
        {t.support.title}
      </h1>
      <p className="mt-2.5 text-[14px] leading-relaxed text-[var(--color-ink-secondary)]">
        {t.support.intro}
      </p>
    </header>
  );
}
