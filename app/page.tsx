"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  Cpu,
  ScanFace,
  ShieldCheck,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ReviewsSection } from "@/components/landing/ReviewsSection";
import { useFunnel } from "@/lib/store";

const TRUST = [
  {
    icon: ShieldCheck,
    title: "Photos never uploaded",
    text: "The free scan runs 100% on your device — your photos stay in this browser tab and auto-expire.",
  },
  {
    icon: Cpu,
    title: "478-landmark geometry",
    text: "Real measurements — symmetry deviation, canthal tilt in degrees, jaw-contour angles. No guesswork.",
  },
  {
    icon: BadgeCheck,
    title: "One-time payment",
    text: "No subscription, no auto-renewal. Pay once for your full report, keep it forever.",
  },
];

const STEPS = [
  ["01", "Answer 6 questions", "60 seconds — calibrates your analysis."],
  ["02", "Two photos", "Front & side. They never leave your browser."],
  ["03", "On-device scan", "478 landmarks mapped and measured locally."],
  ["04", "Your report", "Scores, tilt, jawline — plus a real action plan."],
] as const;

export default function LandingPage() {
  const expiredNotice = useFunnel((s) => s.expiredNotice);
  const clearExpiredNotice = useFunnel((s) => s.clearExpiredNotice);

  return (
    <main className="flex min-h-dvh flex-col">
      {/* Nav */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <ScanFace className="h-6 w-6 text-accent" />
          <span className="text-sm font-semibold tracking-[0.2em]">
            FACESCAN
          </span>
        </div>
        <a
          href="#how-it-works"
          className="text-sm text-zinc-400 transition-colors hover:text-zinc-100"
        >
          How it works
        </a>
      </header>

      {expiredNotice ? (
        <div className="mx-auto mt-2 w-full max-w-2xl px-6">
          <div className="flex items-start justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-300">
            <p>
              Your session expired — as promised, your photos and scan were
              discarded from memory. Start a fresh scan whenever you like.
            </p>
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
      <section className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center px-6 pb-24 pt-20 text-center sm:pt-28">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center"
        >
          <span className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium tracking-wide text-zinc-400">
            On-device AI · Nothing uploaded during your free scan
          </span>
          <h1 className="mt-8 max-w-3xl text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            Find out where you{" "}
            <span className="text-accent">really stand.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-zinc-400">
            Clinical-grade facial geometry analysis that runs entirely in your
            browser. 478 landmarks. Real measurements. A plan you can actually
            act on.
          </p>
          <Link href="/quiz" className="mt-10">
            <Button size="lg">
              Start Free Scan <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <p className="mt-4 text-xs text-zinc-500">
            Free scan · No account needed to start · One-time payment for the
            full report
          </p>
        </motion.div>

        {/* Trust row — every claim here is implemented, not asserted */}
        <div className="mt-24 grid w-full gap-4 sm:grid-cols-3">
          {TRUST.map(({ icon: Icon, title, text }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="glass rounded-3xl p-6 text-left"
            >
              <Icon className="h-5 w-5 text-accent" />
              <h3 className="mt-4 text-sm font-semibold">{title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                {text}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section
        id="how-it-works"
        className="mx-auto w-full max-w-5xl px-6 pb-24"
      >
        <h2 className="text-center text-3xl font-semibold tracking-tight">
          How it works
        </h2>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(([num, title, text]) => (
            <div key={num} className="glass rounded-3xl p-6">
              <span className="font-mono-terminal text-xs text-accent">
                {num}
              </span>
              <h3 className="mt-3 text-sm font-semibold">{title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                {text}
              </p>
            </div>
          ))}
        </div>
      </section>

      <ReviewsSection />

      {/* Footer */}
      <footer className="border-t border-white/5 py-10">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 text-xs text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl leading-relaxed">
            FaceScan provides geometric estimates for self-improvement
            guidance. It is not a medical device, and no result constitutes a
            medical or dermatological assessment.
          </p>
          <div className="flex gap-6">
            <span>Imprint</span>
            <span>Privacy</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
