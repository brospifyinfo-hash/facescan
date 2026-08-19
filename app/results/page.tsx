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
import { SectionNav, type NavSection } from "@/components/report/SectionNav";
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

  // Restore a purchase on load. `plan`/`unlocked` live only in browser
  // memory, so without this a paying customer who reloads (or comes back
  // tomorrow) sees the paywall over features they own. The server stays the
  // authority: the plan comes from what the webhook actually granted, and
  // `admin` is the owner's review cookie standing in for a purchase.
  useEffect(() => {
    if (!signedInAs || unlocked) return;
    let cancelled = false;
    void fetch("/api/stripe/entitlement")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const plan = data.plan ?? (data.admin ? "blueprint" : null);
        if (plan) unlock(signedInAs, plan);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [signedInAs, unlocked, unlock]);

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
        // Derived here because it needs the full measurement set, which the
        // stored row does not carry — see potentialFor(). Computed inline
        // rather than read from the render body: that binding is declared
        // further down, and depending on it would make this effect break the
        // day someone reorders the file.
        potential: potentialFor(metrics)?.score ?? null,
        // Every dial, so the account can reopen this scan in full later.
        detail: metrics.metrics.map((m) => ({ id: m.id, score: m.score, display: m.display })),
      }),
      // A failed save must not interrupt the report the customer just paid
      // for — but it must not be silently final either. Releasing the ref on
      // a transient failure lets the next run of this effect (sign-in, or a
      // remount) try again; a 4xx is a deliberate refusal and is left alone.
    })
      .then((res) => {
        if (!res.ok) {
          console.warn(`[history] save refused (${res.status})`);
          if (res.status >= 500) saved.current = false;
        }
      })
      .catch(() => {
        saved.current = false;
      });
  }, [signedInAs, metrics]);

  // Owner access code — unlocks every gated section with no visible marker,
  // so the paid experience can be reviewed exactly as a customer sees it.
  // "Every" has to mean the top tier: the store's default plan is "pro",
  // which has hairstyle/blueprint false — under it the review never showed
  // the two features the owner most needs to check.
  useEffect(() => {
    const apply = () => {
      if (hasAccessCode()) unlock("owner@local", "blueprint");
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

  // The floating chapter navigation. Extras only exists once it is bought —
  // a chip that scrolls to a section that is not there is a broken promise.
  const hasExtras =
    unlocked && (can(plan, "download") || can(plan, "hairstyle") || can(plan, "blueprint"));
  const navSections: NavSection[] = [
    { id: "sec-result", label: t.results.nav.result },
    { id: "sec-analysis", label: t.results.nav.analysis },
    { id: "sec-plan", label: t.results.nav.plan },
    ...(hasExtras ? [{ id: "sec-extras", label: t.results.nav.extras }] : []),
  ];

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
      {/* A phone column on a phone, exactly as designed. From lg the scan and
          the score become a sticky instrument rail on the left while the
          reading continues on the right — the desktop gets a real report
          layout instead of a stranded phone column. The bottom padding clears
          the floating tab bar. */}
      <main className="mx-auto w-full max-w-md px-4 pt-5 pb-32 lg:max-w-6xl lg:px-8 lg:pt-8">
        <ReportHeader demo={metrics.demo} />

        {locked ? (
          <div className="mt-3 flex justify-center">
            <SessionTimer />
          </div>
        ) : null}

        <div className="lg:grid lg:grid-cols-[400px_minmax(0,1fr)] lg:items-start lg:gap-6">
          {/* ---- Instrument rail: the face and its number ---- */}
          <div className="lg:sticky lg:top-6">
            <section id="sec-result" className="mt-4 scroll-mt-6 space-y-3">
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
          </div>

          {/* ---- The reading ---- */}
          <div className="min-w-0">
        {/* ================= LOCKED REGION ================= */}
        <section className="relative mt-3 lg:mt-4">
          <div className="flex flex-col gap-3">
            <SectionMark id="sec-analysis" label={t.results.sections.analysis} />

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

            <SectionMark id="sec-plan" label={t.results.sections.plan} className="mt-2" />

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

            {unlocked && !can(plan, "actionPlan") ? (
              <section className="panel p-[var(--pad-panel)]">
                <h2 className="t-title3">{t.monthly.upsellTitle}</h2>
                <p className="t-caption mt-1.5 leading-relaxed text-[var(--color-ink-secondary)]">
                  {t.monthly.upsellBody}
                </p>
                <Button className="mt-4" onClick={() => startUnlock()}>
                  {t.monthly.upsellCta} — {formatPrice(locale, "blueprint")}
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

        {hasExtras ? (
          <SectionMark id="sec-extras" label={t.results.sections.extras} className="mt-6" />
        ) : null}

        {/* The deep-dive lives under Extras: it is the blueprint's flagship
            and was buried mid-plan, where nobody scrolling for it found it. */}
        {unlocked && can(plan, "blueprint") ? (
          <div className="mt-3">
            <FullReport />
          </div>
        ) : null}

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
          </div>
        </div>

        <p className="t-caption mx-auto mt-8 max-w-md text-center leading-relaxed text-[var(--color-ink-tertiary)]">
          {t.results.disclaimer}
        </p>

        <div className="mt-5 flex justify-center">
          <LanguageSwitcher />
        </div>
      </main>

      {/* The chapter navigation floats over everything — the report's map. */}
      <SectionNav sections={navSections} />

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

/** A chapter mark: eyebrow plus a hairline running out to the edge. The
 *  report reads as one long instrument without them; these give it a table
 *  of contents the eye can catch while scrolling. The id is the anchor the
 *  floating SectionNav jumps to; scroll-mt keeps the mark clear of the
 *  viewport edge after the jump. */
function SectionMark({
  label,
  className,
  id,
}: {
  label: string;
  className?: string;
  id?: string;
}) {
  return (
    <div id={id} className={`flex scroll-mt-6 items-center gap-3 ${className ?? ""}`}>
      <span className="t-eyebrow whitespace-nowrap">{label}</span>
      <span aria-hidden className="h-px flex-1 bg-[var(--color-hairline)]" />
    </div>
  );
}
