"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Lock, ScanFace } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FaceMesh } from "@/components/dashboard/FaceMesh";
import { RadarChart } from "@/components/dashboard/RadarChart";
import { ScoreRing, MiniRing } from "@/components/dashboard/ScoreRing";
import { MetricMeter } from "@/components/dashboard/MetricMeter";
import { MeasurementTable } from "@/components/dashboard/MeasurementTable";
import { LockedSection } from "@/components/dashboard/LockedSection";
import { ActionPlan } from "@/components/dashboard/ActionPlan";
import { FullReport } from "@/components/dashboard/FullReport";
import { CheckoutModal } from "@/components/checkout/CheckoutModal";
import { SessionTimer } from "@/components/checkout/SessionTimer";
import { CATEGORIES } from "@/lib/metrics";
import { PRODUCT } from "@/lib/pricing";
import { bandFor } from "@/lib/tiers";
import { useFunnel } from "@/lib/store";

function SectionHeading({
  emoji,
  title,
  blurb,
  right,
}: {
  emoji: string;
  title: string;
  blurb?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="flex items-center gap-2.5 text-lg font-semibold tracking-tight">
          <span aria-hidden>{emoji}</span> {title}
        </h2>
        {blurb ? (
          <p className="mt-1.5 text-[13px] text-zinc-500">{blurb}</p>
        ) : null}
      </div>
      {right}
    </div>
  );
}

