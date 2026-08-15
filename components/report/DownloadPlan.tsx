"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { buildReportHtml, downloadReport } from "@/lib/report-export";
import { scanRef } from "@/lib/report-model";
import { useI18n, useT } from "@/lib/i18n";
import type { QuizAnswers, ScanMetrics } from "@/lib/store";

/**
 * Save the report as a file.
 *
 * The document is built here, from data that is already in this tab, so the
 * scan is not posted anywhere to be typeset. It downloads as HTML, which
 * opens in anything and prints to PDF with its own stylesheet already
 * applied — one download, both formats, no rendering dependency.
 */
export function DownloadPlan({
  quiz,
  metrics,
  monthly,
}: {
  quiz: QuizAnswers;
  metrics: ScanMetrics;
  /** Include the four-week programme. Blueprint only. */
  monthly: boolean;
}) {
  const t = useT();
  const { locale } = useI18n();
  const [done, setDone] = useState(false);

  const save = () => {
    const html = buildReportHtml(t, quiz, metrics, locale, { monthly });
    downloadReport(html, `facescan-${scanRef(metrics)}.html`);
    // A file download gives no visible feedback of its own on some browsers,
    // so the button says it happened rather than leaving the user guessing.
    setDone(true);
    window.setTimeout(() => setDone(false), 2500);
  };

  return (
    <section className="panel p-[var(--pad-panel)]">
      <div className="flex items-center gap-3.5">
        <span
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-deep)]"
        >
          <Download className="h-5 w-5 text-[var(--color-accent)]" />
        </span>

        <div className="min-w-0 flex-1">
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--color-accent)]">
            {t.results.downloadTitle}
          </h2>
          <p className="t-caption mt-1 leading-relaxed text-[var(--color-ink-secondary)]">
            {t.results.downloadBody}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={save}
        className="interactive mt-3.5 flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] py-2.5 text-[12.5px] font-semibold text-[var(--color-accent-ink)] hover:bg-[var(--color-accent-bright)]"
      >
        <Download className="h-4 w-4" aria-hidden />
        {done ? t.results.downloadDone : t.results.downloadCta}
      </button>
    </section>
  );
}
