"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, BadgeCheck, Cpu, ScanFace, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { ReviewsSection } from "@/components/landing/ReviewsSection";
import { useT } from "@/lib/i18n";
import { useFunnel } from "@/lib/store";

const TRUST_ICONS = [ShieldCheck, Cpu, BadgeCheck];

export default function LandingPage() {
  const t = useT();
  const expiredNotice = useFunnel((s) => s.expiredNotice);
  const clearExpiredNotice = useFunnel((s) => s.clearExpiredNotice);

  return (
    <main className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <ScanFace className="h-6 w-6 text-accent" />
          <span className="text-sm font-semibold tracking-[0.2em]">FACESCAN</span>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="#how-it-works"
            className="hidden text-sm text-zinc-400 transition-colors hover:text-zinc-100 sm:block"
          >
            {t.nav.howItWorks}
          </a>
          <LanguageSwitcher />
        </div>
      </header>

      {expiredNotice ? (
        <div className="mx-auto mt-2 w-full max-w-2xl px-6">
          <div className="glass flex items-start justify-between gap-4 rounded-2xl p-4 text-sm text-zinc-300">
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

      {/* Hero */}
      <section className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center px-6 pb-24 pt-16 text-center sm:pt-24">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center"
        >
          <span className="glass rounded-full px-4 py-1.5 text-xs font-medium tracking-wide text-zinc-400">
            {t.landing.badge}
          </span>
          <h1 className="mt-8 max-w-3xl text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            {t.landing.headline}{" "}
            <span className="text-accent">{t.landing.headlineAccent}</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-zinc-400">
            {t.landing.sub}
          </p>
          <Link href="/quiz" className="mt-10">
            <Button size="lg">
              {t.landing.cta} <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <p className="mt-4 text-xs text-zinc-500">{t.landing.ctaNote}</p>
        </motion.div>

        {/* Trust row — every claim here is implemented, not asserted */}
        <div className="mt-24 grid w-full gap-4 sm:grid-cols-3">
          {t.landing.trust.map((item, i) => {
            const Icon = TRUST_ICONS[i];
            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="glass glass-interactive rounded-[26px] p-6 text-left"
              >
                <Icon className="h-5 w-5 text-accent" />
                <h3 className="mt-4 text-sm font-semibold">{item.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                  {item.text}
                </p>
              </motion.div>
            );
          })}
        </div>
      </section>

      <section id="how-it-works" className="mx-auto w-full max-w-5xl px-6 pb-24">
        <h2 className="text-center text-3xl font-semibold tracking-tight">
          {t.landing.stepsTitle}
        </h2>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {t.landing.steps.map((step, i) => (
            <div key={step.title} className="glass rounded-[26px] p-6">
              <span className="font-mono-terminal text-xs text-accent">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-3 text-sm font-semibold">{step.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                {step.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      <ReviewsSection />

      <footer className="border-t border-white/5 py-10">
        <div className="mx-auto w-full max-w-6xl px-6 text-xs leading-relaxed text-zinc-600">
          <p className="max-w-2xl">{t.landing.disclaimer}</p>
        </div>
      </footer>
    </main>
  );
}
