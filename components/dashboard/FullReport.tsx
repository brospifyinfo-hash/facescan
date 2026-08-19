"use client";

import { useState } from "react";
import { FileText, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { compressForVision } from "@/lib/vision/compress";
import type { DeepDiveReport } from "@/lib/report/contract";
import { fill, useI18n, useT } from "@/lib/i18n";
import { useFunnel } from "@/lib/store";

/**
 * Paid deep-dive report — the real API call happens here, AFTER payment
 * (cost optimization), and only with the user's explicit consent to
 * transmit the two photos once.
 *
 * THE PHOTOS ARE COMPRESSED IN THE BROWSER FIRST, by the same helper the
 * scan and the style studio use. The stored data URLs are the raw uploads
 * (up to 10 MB from PhotoDrop); posting them raw broke on both walls at
 * once — the server's 1.8 MB per-image cap and Vercel's 4.5 MB body limit —
 * so the report failed for practically every real phone photo. Compression
 * also normalises HEIC to JPEG, which the server would otherwise reject.
 */
export function FullReport() {
  const t = useT();
  const { locale } = useI18n();
  const { photos, quiz, metrics } = useFunnel();
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<DeepDiveReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!metrics) return null;

  const generate = async () => {
    if (!photos.front) {
      setError(t.report.errNoPhotos);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [front, side] = await Promise.all([
        compressForVision(photos.front.dataUrl),
        photos.side ? compressForVision(photos.side.dataUrl) : Promise.resolve(null),
      ]);
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          front: front.dataUrl,
          side: side?.dataUrl ?? null,
          locale,
          quiz,
          metrics: metrics.metrics,
          scores: {
            overall: metrics.overall,
            symmetry: metrics.symmetry,
            eyes: metrics.eyesScore,
            jaw: metrics.jawScore,
            proportions: metrics.proportionsScore,
            midface: metrics.midfaceScore,
          },
        }),
      });
      // Platform errors (413, 504) answer with HTML, not JSON — parsing
      // before checking `ok` turned every one of them into a bare
      // "network error" that said nothing about the cause.
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(
          data?.error === "unauthorized"
            ? t.report.errSignIn
            : data?.error === "not_entitled"
              ? t.report.errNotEntitled
              : (data?.error ?? `${t.report.errNetwork} (${res.status})`),
        );
      } else {
        setReport((data?.report as DeepDiveReport) ?? null);
      }
    } catch {
      setError(t.report.errNetwork);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="surface p-7 sm:p-9">
      <h2 className="flex items-center gap-2.5 text-xl font-semibold tracking-tight">
        <FileText className="h-5 w-5 text-accent" /> {t.report.title}
      </h2>

      {report ? (
        <div className="mt-6 space-y-8">
          {/* Overview — the document's lede, set off by the accent edge the
              way a pull quote is: this is the sentence the customer paid to
              read, and it must not look like body copy. */}
          <p className="border-l-2 border-[var(--color-accent)] pl-4 text-[15px] font-medium leading-relaxed text-[var(--color-ink)]">
            {report.overview}
          </p>

          {/* Measurements, explained — the readings as a grouped list. */}
          <section>
            <SectionHeading label={t.report.secMeasurements} />
            <dl className="group-rows mt-4">
              {report.measurements.map((m) => (
                <div key={m.area} className="py-3 first:pt-0 last:pb-0">
                  <dt className="text-[13px] font-semibold text-[var(--color-ink)]">{m.area}</dt>
                  <dd className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-ink-secondary)]">
                    {m.note}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          {/* Strengths — marked with the accent dot, never with checkmarks. */}
          <section>
            <SectionHeading label={t.report.secStrengths} />
            <ul className="mt-4 space-y-2.5">
              {report.strengths.map((s) => (
                <li key={s} className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-accent)] shadow-[0_0_8px_rgba(95,227,138,0.6)]"
                  />
                  <span className="text-[13px] leading-relaxed text-[var(--color-ink-secondary)]">
                    {s}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* The three levers — each a card, ranked, with the action set off
              as the thing to actually do. */}
          <section>
            <SectionHeading label={t.report.secFocus} />
            <ol className="mt-4 space-y-3">
              {report.focus.map((f, i) => (
                <li
                  key={f.title}
                  className="fill relative overflow-hidden rounded-[var(--r-inner)] p-4 pl-5"
                >
                  <span
                    aria-hidden
                    className="font-mono-terminal tnum pointer-events-none absolute -right-1 -top-3 text-[56px] font-bold leading-none text-white/[0.05]"
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <p className="relative text-[14.5px] font-semibold text-[var(--color-ink)]">
                    {f.title}
                  </p>
                  <p className="relative mt-1.5 text-[12.5px] leading-relaxed text-[var(--color-ink-secondary)]">
                    {f.why}
                  </p>
                  <p className="relative mt-3 flex items-start gap-2 rounded-xl bg-[var(--color-accent)]/[0.08] px-3 py-2.5 text-[12.5px] font-medium leading-relaxed text-[var(--color-accent)]">
                    <span aria-hidden className="mt-px shrink-0">
                      →
                    </span>
                    {f.action}
                  </p>
                </li>
              ))}
            </ol>
          </section>

          {/* The four weeks — a timeline: one thread, four stations. */}
          <section>
            <SectionHeading label={t.report.secPlan} />
            <ol className="relative mt-4 space-y-6 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-px before:bg-[var(--color-hairline)]">
              {report.weeks.map((w, i) => (
                <li key={i} className="relative pl-7">
                  <span
                    aria-hidden
                    className="absolute left-0 top-[3px] h-[11px] w-[11px] rounded-full border-2 border-[var(--color-accent)] bg-[var(--color-canvas)]"
                  />
                  <p className="t-eyebrow text-[var(--color-accent)]">
                    {fill(t.report.week, { n: i + 1 })}
                  </p>
                  <p className="mt-1 text-[14px] font-semibold text-[var(--color-ink)]">
                    {w.theme}
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {w.steps.map((s) => (
                      <li
                        key={s}
                        className="flex items-start gap-2 text-[12.5px] leading-relaxed text-[var(--color-ink-secondary)]"
                      >
                        <span
                          aria-hidden
                          className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[var(--color-ink-quaternary)]"
                        />
                        {s}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </section>

          <p className="border-t border-[var(--color-hairline)] pt-5 text-center text-[13px] italic leading-relaxed text-[var(--color-ink-tertiary)]">
            {report.closing}
          </p>
        </div>
      ) : (
        <>
          <p className="mt-2 text-sm text-[var(--color-ink-secondary)]">{t.report.body}</p>

          <label className="fill interactive mt-5 flex cursor-pointer items-start gap-3 rounded-[var(--r-inner)] p-4">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]"
            />
            <span className="text-xs leading-relaxed text-[var(--color-ink-secondary)]">
              {t.report.consent}
            </span>
          </label>

          <div className="mt-5 flex flex-wrap items-center gap-4">
            <Button onClick={generate} disabled={!consent || loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> {t.report.generating}
                </>
              ) : (
                t.report.generate
              )}
            </Button>
            <span className="flex items-center gap-1.5 text-[11px] text-[var(--color-ink-tertiary)]">
              <ShieldCheck className="h-3.5 w-3.5" /> {t.report.oneTime}
            </span>
          </div>

          {error ? (
            <p className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300">
              {error}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

/** The document's chapter mark — eyebrow plus a hairline running out. */
function SectionHeading({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="t-eyebrow whitespace-nowrap">{label}</span>
      <span aria-hidden className="h-px flex-1 bg-[var(--color-hairline)]" />
    </div>
  );
}
