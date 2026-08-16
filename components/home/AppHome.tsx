"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  BarChart3,
  ChevronRight,
  Cpu,
  History,
  Lightbulb,
  Lock,
  Scan,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  TrendingUp,
} from "lucide-react";
import { CornerBrackets, Plinth, PotentialGauge, ScoreAvatar, TipBadge } from "./HomeArt";
import { DEMO_SUMMARY, fmtDelta, fmtScore, summarise, type ScanRecord } from "@/lib/home/summary";
import { SLOT_SPECS } from "@/lib/site-images";
import { DevUnlock } from "@/components/ui/DevUnlock";
import { bandFor } from "@/lib/tiers";
import { useI18n, useT } from "@/lib/i18n";
import { useFunnel } from "@/lib/store";

// The home screen.
//
// WHAT IS REAL AND WHAT IS FURNITURE
// ----------------------------------
// The hero, the chips, the quick links and the tip are the same for everyone,
// so they render immediately from the dictionary. The four statistics and the
// last-scan card are the customer's own data, so they render from the stored
// history — and when there is none they say so instead of showing the numbers
// from the design mock. A first-time visitor being told they have six scans
// and an average of 6.4 is not a placeholder, it is a fabricated record.
//
// The photo in the last-scan card comes from the funnel store, never from the
// server: photographs are not uploaded and not stored, so the only way one
// appears here is if the scan happened in this browser and is still in
// memory. The ring and the score are drawn either way.

interface HistoryResponse {
  scans?: ScanRecord[];
}

