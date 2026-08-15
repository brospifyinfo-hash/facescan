"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Collapsible } from "@/components/ui/Collapsible";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { MetricsPanel } from "@/components/dashboard/MetricsPanel";
import { TierLadder } from "@/components/dashboard/TierLadder";
import { RawDiagnostics } from "@/components/dashboard/RawDiagnostics";
import { hasAccessCode } from "@/components/ui/DevUnlock";
import { MeasurementTable } from "@/components/dashboard/MeasurementTable";
import { LockedSection } from "@/components/dashboard/LockedSection";
import { ActionPlan } from "@/components/dashboard/ActionPlan";
import { MonthlyProgram } from "@/components/dashboard/MonthlyProgram";
import { FullReport } from "@/components/dashboard/FullReport";
import { CheckoutModal } from "@/components/checkout/CheckoutModal";
import { SessionTimer } from "@/components/checkout/SessionTimer";
import { ReportHeader } from "@/components/report/ReportHeader";
import { ScanStage } from "@/components/report/ScanStage";
import { ScorePanel } from "@/components/report/ScorePanel";
import { AnalysisGrid } from "@/components/report/AnalysisGrid";
import { OptimizePanel, StrengthsPanel } from "@/components/report/Findings";
import { TipCard } from "@/components/report/TipCard";
import { Recommendations } from "@/components/report/Recommendations";
import { UnlockSimulation } from "@/components/report/UnlockSimulation";
import { DownloadPlan } from "@/components/report/DownloadPlan";
import { StyleStudio } from "@/components/report/StyleStudio";
import { AccountCard } from "@/components/report/AccountCard";
import { can, formatPrice } from "@/lib/pricing";
import { AuthModal } from "@/components/auth/AuthModal";
import { fetchSession } from "@/lib/auth/client";
import { bandFor } from "@/lib/tiers";
import { potentialFor } from "@/lib/potential";
import { analysisRows, optimisationsOf, scanRef, strengthsOf } from "@/lib/report-model";
import { fill, useI18n, useT } from "@/lib/i18n";
import { useFunnel } from "@/lib/store";

// THE REPORT.
//
// Reading order, and it is the whole layout decision: face, score, analysis,
// findings, tip. The face first because the user just took it and needs to
// see the scan landed on THEIR photo; the score second because it is what
// they came for. Everything after it is depth, and depth is what the unlock
// buys.
//
// The page owns no formatting and no derivation. Which numbers appear is in
// lib/report-model.ts, the potential figure is in lib/potential.ts, and the
// visuals are in components/report/. What is left here is the funnel: what is
// gated, what the CTA does, and when the session dies.