export default function ResultsPage() {
  const router = useRouter();
  const { metrics, quiz, photos, unlocked, unlock } = useFunnel();
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  useEffect(() => {
    if (!metrics) router.replace("/upload");
  }, [metrics, router]);

  if (!metrics) return null;

  const band = bandFor(metrics.overall);
  const locked = !unlocked;
  const inRange = metrics.metrics.filter((m) => m.position === "in").length;

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <ScanFace className="h-5 w-5 text-accent" />
          <span className="text-xs font-semibold tracking-[0.2em]">
            FACESCAN
          </span>
          {metrics.demo ? (
            <span className="ml-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[10px] font-medium text-amber-300">
              🧪 Demo data
            </span>
          ) : null}
        </div>
        {locked ? <SessionTimer /> : null}
      </header>

      {/* ================= HERO — always visible ================= */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]"
      >
        <FaceMesh
          src={photos.front?.dataUrl}
          mesh={metrics.mesh}
          aspect={metrics.aspect}
        />

        <div className="relative overflow-hidden rounded-3xl border border-white/[0.07] bg-white/[0.02] p-8">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full blur-3xl"
            style={{ background: `${band.color}18` }}
          />

          <div className="relative flex flex-col items-center gap-7 sm:flex-row sm:items-center sm:gap-9">
            <ScoreRing score={metrics.overall} color={band.color} />

            <div className="min-w-0 flex-1 text-center sm:text-left">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Overall Score
              </p>
              <div
                className="mt-3 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold"
                style={{ backgroundColor: `${band.color}1f`, color: band.color }}
              >
                {band.label}
              </div>
              <p className="mt-3 text-[13px] leading-relaxed text-zinc-400">
                {band.blurb}
              </p>

              <dl className="mt-6 grid grid-cols-3 gap-4 border-t border-white/[0.07] pt-5 text-center sm:text-left">
                {[
                  ["🔬", "Landmarks", String(metrics.landmarkCount)],
                  ["📋", "Measured", String(metrics.metrics.length)],
                  ["✅", "In range", `${inRange}/${metrics.metrics.length}`],
                ].map(([emoji, label, value]) => (
                  <div key={label}>
                    <dt className="text-[10px] uppercase tracking-[0.1em] text-zinc-600">
                      <span aria-hidden>{emoji}</span> {label}
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-zinc-200">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </motion.section>

      {/* ================= LOCKED REGION ================= */}
      <section className="relative mt-5">
        <div className="flex flex-col gap-5">
          {/* Category overview + radar */}
          <LockedSection locked={locked}>
            <div className="rounded-3xl border border-white/[0.07] bg-white/[0.02] p-7 sm:p-8">
              <SectionHeading
                emoji="🧬"
                title="Biometric Breakdown"
                blurb="Category composites from the full measurement set."
              />

              <div className="mt-7 grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
                <div className="grid grid-cols-3 gap-5 sm:grid-cols-5">
                  <MiniRing emoji="⚖️" label="Symmetry" value={metrics.symmetry} delay={0} />
                  <MiniRing emoji="👁️" label="Eyes" value={metrics.eyesScore} delay={0.07} />
                  <MiniRing emoji="🗿" label="Jaw" value={metrics.jawScore} delay={0.14} />
                  <MiniRing emoji="📐" label="Ratios" value={metrics.proportionsScore} delay={0.21} />
                  <MiniRing emoji="👃" label="Midface" value={metrics.midfaceScore} delay={0.28} />
                </div>

                <div className="flex justify-center">
                  {/* Single series — no legend box needed. */}
                  <RadarChart
                    axes={[
                      { label: "Symmetry", value: metrics.symmetry },
                      { label: "Eyes", value: metrics.eyesScore },
                      { label: "Jaw", value: metrics.jawScore },
                      { label: "Ratios", value: metrics.proportionsScore },
                      { label: "Midface", value: metrics.midfaceScore },
                    ]}
                  />
                </div>
              </div>
            </div>
          </LockedSection>

          {/* One section per category */}
          {CATEGORIES.map((cat) => {
            const items = metrics.metrics.filter((m) => m.category === cat.id);
            if (items.length === 0) return null;
            return (
              <LockedSection key={cat.id} locked={locked}>
                <div className="rounded-3xl border border-white/[0.07] bg-white/[0.02] p-7 sm:p-8">
                  <SectionHeading
                    emoji={cat.emoji}
                    title={cat.label}
                    blurb={cat.blurb}
                    right={
                      <span className="rounded-full border border-white/[0.07] px-3 py-1 text-[11px] tabular-nums text-zinc-500">
                        {items.filter((m) => m.position === "in").length}/
                        {items.length} in range
                      </span>
                    }
                  />
                  <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {items.map((m, i) => (
                      <MetricMeter key={m.id} metric={m} delay={i * 0.05} />
                    ))}
                  </div>
                </div>
              </LockedSection>
            );
          })}

          {/* Table twin — every value reachable without colour or hover */}
          <LockedSection locked={locked}>
            <div className="rounded-3xl border border-white/[0.07] bg-white/[0.02] p-7 sm:p-8">
              <SectionHeading
                emoji="📋"
                title="All Measurements"
                blurb="The complete data table behind the meters above."
              />
              <div className="mt-6">
                <MeasurementTable metrics={metrics.metrics} />
              </div>
            </div>
          </LockedSection>

          {/* Skin & hair honestly labelled: not landmark-derived */}
          <LockedSection locked={locked}>
            <div className="rounded-3xl border border-white/[0.07] bg-white/[0.02] p-7 sm:p-8">
              <SectionHeading
                emoji="✨"
                title="Skin & Hair"
                blurb="Not derivable from landmark geometry — assessed from your photo by the vision model in your AI report."
              />
            </div>
          </LockedSection>

          <LockedSection locked={locked}>
            <ActionPlan quiz={quiz} metrics={metrics} interactive={!locked} />
          </LockedSection>

          {unlocked ? <FullReport /> : null}
        </div>

        {/* Unlock overlay */}
        {locked ? (
          <div className="absolute inset-0 flex items-start justify-center">
            <div className="pointer-events-none sticky top-24 w-full max-w-md px-4">
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="glass-deep pointer-events-auto rounded-3xl p-7 text-center shadow-[0_24px_90px_rgba(0,0,0,0.7)]"
              >
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15 text-xl">
                  🔒
                </div>

                <h3 className="mt-5 text-xl font-semibold tracking-tight">
                  {metrics.metrics.length} measurements are ready
                </h3>
                <p className="mt-2.5 text-[13px] leading-relaxed text-zinc-400">
                  Your three biggest opportunities:{" "}
                  <span className="font-medium text-zinc-100">
                    {metrics.weakest.join(", ")}
                  </span>
                  . Unlock every figure plus your action plan.
                </p>

                <ul className="mt-5 flex flex-wrap justify-center gap-2">
                  {["👁️ Eye region", "🗿 Jaw & chin", "📐 Ratios", "👃 Midface", "✨ Glow-up plan"].map(
                    (chip) => (
                      <li
                        key={chip}
                        className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] text-zinc-400"
                      >
                        {chip}
                      </li>
                    ),
                  )}
                </ul>

                <Button
                  size="lg"
                  className="mt-6 w-full"
                  onClick={() => setCheckoutOpen(true)}
                >
                  <Lock className="h-4 w-4" />
                  Unlock Everything — {PRODUCT.price} {PRODUCT.currency}
                </Button>

                <p className="mt-3 text-[11px] text-zinc-500">
                  One-time payment · No subscription · Lifetime access
                </p>
              </motion.div>
            </div>
          </div>
        ) : null}
      </section>

      {unlocked ? (
        <div className="mt-8 text-center text-[13px] text-accent">
          🔓 Full analysis unlocked
        </div>
      ) : null}

      <p className="mx-auto mt-10 max-w-2xl text-center text-[11px] leading-relaxed text-zinc-600">
        Every figure is a geometric measurement computed on your device from
        facial landmarks, compared against published population reference
        ranges. Orientation for self-improvement — not a medical,
        dermatological, or psychological assessment, and not a verdict on
        anyone&apos;s appearance.
      </p>

      <CheckoutModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        onSuccess={(email) => {
          // TODO: unlock only after a Stripe webhook confirms payment.
          unlock(email);
          setCheckoutOpen(false);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />
    </main>
  );
}
