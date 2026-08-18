"use client";

import { useEffect, useMemo, useState } from "react";
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
import { ProductShowcase } from "./ProductShowcase";
import { RoutineStrip } from "./RoutineStrip";
import { recommend } from "@/lib/products/match";
import type { Product } from "@/lib/products/types";
import { DEMO_SUMMARY, fmtDelta, fmtScore, summarise, type ScanRecord } from "@/lib/home/summary";
import { SLOT_SPECS } from "@/lib/site-images";
import { DevUnlock } from "@/components/ui/DevUnlock";
import { Logo } from "@/components/ui/Logo";
import { bandFor } from "@/lib/tiers";
import { useI18n, useT } from "@/lib/i18n";
import { useFunnel } from "@/lib/store";
import { cn } from "@/lib/cn";

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
  const { photos, metrics, quiz } = useFunnel();

  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [catalogue, setCatalogue] = useState<Product[]>([]);
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
    fetch("/api/products")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (live && Array.isArray(d?.products)) setCatalogue(d.products);
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

  // RANKED IN THE BROWSER, exactly as on the report — the scan never leaves
  // the device, so the server ships the catalogue and this ranks it. Without
  // a scan there is nothing to rank against and the catalogue order stands;
  // the heading says "personalised" only once there is something to
  // personalise against.
  const ranked = useMemo(() => {
    if (!metrics || !quiz) return catalogue;
    const r = recommend(catalogue, quiz, metrics);
    const matched = [...r.top, ...r.others].map((s) => s.product);
    // Products that matched nothing still belong in the rail, just last.
    const seen = new Set(matched.map((m) => m.id));
    return [...matched, ...catalogue.filter((c) => !seen.has(c.id))];
  }, [catalogue, metrics, quiz]);

  const tiles = [
    { icon: History, href: "/konto", copy: t.home.tiles[0] },
    { icon: BarChart3, href: "/results", copy: t.home.tiles[1] },
    { icon: Lightbulb, href: "/results", copy: t.home.tiles[2] },
    { icon: Target, href: "/results", copy: t.home.tiles[3] },
  ];

  return (
    // One column on a phone; a six-column widget board from lg. The spans
    // below place the tiles: hero across the row, stats and last scan side
    // by side, the quick links as a two-by-two block next to the tip.
    <div className="flex flex-col gap-3.5 sm:gap-4 lg:grid lg:grid-cols-6 lg:items-stretch lg:gap-4">
      {/* ---- Header ---------------------------------------------------- */}
      <header className="flex items-center justify-between gap-3 pt-1 lg:col-span-6">
        {/* The owner access code lives on the wordmark, exactly as it did on
            the header this replaced — invisible, and the only way to review
            the paid report as a customer sees it. */}
        <DevUnlock>
          <span className="flex shrink-0 items-center">
            <Logo height={34} className="sm:!h-[42px]" />
          </span>
        </DevUnlock>
        <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--color-hairline)] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.09em] text-[var(--color-ink-secondary)] sm:text-[12.5px]">
          <Lock className="h-3.5 w-3.5 text-[var(--color-ink-secondary)]" aria-hidden />
          {t.home.confidential}
        </span>
      </header>

      {/* ---- Hero ------------------------------------------------------ */}
      <section className="glass relative overflow-hidden rounded-[var(--r-window)] p-5 sm:p-8 lg:col-span-6">
        {/* The soft light behind the figure. In CSS rather than baked into the
            artwork, so a swapped-in image gets the same glow. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-8 top-2 h-[300px] w-[260px] rounded-full opacity-[0.18]"
          style={{ background: "radial-gradient(closest-side, var(--color-accent), transparent)" }}
        />

        {/* A GRID, NOT AN OVERLAY. The figure used to be absolutely
            positioned, which meant the copy knew nothing about how tall it
            was — and at desktop width the head grew past the paragraph and
            landed on the chips. In a grid row the two columns simply cannot
            collide, whatever the viewport or the language does to the text.

            The figure takes less of the card as the card gets wider: on a
            phone the head needs the room to read at all, on a desktop the
            headline does. */}
        <div className="relative grid grid-cols-[minmax(0,1fr)_40%] items-start gap-3 sm:grid-cols-[minmax(0,1fr)_38%] sm:gap-6 lg:grid-cols-[minmax(0,1fr)_27%] lg:items-center">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-hairline)] bg-white/[0.04] px-3 py-1.5 text-[9.5px] font-semibold uppercase leading-tight tracking-[0.05em] text-[var(--color-accent)] sm:text-[11.5px]">
              <Sparkles className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" aria-hidden />
              {t.home.badge}
            </span>

            <h1 className="mt-5 text-[26px] font-bold leading-[1.1] tracking-[-0.025em] text-[var(--color-ink)] sm:mt-7 sm:text-[38px]">
              {t.home.headline}{" "}
              <span className="text-[var(--color-accent)]">{t.home.headlineAccent}</span>
            </h1>

            <p className="mt-3 text-[13.5px] leading-[1.5] text-[var(--color-ink-secondary)] sm:mt-4 sm:text-[15.5px]">
              {t.home.sub}
            </p>
          </div>

          {/* The supplied head faces LEFT, so its nose points into the copy.
              parallax-deep: the figure drifts against its card as the page
              scrolls — the one place depth is unmistakable on a phone. */}
          <div className="parallax-deep relative">
            <CornerBrackets />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={art.hero} alt="" className="aspect-[340/435] w-full object-contain p-1" />
            {/* The plinth from the reference. The artwork has no base of its
                own, so it is drawn under the picture rather than across it —
                and a swapped-in image still stands on something. */}
            <Plinth />
          </div>
        </div>

        <ul className="relative mt-5 flex w-full flex-wrap gap-2 sm:mt-7">
          {[BadgeCheck, ShieldCheck, Cpu].map((Icon, i) => (
            <li
              key={i}
              className="flex items-center gap-1.5 rounded-full border border-[var(--color-hairline)] bg-white/[0.03] px-3 py-2"
            >
              <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--color-accent)] sm:h-4 sm:w-4" aria-hidden />
              <span className="text-[11.5px] font-medium text-[var(--color-ink-secondary)] sm:text-[13px]">
                {t.home.chips[i]}
              </span>
            </li>
          ))}
        </ul>

        <Link
          href="/quiz"
          className="interactive relative mt-5 flex w-[72%] min-w-[230px] items-center gap-2.5 rounded-full bg-[var(--color-accent)] py-3.5 pl-5 pr-4 text-[13px] font-bold uppercase tracking-[0.05em] text-[var(--color-accent-ink)] hover:bg-[var(--color-accent-bright)] sm:mt-7 sm:py-4 sm:text-[15px]"
        >
          <Scan className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" aria-hidden />
          <span className="flex-1">{t.home.cta}</span>
          <ChevronRight className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" aria-hidden />
        </Link>
      </section>

      {/* ---- Stats ----------------------------------------------------- */}
      {/* pt-7 rather than py-4: the example marker sits in the corner and
          would otherwise land on top of the fourth icon. */}
      {/* A two-by-two quadrant divided by hairlines — widget proportions
          without boxes inside the box. Filled sub-tiles read as clutter on
          the glass; one crossing hairline reads as a single instrument. */}
      <section className="glass relative grid grid-cols-2 px-1 pb-2 pt-8 sm:px-2 sm:pb-3 sm:pt-9 lg:col-span-3">
        {preview ? <PreviewTag label={t.home.preview} /> : null}
        {stats.map((s, i) => (
          <div
            key={i}
            className={cn(
              "flex flex-col items-center px-2 py-4 text-center sm:py-5",
              i % 2 === 1 && "border-l border-[var(--color-hairline)]",
              i >= 2 && "border-t border-[var(--color-hairline)]",
            )}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-hairline)] bg-white/[0.03] sm:h-12 sm:w-12">
              <s.icon className="h-[18px] w-[18px] text-[var(--color-accent)] sm:h-5 sm:w-5" aria-hidden />
            </span>
            <p className="mt-2.5 whitespace-nowrap text-[22px] font-bold leading-none tracking-tight text-[var(--color-ink)] sm:mt-3.5 sm:text-[28px]">
              {s.value}
              {s.unit ? (
                <span className="ml-0.5 text-[11px] font-normal text-[var(--color-ink-tertiary)] sm:text-[13px]">
                  {s.unit}
                </span>
              ) : null}
            </p>
            <p className="mt-2 text-[10.5px] leading-[1.3] text-[var(--color-ink-tertiary)] sm:mt-2.5 sm:text-[12px]">
              {s.label}
            </p>
          </div>
        ))}
      </section>

      {/* ---- Last scan -------------------------------------------------- */}
      <section className="glass p-4 sm:p-6 lg:col-span-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--color-accent)] sm:text-[13.5px]">
            {t.home.lastScan}
            {preview ? (
              <span className="rounded-full border border-[var(--color-hairline)] px-2 py-0.5 text-[9.5px] font-medium tracking-normal text-[var(--color-ink-tertiary)] sm:text-[11px]">
                {t.home.preview}
              </span>
            ) : null}
          </h2>
          <Link
            href="/konto"
            className="interactive flex shrink-0 items-center gap-0.5 text-[12px] text-[var(--color-ink-secondary)] sm:text-[13.5px]"
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
            <p className="text-[15px] font-semibold text-[var(--color-ink)] sm:text-[17px]">{t.home.emptyTitle}</p>
            <p className="max-w-[300px] text-[12.5px] leading-relaxed text-[var(--color-ink-tertiary)] sm:text-[14px]">
              {t.home.emptyBody}
            </p>
          </div>
        ) : (
          <div className="mt-3.5 flex items-center gap-3">
            <ScoreAvatar src={photos?.front?.dataUrl ?? null} value={shownScore} size={92} />

            <div className="min-w-0 flex-1">
              {shownDate ? (
                <p className="text-[12px] text-[var(--color-ink-tertiary)] sm:text-[13px]">{shownDate}</p>
              ) : null}
              <p className="mt-1 text-[13.5px] font-medium text-[var(--color-ink-secondary)] sm:text-[15px]">
                {t.home.totalScore}
              </p>
              <p className="mt-1 text-[34px] font-bold leading-none tracking-tight text-[var(--color-accent)] sm:text-[44px]">
                {shownScore.toFixed(1)}
                <span className="ml-1 text-[13px] font-normal text-[var(--color-ink-tertiary)] sm:text-[15px]">
                  {t.results.outOf}
                </span>
              </p>
              <p className="mt-1.5">
                <span className="inline-block rounded-full border border-[var(--color-accent)]/45 bg-[var(--color-accent-deep)] px-2.5 py-1 text-[10.5px] font-semibold text-[var(--color-accent)] sm:text-[12px]">
                  {t.bands[bandFor(shownScore).id].label}
                </span>
              </p>
              <Link
                href="/results"
                className="interactive mt-3 inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--color-hairline)] px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-ink-secondary)] sm:text-[12.5px]"
              >
                {t.home.details}
                <ChevronRight className="h-3 w-3" aria-hidden />
              </Link>
            </div>

            <div className="flex shrink-0 flex-col items-center">
              <p className="text-[12px] text-[var(--color-ink-secondary)] sm:text-[13.5px]">{t.home.potentialScore}</p>
              <div className="mt-1.5">
                <PotentialGauge value={shownPotential} outOf={t.results.outOf} size={92} />
              </div>
              {shownPotential !== null ? (
                <p className="mt-1.5 max-w-[110px] text-center text-[10px] leading-[1.35] text-[var(--color-ink-tertiary)] sm:max-w-[130px] sm:text-[11.5px]">
                  {t.home.potentialCaption}
                </p>
              ) : null}
            </div>
          </div>
        )}
      </section>

      {/* ---- Quick links ------------------------------------------------ */}
      {/* Two-by-two everywhere: four across on a phone left each tile ~80px
          of label room, which is why they read as buttons, not widgets. */}
      <nav className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:col-span-3 lg:gap-4">
        {tiles.map((tile, i) => (
          <Link
            key={i}
            href={tile.href}
            className="glass interactive flex flex-col rounded-[var(--r-card)] p-4 sm:p-5 lg:justify-between lg:p-5"
          >
            <tile.icon className="h-5 w-5 text-[var(--color-accent)] sm:h-6 sm:w-6" aria-hidden />
            <span className="mt-2.5 text-[10.5px] font-bold uppercase tracking-[0.06em] text-[var(--color-ink)] sm:mt-3.5 sm:text-[12.5px]">
              {tile.copy.title}
            </span>
            <span className="mt-1 flex items-start gap-1 text-[10px] leading-[1.35] text-[var(--color-ink-tertiary)] sm:text-[11.5px]">
              <span className="min-w-0 flex-1">{tile.copy.sub}</span>
              <ChevronRight className="mt-px h-3 w-3 shrink-0" aria-hidden />
            </span>
          </Link>
        ))}
      </nav>

      {/* ---- Tip of the day --------------------------------------------- */}
      <section className="glass relative overflow-hidden p-4 sm:p-6 lg:col-span-3">
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
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--color-accent)] sm:text-[12.5px]">
              {t.home.tipEyebrow}
            </p>
            <h3 className="mt-1.5 text-[17px] font-bold leading-tight text-[var(--color-ink)] sm:text-[22px]">
              {t.home.tipTitle}
            </h3>
            <p className="mt-1.5 max-w-[62%] text-[12.5px] leading-[1.5] text-[var(--color-ink-secondary)] sm:text-[14.5px]">
              {t.home.tipBody}
            </p>
          </div>
        </div>
        <Link
          href="/results"
          className="interactive relative mt-4 inline-flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.07em] text-[var(--color-accent)] sm:text-[13px]"
        >
          {t.home.tipCta}
          <ChevronRight className="h-3 w-3" aria-hidden />
        </Link>
      </section>

      {/* ---- Products, routine, upgrade -------------------------------- */}
      <div className="flex flex-col gap-3.5 sm:gap-4 lg:col-span-6">
        <ProductShowcase products={ranked} />
        <RoutineStrip />
      </div>
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
    <span className="absolute right-3 top-2.5 rounded-full border border-[var(--color-hairline)] bg-[var(--color-surface-raised)] px-2 py-0.5 text-[9.5px] font-medium text-[var(--color-ink-tertiary)] sm:text-[11px]">
      {label}
    </span>
  );
}
