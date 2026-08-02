"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  ChevronDown,
  Cpu,
  Lock,
  ScanFace,
  ShieldCheck,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { DevUnlock } from "@/components/ui/DevUnlock";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { HeroMesh } from "@/components/landing/HeroMesh";
import { ReviewsSection } from "@/components/landing/ReviewsSection";
import { CATEGORY_EMOJI, CATEGORY_ORDER, METRIC_EMOJI } from "@/lib/metrics";
import { METRIC_ORDER, SPECS } from "@/lib/specs";
import { formatPrice } from "@/lib/pricing";
import { useI18n, useT } from "@/lib/i18n";
import { useFunnel } from "@/lib/store";
import { cn } from "@/lib/cn";

const TRUST_ICONS = [ShieldCheck, Cpu, BadgeCheck];

/** Section shell with a consistent rhythm across the page. */
function Section({
  id,
  eyebrow,
  title,
  sub,
  children,
  className,
}: {
  id?: string;
  eyebrow?: string;
  title?: string;
  sub?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("mx-auto w-full max-w-5xl px-5 sm:px-6", className)}>
      {title ? (
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-2xl text-center"
        >
          {eyebrow ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            {title}
          </h2>
          {sub ? (
            <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-zinc-400">
              {sub}
            </p>
          ) : null}
        </motion.div>
      ) : null}
      {children}
    </section>
  );
}

function Faq({ q, a, index }: { q: string; a: string; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.45, delay: index * 0.05 }}
      className="glass overflow-hidden rounded-2xl"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-white/[0.03]"
      >
        <span className="flex-1 text-[14px] font-medium text-zinc-100">{q}</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.25 }}
          className="text-zinc-500"
        >
          <ChevronDown className="h-4 w-4" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <p className="px-5 pb-5 text-[13px] leading-relaxed text-zinc-400">{a}</p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}

