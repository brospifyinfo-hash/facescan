"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Lock, ScanFace } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Collapsible } from "@/components/ui/Collapsible";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { FaceMesh } from "@/components/dashboard/FaceMesh";
import { RadarChart } from "@/components/dashboard/RadarChart";
import { ScoreRing, MiniRing } from "@/components/dashboard/ScoreRing";
import { MetricsPanel } from "@/components/dashboard/MetricsPanel";
import { TierLadder } from "@/components/dashboard/TierLadder";
import { RawDiagnostics } from "@/components/dashboard/RawDiagnostics";
import { MeasurementTable } from "@/components/dashboard/MeasurementTable";
import { LockedSection } from "@/components/dashboard/LockedSection";
import { ActionPlan } from "@/components/dashboard/ActionPlan";
import { FullReport } from "@/components/dashboard/FullReport";
import { CheckoutModal } from "@/components/checkout/CheckoutModal";
import { SessionTimer } from "@/components/checkout/SessionTimer";
import { PercentileBadge } from "@/components/dashboard/PercentileBadge";
import { formatPrice } from "@/lib/pricing";
import { bandFor } from "@/lib/tiers";
import { fill, useI18n, useT } from "@/lib/i18n";
import { useFunnel } from "@/lib/store";

export default function ResultsPage() {
  const router = useRouter();
  const t = useT();
  const { locale } = useI18n();
  const { metrics, quiz, photos, unlocked, unlock } = useFunnel();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    if (!metrics) router.replace("/upload");
  }, [metrics, router]);

  // Calibration aid, opened with ?raw=1 on ANY page of the funnel — the flag
  // rides in sessionStorage because reloading /results would drop the scan
  // (it only ever lives in memory). Deliberately outside the paywall: this is
  // a diagnostic for whoever runs the site, not a product feature.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("raw")) {
      sessionStorage.setItem("facescan.raw", "1");
    }
    setShowRaw(sessionStorage.getItem("facescan.raw") === "1");
  }, []);

  if (!metrics) return null;

  const band = bandFor(metrics.overall);
  const bandCopy = t.bands[band.id];
  const locked = !unlocked;
  const inRange = metrics.metrics.filter((m) => m.position === "in").length;

  return (
    <main className="mx-auto w-full max-w-5xl px-3 py-5 sm:px-6 sm:py-8">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ScanFace className="h-4 w-4 text-accent" />
          <span className="text-[11px] font-semibold tracking-[0.2em]">
            FACESCAN
          </span>
          {metrics.demo ? (
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[9px] font-medium text-amber-300">
              🧪 {t.results.demoData}
            </span>
          ) : null}
        </div>
        <LanguageSwitcher />
      </header>

      {locked ? (
        <div className="mt-3 flex justify-center sm:justify-start">
          <SessionTimer />
        </div>
      ) : null}

      {/* ================= HERO ================= */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]"
      >
        {/* Front + side, side by side — equal height, each keeping its own
            aspect so the landmark mesh stays aligned. */}
        <div className="grid grid-cols-2 gap-3">
          <FaceMesh
            src={photos.front?.dataUrl}
            mesh={metrics.mesh}
            aspect={metrics.aspect}
            label={t.scan.front}
            className="aspect-[3/4]"
          />
          <FaceMesh
            src={photos.side?.dataUrl}
            mesh={metrics.sideMesh}
            aspect={metrics.sideAspect ?? metrics.aspect}
            label={t.scan.side}
            className="aspect-[3/4]"
          />
        </div>

        {/* Score card */}
        <div className="glass relative overflow-hidden rounded-3xl p-5 sm:p-6">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full blur-3xl"
            style={{ background: `${band.color}1c` }}
          />

          <div className="relative flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
            <ScoreRing score={metrics.overall} color={band.color} />

            <div className="min-w-0 flex-1 text-center sm:text-left">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                {t.results.overall}
              </p>
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.4 }}
                className="mt-2 inline-flex items-center rounded-full px-3 py-1 text-[13px] font-semibold"
                style={{ backgroundColor: `${band.color}1f`, color: band.color }}
              >
                {bandCopy.label}
              </motion.div>
              <p className="mt-2 text-[12px] leading-relaxed text-zinc-400">
                {bandCopy.blurb}
              </p>

              {/* Visible before payment — the hook is a real figure. */}
              <div className="mt-3">
                <PercentileBadge overall={metrics.overall} />
              </div>

              <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-white/[0.08] pt-3">
                {[
                  ["🔬", t.results.landmarks, String(metrics.landmarkCount)],
                  ["📋", t.results.measured, String(metrics.metrics.length)],
                  ["✅", t.results.inRange, `${inRange}/${metrics.metrics.length}`],
                ].map(([emoji, label, value]) => (
                  <div key={label} className="text-center sm:text-left">
                    <dt className="text-[9px] uppercase tracking-[0.08em] text-zinc-600">
                      <span aria-hidden>{emoji}</span> {label}
                    </dt>
                    <dd className="mt-0.5 text-[13px] font-semibold tabular-nums text-zinc-200">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </motion.section>

      {showRaw ? (
        <div className="mt-3">
          <RawDiagnostics metrics={metrics} />
        </div>
      ) : null}

      {/* ================= LOCKED REGION ================= */}
      <section className="relative mt-3">
        <div className="flex flex-col gap-3">
          {/* Category composites + radar — one compact row */}
          <LockedSection locked={locked}>
            <div className="glass rounded-3xl p-4 sm:p-6">
              <div className="grid items-center gap-5 sm:grid-cols-[minmax(0,1fr)_auto]">
                <div className="grid grid-cols-5 gap-2">
                  <MiniRing emoji="⚖️" label={t.results.symmetry} value={metrics.symmetry} delay={0} />
                  <MiniRing emoji="👁️" label={t.results.eyes} value={metrics.eyesScore} delay={0.06} />
                  <MiniRing emoji="🗿" label={t.results.jaw} value={metrics.jawScore} delay={0.12} />
                  <MiniRing emoji="📐" label={t.results.ratios} value={metrics.proportionsScore} delay={0.18} />
                  <MiniRing emoji="👃" label={t.results.midface} value={metrics.midfaceScore} delay={0.24} />
                </div>

                <div className="hidden justify-center sm:flex">
                  {/* Single series — no legend box needed. */}
                  <RadarChart
                    size={200}
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

          {/* Visual tier ladder */}
          <LockedSection locked={locked}>
            <TierLadder current={band.id} />
          </LockedSection>

          {/* All fifteen rings in one panel */}
          <LockedSection locked={locked}>
            <MetricsPanel metrics={metrics.metrics} />
          </LockedSection>

          {/* Secondary content folded away */}
          <LockedSection locked={locked}>
            <Collapsible emoji="📋" title={t.results.allMeasurements} hint={t.results.allMeasurementsSub}>
              <MeasurementTable metrics={metrics.metrics} />
            </Collapsible>
          </LockedSection>

          <LockedSection locked={locked}>
            <Collapsible emoji="✨" title={t.results.skinTitle} hint={t.results.skinSub}>
              <p className="text-[12px] leading-relaxed text-zinc-400">
                {t.results.skinSub}
              </p>
            </Collapsible>
          </LockedSection>

          <LockedSection locked={locked}>
            <ActionPlan quiz={quiz} metrics={metrics} interactive={!locked} />
          </LockedSection>

          {unlocked ? <FullReport /> : null}
        </div>

        {/* Unlock overlay */}
        {locked ? (
          <div className="absolute inset-0 flex items-start justify-center">
            <div className="pointer-events-none sticky top-16 w-full max-w-sm px-3">
              <motion.div
                initial={{ opacity: 0, y: 16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="glass-strong pointer-events-auto rounded-3xl p-5 text-center sm:p-6"
              >
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/15 text-lg">
                  🔒
                </div>

                <h3 className="mt-4 text-lg font-semibold tracking-tight">
                  {fill(t.results.unlockTitle, { n: metrics.metrics.length })}
                </h3>
                <p className="mt-2 text-[12px] leading-relaxed text-zinc-400">
                  {t.results.unlockBody}{" "}
                  <span className="font-medium text-zinc-100">
                    {metrics.weakest.map((id) => t.metrics[id].label).join(", ")}
                  </span>
                </p>

                <ul className="mt-4 flex flex-wrap justify-center gap-1.5">
                  {t.results.unlockChips.map((chip) => (
                    <li
                      key={chip}
                      className="glass-subtle rounded-full px-2 py-0.5 text-[10px] text-zinc-400"
                    >
                      {chip}
                    </li>
                  ))}
                </ul>

                <Button size="lg" className="mt-5 w-full" onClick={() => setCheckoutOpen(true)}>
                  <Lock className="h-4 w-4" />
                  {t.results.unlockCta} — {formatPrice(locale)}
                </Button>

                <p className="mt-2.5 text-[10px] text-zinc-500">
                  {t.results.unlockNote}
                </p>
              </motion.div>
            </div>
          </div>
        ) : null}
      </section>

      {unlocked ? (
        <div className="mt-6 text-center text-[12px] text-accent">
          🔓 {t.results.unlocked}
        </div>
      ) : null}

      <p className="mx-auto mt-8 max-w-xl text-center text-[10px] leading-relaxed text-zinc-600">
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
