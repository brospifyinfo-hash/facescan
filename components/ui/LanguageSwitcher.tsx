"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Globe } from "lucide-react";
import {
  LOCALES,
  LOCALE_FLAGS,
  LOCALE_NAMES,
  useI18n,
  type Locale,
} from "@/lib/i18n";
import { cn } from "@/lib/cn";

/**
 * The page already follows the browser's language automatically; this is the
 * manual override, and the choice is remembered in localStorage.
 */
export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t.nav.language}
        aria-expanded={open}
        className="glass flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-medium text-zinc-300 transition-colors hover:text-zinc-50"
      >
        <Globe className="h-3.5 w-3.5" />
        <span className="uppercase tracking-wider">{locale}</span>
      </button>

      {open ? (
        <div className="glass-strong absolute right-0 top-full z-50 mt-2 w-44 overflow-hidden rounded-2xl p-1.5">
          {LOCALES.map((l: Locale) => (
            <button
              key={l}
              type="button"
              onClick={() => {
                setLocale(l);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] transition-colors",
                l === locale
                  ? "bg-white/10 text-zinc-50"
                  : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100",
              )}
            >
              <span aria-hidden>{LOCALE_FLAGS[l]}</span>
              <span className="flex-1">{LOCALE_NAMES[l]}</span>
              {l === locale ? <Check className="h-3.5 w-3.5 text-accent" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
