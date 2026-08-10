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
  ScanFace,
  ShieldCheck,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { DevUnlock } from "@/components/ui/DevUnlock";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { HeroMesh } from "@/components/landing/HeroMesh";
import { ReviewsSection } from "@/components/landing/ReviewsSection";
import { CATEGORY_ORDER } from "@/lib/metrics";
import { METRIC_ORDER, SPECS } from "@/lib/specs";
import { useI18n, useT } from "@/lib/i18n";
import { visionPrivacy } from "@/lib/i18n/privacy";
import { useFunnel } from "@/lib/store";

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
import { cn } from "@/lib/cn";

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
        <span className="font-mono-terminal text-[11px] tabular-nums text-accent">
          {index}
        </span>
        <span className="font-mono-terminal text-[10px] uppercase tracking-[0.22em] text-[var(--color-ink-tertiary)]">
          {eyebrow}
        </span>
      </div>
      <h2 className="mt-4 max-w-2xl text-[26px] font-semibold leading-[1.15] tracking-tight sm:text-[34px]">
        {title}
      </h2>
      {sub ? (
        <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-[var(--color-ink-secondary)]">
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
        <span className="font-mono-terminal text-[10px] tabular-nums text-[var(--color-ink-tertiary)]">
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

export default function LandingPage() {
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

  return (
    <main className="flex min-h-dvh flex-col">
      {/* ---------------- Nav ---------------- */}
      <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[var(--color-canvas)]/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-5 py-3.5 sm:px-8">
          <DevUnlock>
            <span className="flex items-center gap-2.5">
              <ScanFace className="h-[18px] w-[18px] text-accent" />
              <span className="text-[13px] font-semibold tracking-[0.16em]">
                FACESCAN
              </span>
            </span>
          </DevUnlock>
          <div className="flex items-center gap-4">
            <a
              href="#method"
              className="hidden text-[13px] text-[var(--color-ink-secondary)] transition-colors hover:text-[var(--color-ink)] sm:block"
            >
              {t.nav.howItWorks}
            </a>
            <LanguageSwitcher />
          </div>
        </div>
      </header>

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

      <div className="mx-auto w-full max-w-4xl px-5 sm:px-8">
        {/* ---------------- Hero ---------------- */}
        <section className="grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center gap-2.5 font-mono-terminal text-[10px] uppercase tracking-[0.2em] text-[var(--color-ink-tertiary)]">
              <span className="h-px w-6 bg-accent" />
              {t.landing.badge}
            </div>

            <h1 className="mt-6 text-[2.7rem] font-semibold leading-[1.02] tracking-[-0.02em] sm:text-[4rem]">
              {t.landing.headline}{" "}
              <span className="text-accent">{t.landing.headlineAccent}</span>
            </h1>

            <p className="mt-6 max-w-md text-[16px] leading-relaxed text-[var(--color-ink-secondary)]">
              {t.landing.sub}
            </p>

            <div className="mt-9 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <Link href="/quiz" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto">
                  {t.landing.cta} <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <p className="text-[12px] leading-snug text-[var(--color-ink-tertiary)]">
                {t.landing.ctaNote}
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="relative mx-auto w-full max-w-[340px]"
          >
            <div className="rounded-2xl border border-white/[0.09] bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent)] p-3">
              <HeroMesh className="aspect-square w-full" />
              <div className="flex items-center justify-between border-t border-white/[0.07] px-1 pt-2.5 font-mono-terminal text-[9px] uppercase tracking-[0.14em] text-[var(--color-ink-tertiary)]">
                <span>MediaPipe FaceLandmarker</span>
                <span className="tabular-nums text-accent">478</span>
              </div>
            </div>
          </motion.div>
        </section>

        {/* ---------------- Trust ---------------- */}
        <section className="grid gap-px overflow-hidden rounded-2xl border border-white/[0.09] bg-white/[0.06] sm:grid-cols-3">
          {t.landing.trust.map((item, i) => {
            const Icon = TRUST_ICONS[i];
            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: i * 0.08 }}
                className="bg-[var(--color-canvas)] p-5"
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
                    <span className="font-mono-terminal text-[10px] tabular-nums text-[var(--color-ink-tertiary)]">
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

          <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-white/[0.09] bg-white/[0.06] sm:grid-cols-2 lg:grid-cols-4">
            {t.landing.steps.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: i * 0.06 }}
                className="bg-[var(--color-canvas)] p-5"
              >
                <span className="font-mono-terminal text-[10px] tabular-nums text-accent">
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

          <ul className="mt-9 grid gap-px overflow-hidden rounded-2xl border border-white/[0.09] bg-white/[0.06] sm:grid-cols-3">
            {(priv?.points ?? t.landing.privacyPoints).map((p, i) => (
              <motion.li
                key={p}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: i * 0.07 }}
                className="bg-[var(--color-canvas)] p-5 text-[12px] leading-relaxed text-[var(--color-ink-secondary)]"
              >
                <span className="font-mono-terminal mb-2.5 block text-[10px] tabular-nums text-accent">
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
      <footer className="border-t border-white/[0.07] py-9">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-5 sm:px-8">
          <div className="flex items-center gap-2.5">
            <ScanFace className="h-3.5 w-3.5 text-accent" />
            <span className="text-[10px] font-semibold tracking-[0.16em] text-[var(--color-ink-tertiary)]">
              FACESCAN
            </span>
          </div>
          <p className="max-w-2xl text-[11px] leading-relaxed text-[var(--color-ink-tertiary)]">
            {t.landing.disclaimer}
          </p>
          <div className={cn("flex gap-5 text-[11px] text-[var(--color-ink-tertiary)]")}>
            <span>{t.landing.imprint}</span>
            <span>{t.landing.privacyLink}</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
