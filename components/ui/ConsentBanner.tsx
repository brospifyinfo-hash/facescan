"use client";

import { useEffect, useState } from "react";
import { Cookie } from "lucide-react";
import { getConsent, setConsent } from "@/lib/consent";
import { useT } from "@/lib/i18n";

/**
 * The cookie banner. Navigation layer, so it wears the sheet material; it
 * appears once, and either answer dismisses it for good. "Essential only"
 * is a full answer, not a nag target — the banner never comes back to ask
 * again, and nothing on the site is worse for declining.
 */
export function ConsentBanner() {
  const t = useT();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // After mount, not during render: SSR has no localStorage, and a banner
    // that flashes on for consented visitors is worse than a delayed one.
    setOpen(getConsent() === "unset");
  }, []);

  if (!open) return null;

  const choose = (value: "all" | "essential") => {
    setConsent(value);
    setOpen(false);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-[70] p-3 sm:p-4">
      <div
        role="dialog"
        aria-label={t.consent.title}
        className="material-sheet mx-auto w-full max-w-xl rounded-[var(--r-card)] p-4 sm:p-5"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.04]">
            <Cookie className="h-4 w-4 text-[var(--color-accent)]" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[13.5px] font-semibold text-[var(--color-ink)]">
              {t.consent.title}
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-ink-secondary)]">
              {t.consent.body}
            </p>
          </div>
        </div>
        <div className="mt-3.5 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            onClick={() => choose("all")}
            className="interactive rounded-full bg-[var(--color-accent)] px-5 py-2.5 text-[13px] font-semibold text-[var(--color-accent-ink)] hover:bg-[var(--color-accent-bright)]"
          >
            {t.consent.accept}
          </button>
          <button
            type="button"
            onClick={() => choose("essential")}
            className="interactive rounded-full border border-white/[0.12] px-5 py-2.5 text-[13px] font-medium text-[var(--color-ink-secondary)] hover:border-white/25"
          >
            {t.consent.essential}
          </button>
        </div>
      </div>
    </div>
  );
}