export function AppHome() {
  const t = useT();
  const { locale } = useI18n();
  const { photos, metrics } = useFunnel();

  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [art, setArt] = useState<Record<string, string>>({
    hero: SLOT_SPECS.hero.fallback,
    tip: SLOT_SPECS.tip.fallback,
  });

  // Both are progressive: the page is complete without either, and neither
  // failing is worth telling the visitor about. A signed-out visitor gets a
  // 401 from the history route, which is simply "no scans".
  useEffect(() => {
    let live = true;
    fetch("/api/history", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<HistoryResponse>) : null))
      .then((d) => {
        if (live && d?.scans) setScans(d.scans);
      })
      .catch(() => {});
    fetch("/api/site-images")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (live && d?.images) setArt((prev) => ({ ...prev, ...d.images }));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const real = summarise(scans);

  // The scan sitting in this browser counts as the latest reading even before
  // it is filed — otherwise someone who just scanned and has not signed in
  // sees an empty home page while their result is one tab away.
  const liveScore = metrics?.overall ?? null;
  const hasAnything = real.count > 0 || liveScore !== null;

  // Nothing to show yet: the example fills the layout, and every block that
  // uses it carries the marker. One flag, so the numbers and the label can
  // never come apart. See DEMO_SUMMARY.
  const preview = !hasAnything;
  const summary = preview ? DEMO_SUMMARY : real;

  const shownScore = preview ? DEMO_SUMMARY.latest!.overall : (real.latest?.overall ?? liveScore);
  const shownPotential = preview ? DEMO_SUMMARY.latest!.potential ?? null : (real.latest?.potential ?? null);
  const shownDate =
    !preview && real.latest
      ? new Date(real.latest.at).toLocaleDateString(locale, {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      : null;

  const stats: Array<{ icon: typeof Scan; value: string; unit?: string; label: string }> = [
    { icon: Scan, value: String(summary.count), unit: t.home.stats.scansUnit, label: t.home.stats.scansLabel },
    { icon: Star, value: fmtScore(summary.avgScore), unit: t.results.outOf, label: t.home.stats.avgLabel },
    { icon: TrendingUp, value: fmtDelta(summary.improvement), label: t.home.stats.deltaLabel },
    { icon: Target, value: fmtScore(summary.avgPotential), unit: t.results.outOf, label: t.home.stats.potentialLabel },
  ];

  const tiles = [
    { icon: History, href: "/konto", copy: t.home.tiles[0] },
    { icon: BarChart3, href: "/results", copy: t.home.tiles[1] },
    { icon: Lightbulb, href: "/results", copy: t.home.tiles[2] },
    { icon: Target, href: "/results", copy: t.home.tiles[3] },
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* ---- Header ---------------------------------------------------- */}
      <header className="flex items-center justify-between gap-3 pt-1">
        {/* The owner access code lives on the wordmark, exactly as it did on
            the header this replaced — invisible, and the only way to review
            the paid report as a customer sees it. */}
        <DevUnlock>
          <span className="flex items-center gap-2.5">
            <FaceMark />
            <span className="text-[15px] font-bold uppercase tracking-[0.06em] text-[var(--color-ink)]">
              Face Scanner <span className="text-[var(--color-accent)]">AI</span>
            </span>
          </span>
        </DevUnlock>
        <span className="flex items-center gap-1.5 rounded-full border border-[var(--color-hairline)] px-3.5 py-2 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-[var(--color-ink-secondary)]">
          <Lock className="h-3 w-3 text-[var(--color-ink-secondary)]" aria-hidden />
          {t.home.confidential}
        </span>
      </header>

      {/* ---- Hero ------------------------------------------------------ */}
      <section className="relative overflow-hidden rounded-[var(--r-window)] border border-[var(--color-hairline)] bg-[var(--color-surface)] p-5">
        {/* The soft light behind the figure. In CSS rather than baked into the
            artwork, so a swapped-in image gets the same glow. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-8 top-2 h-[300px] w-[260px] rounded-full opacity-[0.18]"
          style={{ background: "radial-gradient(closest-side, var(--color-accent), transparent)" }}
        />

        {/* 45% wide, and the text column below is 55%: between them they use
            the card exactly once. The supplied head faces LEFT, so its nose
            points into the copy — which reads well but leaves no room for the
            two to overlap even slightly. */}
        <div className="pointer-events-none absolute right-2 top-4 w-[45%]">
          <CornerBrackets />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={art.hero}
            alt=""
            className="aspect-[340/435] w-full object-contain p-1"
          />
          {/* The plinth from the reference. The artwork has no base of its
              own, so it is drawn under the picture rather than across it —
              and a swapped-in image still stands on something. */}
          <Plinth />
        </div>

        <span className="relative inline-flex max-w-[54%] items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--color-hairline)] bg-white/[0.04] px-2.5 py-[5px] text-[8px] font-semibold uppercase tracking-[0.05em] text-[var(--color-accent)]">
          <Sparkles className="h-3 w-3 shrink-0" aria-hidden />
          {t.home.badge}
        </span>

        <div className="relative mt-4 w-[55%] min-w-[180px]">
          <h1 className="text-[26px] font-bold leading-[1.08] tracking-[-0.025em] text-[var(--color-ink)]">
            {t.home.headline}{" "}
            <span className="text-[var(--color-accent)]">{t.home.headlineAccent}</span>
          </h1>

          <p className="mt-2.5 text-[12.5px] leading-[1.45] text-[var(--color-ink-secondary)]">
            {t.home.sub}
          </p>
        </div>

        <ul className="relative mt-4 flex w-full flex-nowrap gap-1.5">
          {[BadgeCheck, ShieldCheck, Cpu].map((Icon, i) => (
            <li
              key={i}
              className="flex min-w-0 items-center gap-1 rounded-full border border-[var(--color-hairline)] bg-white/[0.03] px-2 py-1.5"
            >
              <Icon className="h-3 w-3 shrink-0 text-[var(--color-accent)]" aria-hidden />
              <span className="truncate text-[10px] font-medium text-[var(--color-ink-secondary)]">
                {t.home.chips[i]}
              </span>
            </li>
          ))}
        </ul>

        <Link
          href="/quiz"
          className="interactive relative mt-4 flex w-[70%] min-w-[210px] items-center gap-2 rounded-full bg-[var(--color-accent)] py-3 pl-4 pr-3 text-[12.5px] font-bold uppercase tracking-[0.05em] text-[var(--color-accent-ink)] hover:bg-[var(--color-accent-bright)]"
        >
          <Scan className="h-4 w-4 shrink-0" aria-hidden />
          <span className="flex-1">{t.home.cta}</span>
          <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
        </Link>
      </section>

      {/* ---- Stats ----------------------------------------------------- */}
      {/* pt-7 rather than py-4: the example marker sits in the corner and
          would otherwise land on top of the fourth icon. */}
      <section className="relative grid grid-cols-4 rounded-[var(--r-card)] border border-[var(--color-hairline)] bg-[var(--color-surface)] px-1 pb-4 pt-7">
        {preview ? <PreviewTag label={t.home.preview} /> : null}
        {stats.map((s, i) => (
          <div
            key={i}
            className={`flex flex-col items-center px-1 text-center ${
              i > 0 ? "border-l border-[var(--color-hairline)]" : ""
            }`}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-hairline)] bg-white/[0.03]">
              <s.icon className="h-4 w-4 text-[var(--color-accent)]" aria-hidden />
            </span>
            <p className="mt-2 whitespace-nowrap text-[19px] font-bold leading-none tracking-tight text-[var(--color-ink)]">
              {s.value}
              {s.unit ? (
                <span className="ml-0.5 text-[10px] font-normal text-[var(--color-ink-tertiary)]">
                  {s.unit}
                </span>
              ) : null}
            </p>
            <p className="mt-1.5 text-[9.5px] leading-[1.25] text-[var(--color-ink-tertiary)]">
              {s.label}
            </p>
          </div>
        ))}
      </section>

      {/* ---- Last scan -------------------------------------------------- */}
      <section className="rounded-[var(--r-card)] border border-[var(--color-hairline)] bg-[var(--color-surface)] p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--color-accent)]">
            {t.home.lastScan}
            {preview ? (
              <span className="rounded-full border border-[var(--color-hairline)] px-1.5 py-px text-[8.5px] font-medium tracking-normal text-[var(--color-ink-tertiary)]">
                {t.home.preview}
              </span>
            ) : null}
          </h2>
          <Link
            href="/konto"
            className="interactive flex items-center gap-0.5 text-[11px] text-[var(--color-ink-secondary)]"
          >
            {t.home.allScans}
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>

        {shownScore === null ? (
          // No scan on record. The layout keeps its shape and says what is
          // missing, rather than filling the slots with the mock's numbers.
          <div className="mt-4 flex flex-col items-center gap-2.5 py-3 text-center">
            <ScoreAvatar src={null} value={null} size={72} />
            <p className="text-[13px] font-semibold text-[var(--color-ink)]">{t.home.emptyTitle}</p>
            <p className="max-w-[260px] text-[11.5px] leading-relaxed text-[var(--color-ink-tertiary)]">
              {t.home.emptyBody}
            </p>
          </div>
        ) : (
          <div className="mt-3.5 flex items-center gap-3">
            <ScoreAvatar src={photos?.front?.dataUrl ?? null} value={shownScore} size={84} />

            <div className="min-w-0 flex-1">
              {shownDate ? (
                <p className="text-[11px] text-[var(--color-ink-tertiary)]">{shownDate}</p>
              ) : null}
              <p className="mt-0.5 text-[12.5px] font-medium text-[var(--color-ink-secondary)]">
                {t.home.totalScore}
              </p>
              <p className="mt-0.5 text-[30px] font-bold leading-none tracking-tight text-[var(--color-accent)]">
                {shownScore.toFixed(1)}
                <span className="ml-1 text-[12px] font-normal text-[var(--color-ink-tertiary)]">
                  {t.results.outOf}
                </span>
              </p>
              <p className="mt-1.5">
                <span className="inline-block rounded-full border border-[var(--color-accent)]/45 bg-[var(--color-accent-deep)] px-2 py-[3px] text-[9.5px] font-semibold text-[var(--color-accent)]">
                  {t.bands[bandFor(shownScore).id].label}
                </span>
              </p>
              <Link
                href="/results"
                className="interactive mt-2 inline-flex items-center gap-1 rounded-full border border-[var(--color-hairline)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--color-ink-secondary)]"
              >
                {t.home.details}
                <ChevronRight className="h-3 w-3" aria-hidden />
              </Link>
            </div>

            <div className="flex shrink-0 flex-col items-center">
              <p className="text-[11px] text-[var(--color-ink-secondary)]">{t.home.potentialScore}</p>
              <div className="mt-1.5">
                <PotentialGauge value={shownPotential} outOf={t.results.outOf} size={82} />
              </div>
              {shownPotential !== null ? (
                <p className="mt-1 max-w-[96px] text-center text-[8.5px] leading-[1.3] text-[var(--color-ink-tertiary)]">
                  {t.home.potentialCaption}
                </p>
              ) : null}
            </div>
          </div>
        )}
      </section>

      {/* ---- Quick links ------------------------------------------------ */}
      <nav className="grid grid-cols-4 gap-2">
        {tiles.map((tile, i) => (
          <Link
            key={i}
            href={tile.href}
            className="interactive flex flex-col rounded-[var(--r-control)] border border-[var(--color-hairline)] bg-[var(--color-surface)] p-2.5"
          >
            <tile.icon className="h-[18px] w-[18px] text-[var(--color-accent)]" aria-hidden />
            <span className="mt-2 text-[9.5px] font-bold uppercase tracking-[0.06em] text-[var(--color-ink)]">
              {tile.copy.title}
            </span>
            <span className="mt-0.5 flex items-start gap-0.5 text-[8.5px] leading-[1.3] text-[var(--color-ink-tertiary)]">
              <span className="min-w-0 flex-1">{tile.copy.sub}</span>
              <ChevronRight className="mt-px h-2.5 w-2.5 shrink-0" aria-hidden />
            </span>
          </Link>
        ))}
      </nav>

      {/* ---- Tip of the day --------------------------------------------- */}
      <section className="relative overflow-hidden rounded-[var(--r-card)] border border-[var(--color-hairline)] bg-[var(--color-surface)] p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          aria-hidden
          src={art.tip}
          alt=""
          className="pointer-events-none absolute bottom-0 right-0 h-[86%] w-[52%] object-contain object-right-bottom opacity-90"
        />
        <div className="relative flex items-start gap-3">
          <TipBadge />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-accent)]">
              {t.home.tipEyebrow}
            </p>
            <h3 className="mt-1 text-[15px] font-bold leading-tight text-[var(--color-ink)]">
              {t.home.tipTitle}
            </h3>
            <p className="mt-1 max-w-[62%] text-[11.5px] leading-[1.45] text-[var(--color-ink-secondary)]">
              {t.home.tipBody}
            </p>
          </div>
        </div>
        <Link
          href="/results"
          className="interactive relative mt-3 inline-flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--color-accent)]"
        >
          {t.home.tipCta}
          <ChevronRight className="h-3 w-3" aria-hidden />
        </Link>
      </section>
    </div>
  );
}

