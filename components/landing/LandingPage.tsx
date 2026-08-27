"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  Cpu,
  Lock,
  Minus,
  Plus,
  ShieldCheck,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { DevUnlock } from "@/components/ui/DevUnlock";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { AccountLink } from "@/components/ui/AccountLink";
import { HeroMesh } from "@/components/landing/HeroMesh";
import { ReviewsSection } from "@/components/landing/ReviewsSection";
import { CATEGORY_ORDER } from "@/lib/metrics";
import { METRIC_ORDER, SPECS } from "@/lib/specs";
import { useI18n, useT } from "@/lib/i18n";
import { visionPrivacy } from "@/lib/i18n/privacy";
import { useFunnel } from "@/lib/store";
import { AppHome } from "@/components/home/AppHome";
import { Logo } from "@/components/ui/Logo";
import { MenuFab } from "@/components/home/MenuFab";
import { BRAND } from "@/lib/seo";

/**
 * Positions of the two photo-related items in the dictionaries.
 *
 * Both arrays are parallel across every locale, so one index works for all
 * four. Named rather than inlined because the coupling is invisible
 * otherwise: reorder `steps` or `faq` in a dictionary and the vision-mode
 * privacy wording silently lands on the wrong entry.
 */
const PHOTO_TRUST_INDEX = 0;
const PHOTO_STEP_INDEX = 1;
const PHOTO_SCAN_STEP_INDEX = 2;
const PHOTO_FAQ_INDEX = 2;

const TRUST_ICONS = [ShieldCheck, Cpu, Lock];

/** Consistent rhythm: hairline rule, small caps eyebrow, editorial heading. */
function SectionHead({
  index,
  eyebrow,
  title,
  sub,
}: {
  index: string;
  eyebrow: string;
  title: string;
  sub?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="border-t border-white/[0.09] pt-6"
    >
      <div className="flex items-baseline gap-4">
        {/* The index is a counter, not an action, so it is no longer tinted.
            The accent marks primary actions only — spending it on section
            numbers is what left the actual buttons with nothing. */}
        <span className="font-mono-terminal tnum t-caption text-[var(--color-ink-quaternary)]">
          {index}
        </span>
        <span className="t-eyebrow">{eyebrow}</span>
      </div>
      <h2 className="t-title1 mt-4 max-w-2xl">{title}</h2>
      {sub ? (
        <p className="t-callout mt-3 max-w-xl text-[var(--color-ink-secondary)]">
          {sub}
        </p>
      ) : null}
    </motion.div>
  );
}