export default function LandingPage() {
  const t = useT();
  const { locale } = useI18n();
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
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-zinc-950/70 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-3.5 sm:px-6">
          <DevUnlock>
            <span className="flex items-center gap-2">
              <ScanFace className="h-5 w-5 text-accent" />
              <span className="text-[13px] font-semibold tracking-[0.18em]">
                FACESCAN
              </span>
            </span>
          </DevUnlock>
          <div className="flex items-center gap-3">
            <a
              href="#how"
              className="hidden text-[13px] text-zinc-400 transition-colors hover:text-zinc-100 sm:block"
            >
              {t.nav.howItWorks}
            </a>
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      {expiredNotice ? (
        <div className="mx-auto mt-4 w-full max-w-2xl px-5 sm:px-6">
          <div className="glass flex items-start justify-between gap-4 rounded-2xl p-4 text-[13px] text-zinc-300">
            <p>{t.landing.expired}</p>
            <button
              onClick={clearExpiredNotice}
              aria-label="Dismiss"
              className="text-zinc-500 hover:text-zinc-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}

      {/* ---------------- Hero ---------------- */}
      <Section className="pb-20 pt-12 sm:pt-20">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
            className="text-center lg:text-left"
          >
            <span className="glass inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-medium text-zinc-400">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
              </span>
              {t.landing.badge}
            </span>

            <h1 className="mt-7 text-[2.6rem] font-semibold leading-[1.04] tracking-tight sm:text-6xl">
              {t.landing.headline}{" "}
              <span className="text-accent">{t.landing.headlineAccent}</span>
            </h1>

            <p className="mx-auto mt-5 max-w-lg text-[16px] leading-relaxed text-zinc-400 lg:mx-0">
              {t.landing.sub}
            </p>

            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <Link href="/quiz" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto">
                  {t.landing.cta} <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <a href="#pricing" className="w-full sm:w-auto">
                <Button variant="outline" size="lg" className="w-full sm:w-auto">
                  {formatPrice(locale)}
                </Button>
              </a>
            </div>

            <p className="mt-4 text-[12px] text-zinc-500">{t.landing.ctaNote}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="glass relative mx-auto w-full max-w-[380px] rounded-[32px] p-4"
          >
            <HeroMesh className="aspect-square w-full" />
            <div className="absolute inset-x-0 bottom-5 flex justify-center">
              <span className="rounded-full bg-zinc-950/70 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-400 backdrop-blur-sm">
                478 · MediaPipe FaceLandmarker
              </span>
            </div>
          </motion.div>
        </div>

        {/* Trust row — every claim here is implemented, not asserted */}
        <div className="mt-16 grid gap-3 sm:grid-cols-3">
          {t.landing.trust.map((item, i) => {
            const Icon = TRUST_ICONS[i];
            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="glass glass-interactive rounded-2xl p-5 text-left"
              >
                <Icon className="h-4.5 w-4.5 text-accent" />
                <h3 className="mt-3.5 text-[13px] font-semibold">{item.title}</h3>
                <p className="mt-1.5 text-[12px] leading-relaxed text-zinc-500">
                  {item.text}
                </p>
              </motion.div>
            );
          })}
        </div>
      </Section>

      {/* ---------------- What gets measured ---------------- */}
      <Section
        eyebrow="15 ×"
        title={t.landing.measuredTitle}
        sub={t.landing.measuredSub}
        className="pb-20"
      >
        <div className="mt-10 grid gap-3 sm:grid-cols-2">
          {CATEGORY_ORDER.map((cat, ci) => {
            const ids = METRIC_ORDER.filter((id) => SPECS[id].category === cat);
            return (
              <motion.div
                key={cat}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: ci * 0.07 }}
                className="glass rounded-2xl p-5"
              >
                <h3 className="flex items-center gap-2 text-[13px] font-semibold">
                  <span aria-hidden>{CATEGORY_EMOJI[cat]}</span>
                  {categoryLabel[cat]}
                  <span className="ml-auto text-[11px] font-normal tabular-nums text-zinc-600">
                    {ids.length}
                  </span>
                </h3>
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {ids.map((id) => (
                    <li
                      key={id}
                      className="glass-subtle rounded-full px-2.5 py-1 text-[11px] text-zinc-400"
                    >
                      <span className="mr-1" aria-hidden>
                        {METRIC_EMOJI[id]}
                      </span>
                      {t.metrics[id].label}
                    </li>
                  ))}
                </ul>
              </motion.div>
            );
          })}
        </div>
      </Section>

      {/* ---------------- How it works ---------------- */}
      <Section id="how" title={t.landing.stepsTitle} className="pb-20">
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {t.landing.steps.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.07 }}
              className="glass relative overflow-hidden rounded-2xl p-5"
            >
              <span className="font-mono-terminal text-[11px] text-accent">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-2.5 text-[13px] font-semibold">{step.title}</h3>
              <p className="mt-1.5 text-[12px] leading-relaxed text-zinc-500">
                {step.text}
              </p>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* ---------------- Privacy ---------------- */}
      <Section className="pb-20">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.55 }}
          className="glass relative overflow-hidden rounded-[28px] p-7 sm:p-10"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-accent/[0.07] blur-3xl"
          />
          <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div>
              <Lock className="h-5 w-5 text-accent" />
              <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
                {t.landing.privacyTitle}
              </h2>
              <p className="mt-3 text-[14px] leading-relaxed text-zinc-400">
                {t.landing.privacyBody}
              </p>
            </div>
            <ul className="flex flex-col gap-3">
              {t.landing.privacyPoints.map((p) => (
                <li
                  key={p}
                  className="glass-subtle flex items-start gap-3 rounded-2xl p-4 text-[13px] leading-relaxed text-zinc-300"
                >
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </motion.div>
      </Section>

      {/* ---------------- Pricing ---------------- */}
      <Section
        id="pricing"
        title={t.landing.pricingTitle}
        sub={t.landing.pricingSub}
        className="pb-20"
      >
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.55 }}
          className="glass mx-auto mt-10 max-w-md rounded-[28px] p-7 sm:p-8"
        >
          <div className="flex items-baseline justify-center gap-2">
            <span className="text-5xl font-semibold tracking-tight">
              {formatPrice(locale)}
            </span>
          </div>
          <p className="mt-2 text-center text-[12px] text-zinc-500">
            {t.landing.pricingNote}
          </p>

          <ul className="mt-7 flex flex-col gap-2.5">
            {t.landing.pricingIncludes.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-[13px] text-zinc-300">
                <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                {f}
              </li>
            ))}
          </ul>

          <Link href="/quiz" className="mt-7 block">
            <Button size="lg" className="w-full">
              {t.landing.ctaFinal} <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </motion.div>
      </Section>

      {/* ---------------- FAQ ---------------- */}
      <Section title={t.landing.faqTitle} className="pb-20">
        <div className="mx-auto mt-10 flex max-w-2xl flex-col gap-2.5">
          {t.landing.faq.map((item, i) => (
            <Faq key={item.q} q={item.q} a={item.a} index={i} />
          ))}
        </div>
      </Section>

      <ReviewsSection />

      {/* ---------------- Footer ---------------- */}
      <footer className="border-t border-white/[0.06] py-10">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 sm:px-6">
          <div className="flex items-center gap-2">
            <ScanFace className="h-4 w-4 text-accent" />
            <span className="text-[11px] font-semibold tracking-[0.18em] text-zinc-400">
              FACESCAN
            </span>
          </div>
          <p className="max-w-2xl text-[11px] leading-relaxed text-zinc-600">
            {t.landing.disclaimer}
          </p>
          <div className="flex gap-5 text-[11px] text-zinc-600">
            <span>{t.landing.imprint}</span>
            <span>{t.landing.privacyLink}</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
