"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Home, Menu, Scan, User, X } from "lucide-react";
import { useT } from "@/lib/i18n";

// Der Menüknopf unten rechts, und die Kreise, die um ihn herum aufgehen.
//
// WARUM EIN VIERTELKREIS UND KEIN VOLLER. Der Knopf sitzt in der Ecke unten
// rechts; unterhalb und rechts von ihm ist kein Bildschirm mehr. Ein Fächer
// über 360° hätte also zwei von drei Zielen außerhalb des sichtbaren
// Bereichs. Die Ziele liegen daher auf dem Bogen von "gerade nach oben"
// (90°) bis "nach links" (180°) — dem einzigen Quadranten, den es in dieser
// Ecke überhaupt gibt, und zugleich dem, den ein Daumen von unten rechts
// erreicht, ohne umzugreifen.
//
// GERECHNET, NICHT GESETZT. Die Positionen kommen aus cos/sin auf einem
// festen Radius, nicht aus drei von Hand eingetippten Offsets. Ein vierter
// Eintrag verteilt sich damit von selbst neu; drei handgesetzte Werte hätten
// beim nächsten Eintrag alle drei falsch gestanden.
//
// Bildschirmkoordinaten laufen nach unten, mathematische nach oben — daher
// das Minus vor dem Sinus. Ohne es fächert das Menü nach unten aus dem Bild.
//
// GLAS IST HIER RICHTIG, anders als im Inhalt: die Regel oben in
// globals.css nennt Liquid Glass das Material der NAVIGATIONSEBENE, und ein
// schwebendes Bedienelement über dem Text ist genau der Fall.
//
// DREI ZIELE, NICHT VIER. Die Analyse fehlt bewusst: /results zeigt nur
// etwas, wenn ein Scan im Speicher liegt, und schickt sonst nach /upload
// weiter. Ein Eintrag, der einen woandershin bringt als er verspricht, ist
// schlechter als kein Eintrag.

/** Abstand der Kreise von der Mitte des Hauptknopfs. */
const RADIUS = 96;
/** Von "gerade nach oben" bis "nach links". */
const FROM_DEG = 90;
const TO_DEG = 180;

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
    // pointerdown statt click: ein Tippen auf etwas darunter soll das Menü
    // schließen und trotzdem durchgehen.
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

  const step = items.length > 1 ? (TO_DEG - FROM_DEG) / (items.length - 1) : 0;

  return (
    // Der Rahmen ist exakt so groß wie der Hauptknopf, damit die Kreise ihn
    // als Mittelpunkt nehmen können: sie sitzen auf 50 % / 50 % und werden
    // von dort aus verschoben.
    <div
      ref={wrap}
      className="fixed bottom-[max(env(safe-area-inset-bottom),18px)] right-5 z-40 h-14 w-14"
    >
      {open
        ? items.map((item, i) => {
            const rad = ((FROM_DEG + i * step) * Math.PI) / 180;
            const dx = Math.cos(rad) * RADIUS;
            const dy = -Math.sin(rad) * RADIUS;
            const active = pathname === item.href;

            return (
              <motion.div
                key={item.href}
                // Startet in der Mitte des Hauptknopfs und fährt heraus —
                // so ist zu sehen, WOHER die Kreise kommen, statt dass sie
                // an drei Stellen erscheinen.
                initial={{ opacity: 0, x: 0, y: 0, scale: 0.4 }}
                animate={{ opacity: 1, x: dx, y: dy, scale: 1 }}
                transition={{
                  duration: 0.28,
                  delay: i * 0.045,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="absolute left-1/2 top-1/2 -ml-[26px] -mt-[26px]"
              >
                <Link
                  href={item.href}
                  aria-label={item.label}
                  title={item.label}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className={`interactive flex h-[52px] w-[52px] items-center justify-center rounded-full border shadow-[0_12px_30px_-10px_rgba(0,0,0,0.8)] backdrop-blur-[30px] backdrop-saturate-150 transition-colors ${
                    active
                      ? "border-[var(--color-accent)]/60 bg-[var(--color-accent)]/[0.16] text-[var(--color-accent)]"
                      : "border-white/[0.13] bg-[rgba(16,22,30,0.82)] text-[var(--color-ink-secondary)] hover:border-white/25 hover:text-[var(--color-ink)]"
                  }`}
                >
                  <item.icon className="h-[21px] w-[21px]" aria-hidden />
                </Link>
              </motion.div>
            );
          })
        : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t.home.menuLabel}
        aria-expanded={open}
        className="interactive relative flex h-14 w-14 items-center justify-center rounded-full border border-white/[0.13] bg-[rgba(16,22,30,0.72)] text-[var(--color-ink)] shadow-[0_14px_34px_-12px_rgba(0,0,0,0.8)] backdrop-blur-[30px] backdrop-saturate-150 hover:border-white/25"
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