export default function ResultsPage() {
  const router = useRouter();
  const t = useT();
  const { locale } = useI18n();
  const { metrics, quiz, photos, unlocked, plan, unlock } = useFunnel();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [signedInAs, setSignedInAs] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  // Sign in first, then pay: the address is what the receipt and the scan
  // history hang off, so collecting it before checkout keeps the purchase
  // attached to an account that already exists.
  const startUnlock = useCallback(() => {
    if (signedInAs) setCheckoutOpen(true);
    else setAuthOpen(true);
  }, [signedInAs]);

  useEffect(() => {
    if (!metrics) router.replace("/upload");
  }, [metrics, router]);

  useEffect(() => {
    fetchSession().then(setSignedInAs);
  }, []);

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

  // Save this scan to the customer's history — once, as soon as there is an
  // address to file it under. Signing in IS the consent; the server applies
  // the same rule, and a visitor who never signed in is never stored.
  //
  // The ref is what makes it once. Without it, every re-render that touches
  // `unlocked` or `metrics` would append the same scan again, and the history
  // would fill with duplicates of a single reading.
  const saved = useRef(false);
  useEffect(() => {
    if (saved.current || !signedInAs || !metrics) return;
    saved.current = true;
    void fetch("/api/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        overall: metrics.overall,
        band: bandFor(metrics.overall).id,
        symmetry: metrics.symmetry,
        eyesScore: metrics.eyesScore,
        jawScore: metrics.jawScore,
        proportionsScore: metrics.proportionsScore,
        midfaceScore: metrics.midfaceScore,
        source: metrics.scoreSource ?? "geometry",
      }),
      // A failed save must not interrupt the report the customer just paid
      // for. It is recoverable — the next scan writes again.
    }).catch(() => {});
  }, [signedInAs, metrics]);

  // Owner access code — unlocks every gated section with no visible marker,
  // so the paid experience can be reviewed exactly as a customer sees it.
  useEffect(() => {
    const apply = () => {
      if (hasAccessCode()) unlock("owner@local");
    };
    apply();
    window.addEventListener("facescan:access", apply);
    return () => window.removeEventListener("facescan:access", apply);
  }, [unlock]);

  if (!metrics) return null;

  const band = bandFor(metrics.overall);
  const bandCopy = t.bands[band.id];
  const locked = !unlocked;

  const rows = analysisRows(metrics);
  const strengths = strengthsOf(metrics);
  const optimisations = optimisationsOf(quiz, metrics);
  const potential = potentialFor(metrics);

  // The scan happened in this session — there is no stored timestamp to read,
  // because nothing is stored. `new Date()` is the honest answer and it is
  // only ever evaluated on the client (this component renders null until the
  // in-memory store has a scan, which never happens during SSR).
  const scanDate = new Date().toLocaleDateString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const goToPlan = () => {
    if (locked) {
      startUnlock();
      return;
    }
    document.getElementById("plan")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      {/* max-w-md, not max-w-5xl. This is a phone report; on a laptop it sits
          as a centred column rather than stretching six analysis tiles across
          1200px, which is what made the old layout read as a dashboard. The
          bottom padding clears the floating tab bar. */}
      <main className="mx-auto w-full max-w-md px-4 pt-5 pb-16">
        <ReportHeader demo={metrics.demo} />

        {locked ? (
          <div className="mt-3 flex justify-center">
            <SessionTimer />
          </div>
        ) : null}

        <section className="mt-4 space-y-3">
          <ScanStage
            src={photos.front?.dataUrl}
            mesh={metrics.mesh}
            aspect={metrics.aspect}
            reference={scanRef(metrics)}
            date={scanDate}
          />

          <ScorePanel
            score={metrics.overall}
            band={band}
            bandLabel={bandCopy.label}
            bandBlurb={bandCopy.blurb}
            potential={potential}
          />
        </section>

        {showRaw ? (
          <div className="mt-3">
            <RawDiagnostics metrics={metrics} />
          </div>
        ) : null}

        {/* ================= LOCKED REGION ================= */}
        <section className="relative mt-3">
          <div className="flex flex-col gap-3">
            <LockedSection locked={locked}>
              <div>
                <AnalysisGrid rows={rows} />
              </div>
            </LockedSection>

            {/* Side by side, per the reference. They fit at phone width
                because the optimisation column uses plan[].short — see the
                note in Findings.tsx. */}
            <LockedSection locked={locked}>
              <div className="grid grid-cols-2 items-stretch gap-3">
                <StrengthsPanel items={strengths} />
                <OptimizePanel items={optimisations} />
              </div>
            </LockedSection>

            <LockedSection locked={locked}>
              <TierLadder current={band.id} />
            </LockedSection>

            {/* All fifteen measurements — the depth the unlock actually buys. */}
            <LockedSection locked={locked}>
              <MetricsPanel metrics={metrics.metrics} />
            </LockedSection>

            {/* UNDER the stats, not among them. It sat between the detailed
                analysis and the strengths panel, which put a row of things to
                buy in the middle of the reading — so the numbers resumed
                after it and the block read as an interruption. Here the whole
                measured picture has been given first and the products answer
                it. Renders nothing when no product matches. */}
            {unlocked && can(plan, "products") ? (
              <Recommendations quiz={quiz} metrics={metrics} />
            ) : null}

            <LockedSection locked={locked}>
              <Collapsible
                emoji="📋"
                title={t.results.allMeasurements}
                hint={t.results.allMeasurementsSub}
              >
                <MeasurementTable metrics={metrics.metrics} />
              </Collapsible>
            </LockedSection>

            <LockedSection locked={locked}>
              <Collapsible emoji="✨" title={t.results.skinTitle} hint={t.results.skinSub}>
                <p className="t-footnote leading-relaxed text-[var(--color-ink-secondary)]">
                  {t.results.skinSub}
                </p>
              </Collapsible>
            </LockedSection>

            {/* Raw Data explicitly excludes the action plan, so it stays
                blurred for that tier — the card would otherwise be lying. */}
            <LockedSection locked={locked || !can(plan, "actionPlan")}>
              <div id="plan" className="scroll-mt-4">
                <ActionPlan
                  quiz={quiz}
                  metrics={metrics}
                  interactive={!locked && can(plan, "actionPlan")}
                  collapsible
                />
              </div>
            </LockedSection>

            {/* Gated by capability, never by plan id — adding a tier later
                means touching lib/pricing.ts and nothing else. */}
            {unlocked && can(plan, "actionPlan") ? (
              <MonthlyProgram quiz={quiz} metrics={metrics} collapsible />
            ) : null}

            {unlocked && can(plan, "blueprint") ? <FullReport /> : null}

            {unlocked && !can(plan, "actionPlan") ? (
              <section className="panel p-[var(--pad-panel)]">
                <h2 className="t-title3">{t.monthly.upsellTitle}</h2>
                <p className="t-caption mt-1.5 leading-relaxed text-[var(--color-ink-secondary)]">
                  {t.monthly.upsellBody}
                </p>
                <Button className="mt-4" onClick={() => startUnlock()}>
                  {t.monthly.upsellCta} — {formatPrice(locale, "pro")}
                </Button>
              </section>
            ) : null}
          </div>

          {/* Unlock overlay */}
          {locked ? (
            <div className="absolute inset-0 flex items-start justify-center">
              <div className="pointer-events-none sticky top-6 w-full px-1">
                <motion.div
                  initial={{ opacity: 0, y: 16, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.5, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="material-sheet pointer-events-auto rounded-[var(--r-window)] p-5 text-center"
                >
                  <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-accent-deep)]">
                    <Lock className="h-5 w-5 text-[var(--color-accent)]" aria-hidden />
                  </div>

                  <h3 className="t-title3 mt-4">
                    {fill(t.results.unlockTitle, { n: metrics.metrics.length })}
                  </h3>
                  <p className="t-caption mt-2 leading-relaxed text-[var(--color-ink-secondary)]">
                    {t.results.unlockBody}{" "}
                    <span className="font-medium text-[var(--color-ink)]">
                      {metrics.weakest.map((id) => t.metrics[id].label).join(", ")}
                    </span>
                  </p>

                  <ul className="mt-4 flex flex-wrap justify-center gap-1.5">
                    {t.results.unlockChips.map((chip) => (
                      <li
                        key={chip}
                        className="fill t-caption rounded-full px-2 py-0.5 text-[var(--color-ink-secondary)]"
                      >
                        {chip}
                      </li>
                    ))}
                  </ul>

                  <Button size="lg" className="mt-5 w-full" onClick={() => startUnlock()}>
                    <Lock className="h-4 w-4" />
                    {t.results.unlockCta}
                  </Button>

                  <p className="t-caption mt-2.5 text-[var(--color-ink-tertiary)]">
                    {t.results.unlockNote}
                  </p>
                </motion.div>
              </div>
            </div>
          ) : null}
        </section>

        {/* Right after the plan it exports, and outside the locked region so
            it is never blurred out from the person who paid for it. */}
        {unlocked && can(plan, "download") ? (
          <div className="mt-3">
            <DownloadPlan
              quiz={quiz}
              metrics={metrics}
              monthly={can(plan, "monthly")}
            />
          </div>
        ) : null}

        {/* Blueprint only, and last of the paid blocks: it is the one that
            asks the customer for something (a second photo), so it sits
            after everything they already got without lifting a finger. */}
        {unlocked && can(plan, "hairstyle") ? (
          <div className="mt-3">
            <StyleStudio quiz={quiz} metrics={metrics} />
          </div>
        ) : null}

        {/* Outside the locked region on purpose: the advice is generic, so
            there is nothing to sell here. */}
        <div className="mt-3">
          <TipCard onMore={goToPlan} />
        </div>

        {/* The way into the account, and the only place on the report that
            says where this scan went. */}
        <div className="mt-3">
          <AccountCard signedIn={Boolean(signedInAs)} />
        </div>

        {unlocked ? (
          <p className="mt-6 text-center text-[12px] text-[var(--color-accent)]">
            {t.results.unlocked}
          </p>
        ) : null}

        <p className="t-caption mx-auto mt-8 text-center leading-relaxed text-[var(--color-ink-tertiary)]">
          {t.results.disclaimer}
        </p>

        <div className="mt-5 flex justify-center">
          <LanguageSwitcher />
        </div>
      </main>

      {/* Plays once, straight after the purchase lands. */}
      {unlocked && can(plan, "simulation") ? (
        <UnlockSimulation
          src={photos.front?.dataUrl}
          mesh={metrics.mesh}
          aspect={metrics.aspect}
        />
      ) : null}

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onSignedIn={(mail) => {
          setSignedInAs(mail);
          setAuthOpen(false);
          setCheckoutOpen(true);
        }}
      />

      <CheckoutModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        initialPlan="pro"
        onSuccess={(granted) => {
          // `granted` comes from /api/stripe/entitlement, i.e. from what the
          // verified webhook actually wrote — not from the client.
          unlock(signedInAs ?? "", granted);
          setCheckoutOpen(false);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />
    </>
  );
}
