"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Home, Menu, Scan, Star, User, X } from "lucide-react";
import { useT } from "@/lib/i18n";

// Der Menüknopf unten rechts, und die Kreise, die im Bogen um ihn aufgehen.
//
// WARUM EIN VIERTELKREIS UND KEIN VOLLER. Der Knopf sitzt in der Ecke unten
// rechts; unter ihm und rechts von ihm ist kein Bildschirm mehr. Über 360°
// verteilt lägen drei von vier Zielen außerhalb des Bildes. Der Bogen geht
// deshalb von "gerade nach oben" bis "nach links" — der einzige Quadrant,
// den es in dieser Ecke gibt, und zugleich der, den ein Daumen von unten
// rechts erreicht, ohne umzugreifen.
//
// GERECHNET, NICHT GESETZT. Die Positionen kommen aus cos/sin auf festem
// Radius, nicht aus von Hand eingetippten Offsets. Als der vierte Eintrag
// dazukam, hat sich der Fächer von selbst neu verteilt; vier feste Werte
// hätten alle vier falsch gestanden. Der Radius musste dabei mitwachsen —
// bei vier Zielen im selben Bogen liegen die Kreise sonst aufeinander (die
// Sehne zwischen zwei Nachbarn ist 2·R·sin(halber Winkel), und die war bei
// 96px kleiner als ein Kreis breit ist).
//
// Bildschirmkoordinaten laufen nach unten, mathematische nach oben — daher
// das Minus vor dem Sinus. Ohne es fächert das Menü nach unten aus dem Bild.
//
// GLAS IST HIER RICHTIG, anders als im Inhalt: die Regel oben in
// globals.css nennt Liquid Glass das Material der NAVIGATIONSEBENE, und ein
// schwebendes Bedienelement über dem Text ist genau der Fall.
//
// WO ES NICHT ERSCHEINT, und warum das kein Widerspruch zu "überall" ist:
//
//   /results    — trägt seine eigene schwebende Kapitelnavigation, mittig
//                 unten auf derselben Ebene. Zwei Bedienelemente, die um
//                 dieselbe Bildschirmkante streiten, sind schlechter als
//                 eines.
//   /scan       — die Kamera läuft im Vollbild; ein Menü darüber ist im Weg,
//   /calibrate    genau während man stillhalten soll.
//   /admin/*    — Betreiberwerkzeuge, kein Kundenweg.
//
// Überall sonst steht es: Startseite, Scan, Konto, Partner, Support und die
// Rechtsseiten.

/** Abstand der Kreise von der Mitte des Hauptknopfs. */
const RADIUS = 126;
/** Durchmesser eines Zielkreises. */
const DOT = 50;
/** Von "gerade nach oben" bis "nach links". */
const FROM_DEG = 90;
const TO_DEG = 180;

/** Das Gold des Partnerprogramms — dieselbe Farbe wie im Widerrufs-Betreff. */
const GOLD = "#f5b544";

/** Pfade, die ihre untere Bildschirmkante selbst brauchen. */
const HIDDEN = ["/results", "/scan", "/calibrate"];

export function MenuFab() {
  const t = useT();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  const items = [
    { href: "/", icon: Home, label: t.home.tabs.home, gold: false },
    { href: "/upload", icon: Scan, label: t.home.tabs.scan, gold: false },
    { href: "/konto", icon: User, label: t.home.tabs.profile, gold: false },
    // Der Stern in Gold. Das Partnerprogramm ist der einzige Eintrag, der
    // etwas anderes anbietet als die eigene Analyse — er darf sich von den
    // drei Wegen durch das Produkt abheben, und ein Stern ist die
    // Auszeichnung, die man ohne Beschriftung liest.
    { href: "/partner", icon: Star, label: t.partner.title, gold: true },
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

  if (HIDDEN.includes(pathname) || pathname.startsWith("/admin")) return null;

  const step = items.length > 1 ? (TO_DEG - FROM_DEG) / (items.length - 1) : 0;
  const half = DOT / 2;

  return (
    // Der Rahmen ist exakt so groß wie der Hauptknopf, damit die Kreise ihn
    // als Mittelpunkt nehmen können.
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
                // Startet in der Mitte des Hauptknopfs und fährt heraus — so
                // ist zu sehen, WOHER die Kreise kommen, statt dass sie an
                // vier Stellen erscheinen. x und y bleiben reine Zahlen:
                // framer-motion animiert calc() darin nicht verlässlich, und
                // ein Fächer, der auf halbem Weg hängenbleibt, wäre
                // schlimmer als gar keiner. Zentriert wird deshalb über die
                // negativen Margins unten.
                initial={{ opacity: 0, x: 0, y: 0, scale: 0.4 }}
                animate={{ opacity: 1, x: dx, y: dy, scale: 1 }}
                transition={{
                  duration: 0.28,
                  delay: i * 0.04,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="absolute left-1/2 top-1/2"
                style={{ marginLeft: -half, marginTop: -half }}
              >
                <Link
                  href={item.href}
                  aria-label={item.label}
                  title={item.label}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className="interactive flex items-center justify-center rounded-full border shadow-[0_12px_30px_-10px_rgba(0,0,0,0.8)] backdrop-blur-[30px] backdrop-saturate-150 transition-colors"
                  style={{
                    height: DOT,
                    width: DOT,
                    // Inline, weil Gold keine Token-Farbe dieses Themas ist
                    // und eine einmalige Marke keine neue Variable
                    // rechtfertigt.
                    color: item.gold
                      ? GOLD
                      : active
                        ? "var(--color-accent)"
                        : "var(--color-ink-secondary)",
                    borderColor: item.gold
                      ? `${GOLD}66`
                      : active
                        ? "rgba(95,227,138,0.6)"
                        : "rgba(255,255,255,0.13)",
                    background:
                      item.gold && active
                        ? `${GOLD}26`
                        : active
                          ? "rgba(95,227,138,0.16)"
                          : "rgba(16,22,30,0.82)",
                  }}
                >
                  <item.icon
                    className="h-5 w-5"
                    // Der Stern wird gefüllt, nicht nur umrissen: eine
                    // Auszeichnung, die nur als Kontur dasteht, liest sich
                    // wie ein Lesezeichen, das noch nicht gesetzt ist.
                    fill={item.gold ? GOLD : "none"}
                    aria-hidden
                  />
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
