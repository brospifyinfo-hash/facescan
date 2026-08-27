"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Menu, Scan, User, X } from "lucide-react";
import { useT } from "@/lib/i18n";

// Der Menüknopf unten rechts — an die Stelle der Leiste, die hier stand.
//
// WAS DIE LEISTE GEKOSTET HAT. Sie lag fest über der ganzen Breite und nahm
// auf jedem Telefon dauerhaft rund achtzig Pixel weg, für vier Ziele, von
// denen die meisten Besucher keines brauchen, solange sie lesen. Ein Knopf
// in einer Ecke kostet eine Ecke und gibt den Rest zurück.
//
// GLAS IST HIER RICHTIG, anders als im Inhalt. Die Regel, die in
// globals.css oben steht — "Liquid Glass ist das Material der
// NAVIGATIONSEBENE, nie der Inhaltsebene" — meint genau so etwas: ein
// schwebendes Bedienelement über dem Text. Deshalb behält es das Material,
// das die Leiste hatte.
//
// DREI ZIELE, NICHT VIER. Die Analyse ist bewusst nicht dabei: /results
// zeigt nur etwas, wenn ein Scan im Speicher liegt, und schickt sonst nach
// /upload weiter. Ein Menüeintrag, der einen woandershin bringt als er
// verspricht, ist schlechter als kein Eintrag.
//
// Reihenfolge wie im Ablauf der App: ankommen, scannen, nachsehen.

export function MenuFab() {
  const t = useT();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  const items = [
    { href: "/", icon: Home, label: t.home.tabs.home },
    { href: "/quiz", icon: Scan, label: t.home.tabs.scan },
    { href: "/konto", icon: User, label: t.home.tabs.profile },
  ];

  // Ein Menü, das nach dem Navigieren offen bleibt, legt sich über die
  // Seite, zu der man gerade wollte.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    // pointerdown statt click: ein Klick auf einen Link darunter soll das
    // Menü schliessen und trotzdem durchgehen.
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  return (
    <div
      ref={wrap}
      className="fixed bottom-[max(env(safe-area-inset-bottom),18px)] right-5 z-40 flex flex-col items-end gap-2.5"
    >
      {open ? (
        <nav
          aria-label={t.home.menuLabel}
          className="min-w-[190px] overflow-hidden rounded-[20px] border border-white/[0.11] bg-[rgba(16,22,30,0.82)] shadow-[0_18px_44px_-16px_rgba(0,0,0,0.75)] backdrop-blur-[30px] backdrop-saturate-150"
        >
          <ul className="flex flex-col p-1.5">
            {items.map((item) => {
              const active = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 rounded-[14px] px-3 py-2.5 text-[13.5px] font-medium transition-colors ${
                      active
                        ? "bg-white/[0.07] text-[var(--color-accent)]"
                        : "text-[var(--color-ink-secondary)] hover:bg-white/[0.05] hover:text-[var(--color-ink)]"
                    }`}
                  >
                    <item.icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t.home.menuLabel}
        aria-expanded={open}
        className="interactive flex h-14 w-14 items-center justify-center rounded-full border border-white/[0.13] bg-[rgba(16,22,30,0.72)] text-[var(--color-ink)] shadow-[0_14px_34px_-12px_rgba(0,0,0,0.8)] backdrop-blur-[30px] backdrop-saturate-150 hover:border-white/25"
      >
        {open ? (
          <X className="h-[22px] w-[22px]" aria-hidden />
        ) : (
          <Menu className="h-[22px] w-[22px]" aria-hidden />
        )}
      </button>
    </div>
  );
}
