"use client";

import { BadgeCheck, Lock, MapPin, ShieldCheck } from "lucide-react";
import { PaymentIcons } from "@/components/checkout/PaymentIcons";
import { useT } from "@/lib/i18n";

// Das Vertrauensband.
//
// JEDE ZEILE DARIN IST NACHPRUEFBAR WAHR, und das ist keine Stilfrage,
// sondern die einzige Art, wie so ein Band ueberhaupt wirkt.
//
//   "Zahlung ueber Stripe"        — app/api/stripe/*, die Karte sieht diese
//                                   Seite nie.
//   "Verschluesselte Uebertragung"— HTTPS, erzwungen.
//   "Einmalig, kein Abo"          — lib/pricing.ts kennt keine Wiederholung,
//                                   und der PaymentIntent ist einmalig.
//   "Anbieter in Deutschland"     — lib/legal.ts, dieselbe Quelle wie das
//                                   Impressum.
//
// WAS HIER BEWUSST NICHT STEHT, ist genauso wichtig. Kein Kundenzaehler,
// keine Sterne, kein "Bekannt aus", kein erfundenes Siegel. Das Projekt hat
// diese Linie schon einmal gezogen — der Kommentar in CheckoutModal sagt es
// fuer die Preisauswahl mit denselben Worten — und ein Vertrauensband ist
// die Stelle, an der man am ehesten davon abweicht. Eine Zahl, die niemand
// nachrechnen kann, kostet mehr Vertrauen als sie bringt, sobald sie
// jemandem auffaellt.
//
// Auch NICHT dabei: "14 Tage Widerrufsrecht". Das waere die naheliegendste
// Kachel und sie waere irrefuehrend — bei digitalen Inhalten erlischt das
// Recht mit der sofortigen Ausfuehrung, der der Kunde im Checkout zustimmt
// (§356 Abs. 5 BGB). Ein Versprechen, das der eigene Bezahlvorgang zwei
// Minuten spaeter einschraenkt, ist schlechter als keines.
//
// Die Zahlungsmarken stehen dabei, weil "womit kann ich zahlen" eine der
// ersten Fragen vor einem Kauf ist und ein wiedererkanntes Logo sie
// schneller beantwortet als jeder Satz.

export function TrustStrip({ className = "" }: { className?: string }) {
  const t = useT();

  const items = [
    { icon: ShieldCheck, text: t.landing.trustPayment },
    { icon: Lock, text: t.landing.trustEncrypted },
    { icon: BadgeCheck, text: t.landing.trustOnce },
    { icon: MapPin, text: t.landing.trustGermany },
  ];

  return (
    <div
      className={`rounded-[20px] border border-[var(--color-hairline)] bg-white/[0.02] p-4 sm:p-5 ${className}`}
    >
      <ul className="grid grid-cols-2 gap-x-4 gap-y-3.5 sm:grid-cols-4">
        {items.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-start gap-2">
            <Icon
              className="mt-[1px] h-3.5 w-3.5 shrink-0 text-[var(--color-accent)]"
              aria-hidden
            />
            <span className="text-[11.5px] font-medium leading-snug text-[var(--color-ink-secondary)]">
              {text}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-white/[0.06] pt-4">
        <span className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-quaternary)]">
          {t.landing.paymentLabel}
        </span>
        <PaymentIcons />
      </div>
    </div>
  );
}
