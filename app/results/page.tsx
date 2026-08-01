"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Lock, ScanFace } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { FaceMesh } from "@/components/dashboard/FaceMesh";
import { RadarChart } from "@/components/dashboard/RadarChart";
import { ScoreRing, MiniRing } from "@/components/dashboard/ScoreRing";
import { MetricDial } from "@/components/dashboard/MetricDial";
import { MeasurementTable } from "@/components/dashboard/MeasurementTable";
import { LockedSection } from "@/components/dashboard/LockedSection";
import { ActionPlan } from "@/components/dashboard/ActionPlan";
import { FullReport } from "@/components/dashboard/FullReport";
import { CheckoutModal } from "@/components/checkout/CheckoutModal";
import { SessionTimer } from "@/components/checkout/SessionTimer";
import { CATEGORY_EMOJI, CATEGORY_ORDER } from "@/lib/metrics";
import { PRODUCT } from "@/lib/pricing";
import { bandFor } from "@/lib/tiers";
import { fill, useT } from "@/lib/i18n";
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
        <h2 className="flex items-center gap-2.5 text-xl font-semibold tracking-tight">
          <span aria-hidden>{emoji}</span> {title}
        </h2>
        {blurb ? <p className="mt-1.5 text-[13px] text-zinc-500">{blurb}</p> : null}
      </div>
      {right}
    </div>
  );
}

