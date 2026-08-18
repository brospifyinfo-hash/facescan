"use client";

import { useState } from "react";
import { FileText, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { compressForVision } from "@/lib/vision/compress";
import { useT } from "@/lib/i18n";
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
  const { photos, quiz, metrics } = useFunnel();
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<string | null>(null);
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
        setReport(data?.report ?? null);
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
        <div className="mt-6 whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-ink-secondary)]">
          {report}
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