function Faq({ q, a, index }: { q: string; a: string; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/[0.07]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-5 py-4 text-left"
      >
        <span className="font-mono-terminal t-caption tabular-nums text-[var(--color-ink-tertiary)]">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="flex-1 text-[14px] font-medium text-[var(--color-ink)]">{q}</span>
        <span className="text-[var(--color-ink-tertiary)]">
          {open ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <p className="max-w-2xl pb-5 pl-[3.1rem] text-[13px] leading-relaxed text-[var(--color-ink-secondary)]">
              {a}
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function LandingPage() {
  const t = useT();
  const { locale } = useI18n();
  // Null on the on-device engine, where the dictionaries' stronger claim is
  // simply true. Non-null once the free scan uploads, and then it replaces
  // every string that would otherwise assert the photo stays local.
  const priv = visionPrivacy(locale);
  const expiredNotice = useFunnel((s) => s.expiredNotice);
  const clearExpiredNotice = useFunnel((s) => s.clearExpiredNotice);

  const categoryLabel = {
    eyes: t.results.eyes,
    jaw: t.results.jaw,
    proportions: t.results.ratios,
    midface: t.results.midface,
  } as const;

  // Der Platz unten hielt die feste Leiste frei. Die ist weg, der Menueknopf
  // schwebt jetzt in der Ecke — freigehalten wird aber weiter, sonst deckt er
  // beim Herunterscrollen die letzte Zeile des Footers zu. Ein Knopf, der die
  // Zeile verdeckt, nach der jemand gerade sucht, ist schlimmer als etwas Luft.
  return (
    <main className="flex min-h-dvh flex-col pb-[88px]">
      {/* ---------------- App home ----------------
          The reference screen: header, hero, statistics, last scan, quick
          links, tip. A phone column on a phone; from lg the sections take
          their places on a widget board — tiles on a strict grid, the way
          the home screen the design quotes actually lays out on a bigger
          canvas. AppHome itself declares the spans. */}
      <div className="mx-auto w-full max-w-md px-4 pt-4 sm:max-w-2xl sm:px-6 sm:pt-7 lg:max-w-5xl lg:px-8">
        <AppHome />
      </div>

      {expiredNotice ? (
        <div className="mx-auto mt-4 w-full max-w-4xl px-5 sm:px-8">
          <div className="flex items-start justify-between gap-4 rounded-xl border border-white/[0.09] bg-white/[0.02] p-4 text-[13px] text-[var(--color-ink-secondary)]">
            <p>{t.landing.expired}</p>
            <button onClick={clearExpiredNotice} aria-label="Dismiss">
              <X className="h-4 w-4 text-[var(--color-ink-tertiary)] hover:text-[var(--color-ink)]" />
            </button>
          </div>
        </div>
      ) : null}

      {/* ---------------- The sales page, kept ----------------
          Everything below is what explains and prices the product. The brief
          was to rebuild the home screen, not to delete the page that sells
          it, so it now lives under the app view and the anchors still work. */}
      <div className="mx-auto w-full max-w-4xl px-5 pt-16 sm:px-8">
        {/* ---------------- Trust ---------------- */}
        <section className="grid gap-8 sm:grid-cols-3 sm:gap-10">
          {t.landing.trust.map((item, i) => {
            const Icon = TRUST_ICONS[i];
            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: i * 0.08 }}
              >
                <Icon className="h-4 w-4 text-accent" />
                <h3 className="mt-3.5 text-[13px] font-semibold">
                  {priv && i === PHOTO_TRUST_INDEX ? priv.trustTitle : item.title}
                </h3>
                <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--color-ink-tertiary)]">
                  {priv && i === PHOTO_TRUST_INDEX ? priv.trustText : item.text}
                </p>
              </motion.div>
            );
          })}
        </section>
        {/* ---------------- What gets measured ---------------- */}
        <section className="pt-20">
          <SectionHead
            index="01"
            eyebrow="Instrumentation"
            title={t.landing.measuredTitle}
            sub={t.landing.measuredSub}
          />

          <div className="mt-10 divide-y divide-white/[0.07] border-y border-white/[0.07]">
            {CATEGORY_ORDER.map((cat, ci) => {
              const ids = METRIC_ORDER.filter((id) => SPECS[id].category === cat);
              return (
                <motion.div
                  key={cat}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.45, delay: ci * 0.06 }}
                  className="grid gap-2 py-4 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-6"
                >
                  <div className="flex items-baseline gap-2">
                    <span className="text-[13px] font-semibold text-[var(--color-ink)]">
                      {categoryLabel[cat]}
                    </span>
                    <span className="font-mono-terminal t-caption tabular-nums text-[var(--color-ink-tertiary)]">
                      {String(ids.length).padStart(2, "0")}
                    </span>
                  </div>
                  <p className="text-[13px] leading-relaxed text-[var(--color-ink-tertiary)]">
                    {ids.map((id, i) => (
                      <span key={id}>
                        {i > 0 ? <span className="text-[var(--color-ink-quaternary)]"> · </span> : null}
                        {t.metrics[id].label}
                      </span>
                    ))}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* ---------------- Method ---------------- */}
        <section id="method" className="pt-20">
          <SectionHead index="02" eyebrow="Method" title={t.landing.stepsTitle} />

          <div className="mt-10 grid gap-8 sm:grid-cols-2 sm:gap-10 lg:grid-cols-4">
            {t.landing.steps.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: i * 0.06 }}
              >
                <span className="font-mono-terminal t-caption tabular-nums text-accent">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-2.5 text-[13px] font-semibold">
                  {priv && i === PHOTO_SCAN_STEP_INDEX ? priv.scanStepTitle : step.title}
                </h3>
                <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--color-ink-tertiary)]">
                  {priv && i === PHOTO_STEP_INDEX
                    ? priv.step
                    : priv && i === PHOTO_SCAN_STEP_INDEX
                      ? priv.scanStepText
                      : step.text}
                </p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ---------------- Privacy ---------------- */}
        <section className="pt-20">
          <SectionHead
            index="03"
            eyebrow="Data"
            title={priv?.title ?? t.landing.privacyTitle}
            sub={priv?.body ?? t.landing.privacyBody}
          />

          <ul className="mt-9 grid gap-8 sm:grid-cols-3 sm:gap-10">
            {(priv?.points ?? t.landing.privacyPoints).map((p, i) => (
              <motion.li
                key={p}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: i * 0.07 }}
                className="text-[12px] leading-relaxed text-[var(--color-ink-secondary)]"
              >
                <span className="font-mono-terminal mb-2.5 block t-caption tabular-nums text-accent">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {p}
              </motion.li>
            ))}
          </ul>
        </section>

        {/* ---------------- FAQ ---------------- */}
        <section className="pt-20">
          <SectionHead index="04" eyebrow="FAQ" title={t.landing.faqTitle} />
          <div className="mt-8 border-t border-white/[0.07]">
            {t.landing.faq.map((item, i) => (
              <Faq
                key={item.q}
                q={item.q}
                a={priv && i === PHOTO_FAQ_INDEX ? priv.faq : item.a}
                index={i}
              />
            ))}
          </div>
        </section>

        <ReviewsSection />

        {/* ---------------- Closing CTA ---------------- */}
        <section className="py-20">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-start justify-between gap-6 border-y border-white/[0.09] py-10 sm:flex-row sm:items-center"
          >
            <div>
              <h2 className="text-[24px] font-semibold tracking-tight sm:text-[30px]">
                {t.landing.headline} {t.landing.headlineAccent}
              </h2>
              <p className="mt-2 text-[13px] text-[var(--color-ink-tertiary)]">{t.landing.ctaNote}</p>
            </div>
            <Link href="/quiz" className="shrink-0">
              <Button size="lg">
                {t.landing.ctaFinal} <ArrowUpRight className="h-4 w-4" />
              </Button>
            </Link>
          </motion.div>
        </section>
      </div>

      {/* ---------------- Footer ---------------- */}
      {/*
          ZWEI SPALTEN, WEIL ES SIEBEN LINKS GEWORDEN SIND.

          Vorher lagen sie alle in EINER flex-Reihe. Mit drei Eintraegen ging
          das; seit die vier Pflichtseiten dazugekommen sind, brach die Reihe
          auf dem Telefon um und ergab einen Absatz aus Linktexten, in dem
          nichts mehr zusammengehoerte. Sieben gleichrangige Woerter sind
          keine Navigation, sondern eine Aufzaehlung.

          Gruppiert statt nur umbrochen: was man aus rechtlichen Gruenden
          sucht, steht links, was man aus eigenem Antrieb sucht, rechts. Die
          Ueberschriften machen die Spalten lesbar, statt sie nur zu setzen.
      */}
      <footer className="border-t border-white/[0.07] py-10">
        <div className="mx-auto w-full max-w-4xl px-5 sm:px-8">
          <Logo height={22} className="opacity-70" />
          <p className="mt-5 max-w-2xl text-[11px] leading-relaxed text-[var(--color-ink-tertiary)]">
            {t.landing.disclaimer}
          </p>

          <nav className="mt-8 grid grid-cols-2 gap-x-8 gap-y-7 sm:max-w-lg">
            {[
              {
                heading: t.landing.legalGroup,
                links: [
                  { href: "/impressum", label: t.landing.imprint },
                  { href: "/privacy", label: t.landing.privacyLink },
                  { href: "/terms", label: t.landing.termsLink },
                  { href: "/withdrawal", label: t.landing.withdrawalLink },
                ],
              },
              {
                heading: t.landing.serviceGroup,
                links: [
                  { href: "/support", label: t.landing.supportLink },
                  // Die einzige Tuer zum Partnerprogramm fuer jemanden, der
                  // nicht angemeldet ist. Ohne sie gibt es die Seite und
                  // niemand kommt hin.
                  { href: "/partner", label: t.partner.title },
                ],
              },
            ].map((column) => (
              <div key={column.heading} className="flex flex-col gap-3">
                <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-quaternary)]">
                  {column.heading}
                </h2>
                <ul className="flex flex-col gap-2.5">
                  {column.links.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className="text-[12px] text-[var(--color-ink-tertiary)] transition-colors hover:text-[var(--color-ink)]"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          {/* Wer hier verkauft, steht am Fuss der Seite und nicht nur im
              Impressum. Das ist die Zeile, nach der jemand sucht, der wissen
              will, mit wem er es zu tun hat — und ein Shop ohne sie sieht aus
              wie einer, der die Frage lieber nicht beantwortet.

              OHNE JAHRESZAHL, absichtlich. new Date() in einer Komponente,
              die serverseitig UND im Browser rendert, faellt zum
              Jahreswechsel stundenlang auseinander (Server in UTC, Besucher
              in seiner Zone) und produziert einen Hydrierungsfehler fuer
              etwas, das niemand liest. Ein Rechtevermerk braucht die Zahl
              nicht. */}
          <div className="mt-9 flex flex-col gap-3 border-t border-white/[0.05] pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] text-[var(--color-ink-quaternary)]">
              © {BRAND} · {t.landing.rights}
            </p>
            <a
              href="/admin/products"
              className="shrink-0 text-[11px] text-[var(--color-ink-quaternary)] transition-colors hover:text-[var(--color-ink-secondary)]"
            >
              {t.navAdmin}
            </a>
          </div>
        </div>
      </footer>
      <MenuFab />
    </main>
  );
}
