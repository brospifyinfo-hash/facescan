"use client";

import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { LOCALES, type Dict, type Locale } from "./types";
import { en } from "./en";
import { de } from "./de";
import { es } from "./es";
import { fr } from "./fr";

export * from "./types";

const DICTS: Record<Locale, Dict> = { en, de, es, fr };

const STORAGE_KEY = "facescan.locale";

function isLocale(v: string): v is Locale {
  return (LOCALES as readonly string[]).includes(v);
}

/**
 * Resolve the browser's preferred language to a supported locale.
 * `navigator.languages` is ordered by preference, so the first supported
 * base tag wins ("de-AT" → "de").
 */
export function detectLocale(): Locale {
  if (typeof navigator === "undefined") return "en";
  const candidates = navigator.languages?.length
    ? navigator.languages
    : [navigator.language];
  for (const tag of candidates) {
    const base = tag.toLowerCase().split("-")[0];
    if (isLocale(base)) return base;
  }
  return "en";
}

interface Ctx {
  locale: Locale;
  t: Dict;
  setLocale: (l: Locale) => void;
}

const I18nContext = createContext<Ctx>({
  locale: "en",
  t: en,
  setLocale: () => {},
});

/**
 * Server render and first client paint both use "en" so hydration matches;
 * the detected locale is applied in an effect immediately after mount.
 * Detecting during render would produce a server/client mismatch.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const next = stored && isLocale(stored) ? stored : detectLocale();
    setLocaleState(next);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<Ctx>(
    () => ({
      locale,
      t: DICTS[locale],
      setLocale: (l) => {
        window.localStorage.setItem(STORAGE_KEY, l);
        setLocaleState(l);
      },
    }),
    [locale],
  );

  return createElement(I18nContext.Provider, { value }, children);
}

export function useI18n() {
  return useContext(I18nContext);
}

/** Shorthand for the active dictionary. */
export function useT(): Dict {
  return useContext(I18nContext).t;
}

/** Replace {placeholders} in a dictionary string. */
export function fill(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, k) =>
    k in vars ? String(vars[k]) : `{${k}}`,
  );
}