/**
 * The marker that says these numbers are an example.
 *
 * Small and quiet on purpose — it is a label, not a warning — but always
 * rendered whenever DEMO_SUMMARY is in use, so the page cannot end up showing
 * example figures with nothing to say so.
 */
function PreviewTag({ label }: { label: string }) {
  return (
    <span className="absolute right-3 top-2 rounded-full border border-[var(--color-hairline)] bg-[var(--color-surface-raised)] px-1.5 py-px text-[8.5px] font-medium text-[var(--color-ink-tertiary)]">
      {label}
    </span>
  );
}

/** The logo mark: a face in a bracketed square, drawn to match the wordmark. */
function FaceMark() {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="var(--color-accent)"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-8 w-8 shrink-0"
      aria-hidden
    >
      <path d="M3 10V6a3 3 0 0 1 3-3h4M22 3h4a3 3 0 0 1 3 3v4M29 22v4a3 3 0 0 1-3 3h-4M10 29H6a3 3 0 0 1-3-3v-4" />
      <circle cx="12.5" cy="14" r="1.4" fill="var(--color-accent)" stroke="none" />
      <circle cx="20" cy="14" r="1.4" fill="var(--color-accent)" stroke="none" />
      <path d="M12 20.5c1.2 1.2 2.6 1.8 4.2 1.8s3-.6 4.2-1.8" />
    </svg>
  );
}