export default function ResultsPage() {
  const router = useRouter();
  const t = useT();
  const { metrics, quiz, photos, unlocked, unlock } = useFunnel();
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  useEffect(() => {
    if (!metrics) router.replace("/upload");
  }, [metrics, router]);

  if (!metrics) return null;

  const band = bandFor(metrics.overall);
  const bandCopy = t.bands[band.id];
  const locked = !unlocked;
  const inRange = metrics.metrics.filter((m) => m.position === "in").length;
  const categoryLabel = {
    eyes: t.results.eyes,
    jaw: t.results.jaw,
    proportions: t.results.ratios,
    midface: t.results.midface,
  } as const;

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <ScanFace className="h-5 w-5 text-accent" />
          <span className="text-xs font-semibold tracking-[0.2em]">FACESCAN</span>
          {metrics.demo ? (
            <span className="ml-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[10px] font-medium text-amber-300">
              🧪 {t.results.demoData}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          {locked ? <SessionTimer /> : null}
          <LanguageSwitcher />
        </div>
      </header>

      {/* ================= HERO — always visible ================= */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]"
      >
        <FaceMesh
          src={photos.front?.dataUrl}
          mesh={metrics.mesh}
          aspect={metrics.aspect}
        />

        <div className="glass relative overflow-hidden rounded-[30px] p-8">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full blur-3xl"
            style={{ background: `${band.color}1c` }}
          />

          <div className="relative flex flex-col items-center gap-7 sm:flex-row sm:gap-9">
            <ScoreRing score={metrics.overall} color={band.color} />

            <div className="min-w-0 flex-1 text-center sm:text-left">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                {t.results.overall}
              </p>
              <div
                className="mt-3 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold"
                style={{ backgroundColor: `${band.color}1f`, color: band.color }}
              >
                {bandCopy.label}
              </div>
              <p className="mt-3 text-[13px] leading-relaxed text-zinc-400">
                {bandCopy.blurb}
              </p>

              <dl className="mt-6 grid grid-cols-3 gap-4 border-t border-white/[0.08] pt-5 text-center sm:text-left">
                {[
                  ["🔬", t.results.landmarks, String(metrics.landmarkCount)],
                  ["📋", t.results.measured, String(metrics.metrics.length)],
                  ["✅", t.results.inRange, `${inRange}/${metrics.metrics.length}`],
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
          <LockedSection locked={locked}>
            <div className="glass rounded-[30px] p-7 sm:p-9">
              <SectionHeading
                emoji="🧬"
                title={t.results.breakdown}
                blurb={t.results.breakdownSub}
              />

              <div className="mt-7 grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
                <div className="grid grid-cols-3 gap-5 sm:grid-cols-5">
                  <MiniRing emoji="⚖️" label={t.results.symmetry} value={metrics.symmetry} delay={0} />
                  <MiniRing emoji="👁️" label={t.results.eyes} value={metrics.eyesScore} delay={0.07} />
                  <MiniRing emoji="🗿" label={t.results.jaw} value={metrics.jawScore} delay={0.14} />
                  <MiniRing emoji="📐" label={t.results.ratios} value={metrics.proportionsScore} delay={0.21} />
                  <MiniRing emoji="👃" label={t.results.midface} value={metrics.midfaceScore} delay={0.28} />
                </div>

                <div className="flex justify-center">
                  {/* Single series — no legend box needed. */}
                  <RadarChart
                    axes={[
                      { label: t.results.symmetry, value: metrics.symmetry },
                      { label: t.results.eyes, value: metrics.eyesScore },
                      { label: t.results.jaw, value: metrics.jawScore },
                      { label: t.results.ratios, value: metrics.proportionsScore },
                      { label: t.results.midface, value: metrics.midfaceScore },
                    ]}
                  />
                </div>
              </div>
            </div>
          </LockedSection>

          {/* One section per category — dials */}
          {CATEGORY_ORDER.map((cat) => {
            const items = metrics.metrics.filter((m) => m.category === cat);
            if (items.length === 0) return null;
            const copy = t.categories[cat];
            return (
              <LockedSection key={cat} locked={locked}>
                <div className="glass rounded-[30px] p-7 sm:p-9">
                  <SectionHeading
                    emoji={CATEGORY_EMOJI[cat]}
                    title={copy.label}
                    blurb={copy.blurb}
                    right={
                      <span className="glass-subtle rounded-full px-3 py-1 text-[11px] tabular-nums text-zinc-400">
                        {fill(t.results.inCategoryRange, {
                          n: items.filter((m) => m.position === "in").length,
                          total: items.length,
                        })}
                      </span>
                    }
                  />
                  <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((m, i) => (
                      <MetricDial key={m.id} metric={m} delay={i * 0.06} />
                    ))}
                  </div>
                </div>
              </LockedSection>
            );
          })}

          <LockedSection locked={locked}>
            <div className="glass rounded-[30px] p-7 sm:p-9">
              <SectionHeading
                emoji="📋"
                title={t.results.allMeasurements}
                blurb={t.results.allMeasurementsSub}
              />
              <div className="mt-6">
                <MeasurementTable metrics={metrics.metrics} />
              </div>
            </div>
          </LockedSection>

          {/* Skin & hair honestly labelled: not landmark-derived */}
          <LockedSection locked={locked}>
            <div className="glass rounded-[30px] p-7 sm:p-9">
              <SectionHeading
                emoji="✨"
                title={t.results.skinTitle}
                blurb={t.results.skinSub}
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
            <div className="pointer-events-none sticky top-20 w-full max-w-md px-4">
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="glass-strong pointer-events-auto rounded-[30px] p-7 text-center"
              >
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15 text-xl">
                  🔒
                </div>

                <h3 className="mt-5 text-xl font-semibold tracking-tight">
                  {fill(t.results.unlockTitle, { n: metrics.metrics.length })}
                </h3>
                <p className="mt-2.5 text-[13px] leading-relaxed text-zinc-400">
                  {t.results.unlockBody}{" "}
                  <span className="font-medium text-zinc-100">
                    {metrics.weakest.map((id) => t.metrics[id].label).join(", ")}
                  </span>
                </p>

                <ul className="mt-5 flex flex-wrap justify-center gap-2">
                  {t.results.unlockChips.map((chip) => (
                    <li
                      key={chip}
                      className="glass-subtle rounded-full px-2.5 py-1 text-[11px] text-zinc-400"
                    >
                      {chip}
                    </li>
                  ))}
                </ul>

                <Button size="lg" className="mt-6 w-full" onClick={() => setCheckoutOpen(true)}>
                  <Lock className="h-4 w-4" />
                  {t.results.unlockCta} — {PRODUCT.price} {PRODUCT.currency}
                </Button>

                <p className="mt-3 text-[11px] text-zinc-500">
                  {t.results.unlockNote}
                </p>
              </motion.div>
            </div>
          </div>
        ) : null}
      </section>

      {unlocked ? (
        <div className="mt-8 text-center text-[13px] text-accent">
          🔓 {t.results.unlocked}
        </div>
      ) : null}

      <p className="mx-auto mt-10 max-w-2xl text-center text-[11px] leading-relaxed text-zinc-600">
        {t.results.disclaimer}
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
