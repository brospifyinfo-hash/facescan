"use client";

import { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Download, ImageIcon, RefreshCw, Scissors, Sparkles, Upload } from "lucide-react";
import { compressForVision } from "@/lib/vision/compress";
import { useI18n, useT } from "@/lib/i18n";
import type { StyleAdvice } from "@/lib/style/types";
import type { QuizAnswers, ScanMetrics } from "@/lib/store";

// The style studio, blueprint only.
//
// THE THREE PICTURES ARE FETCHED SEPARATELY AND SHOWN AS THEY LAND. Each is
// its own request to /api/style/render, so a haircut that fails leaves the
// other two on screen with a retry on the broken one — rather than one long
// request where the third failure discards the first two and the customer
// watches a spinner for a minute with nothing to show for it.
//
// Slightly staggered rather than fired at once: three image edits arriving
// at OpenAI in the same millisecond is the shape of request that gets rate
// limited, and 400 ms costs nothing against a thirty-second render.
//
// THE PHOTO IS COMPRESSED IN THE BROWSER before either call, by the same
// helper the scan uses. A 6 MB phone photo would otherwise hit Vercel's body
// limit and fail with a platform error that says nothing.

type Slot = {
  status: "idle" | "loading" | "done" | "error";
  src?: string;
  error?: string;
};

const EMPTY: Slot = { status: "idle" };

export function StyleStudio({
  quiz,
  metrics,
}: {
  quiz: QuizAnswers;
  metrics: ScanMetrics;
}) {
  const t = useT();
  const { locale } = useI18n();
  const s = t.results.style;

  const fileRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "advising" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [advice, setAdvice] = useState<StyleAdvice | null>(null);
  // Index 0 and 1 are the haircuts, 2 is the projection.
  const [slots, setSlots] = useState<Slot[]>([EMPTY, EMPTY, EMPTY]);
  const [remaining, setRemaining] = useState<number | null>(null);

  const setSlot = useCallback((i: number, next: Slot) => {
    setSlots((prev) => prev.map((slot, idx) => (idx === i ? next : slot)));
  }, []);

  const render = useCallback(
    async (i: number, dataUrl: string, prompt: string, kind: "hairstyle" | "projection") => {
      setSlot(i, { status: "loading" });
      try {
        const res = await fetch("/api/style/render", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photo: dataUrl, prompt, kind }),
        });
        const json = await res.json();
        if (!res.ok) {
          setSlot(i, { status: "error", error: json?.error ?? s.errGeneric });
          return;
        }
        if (typeof json?.quota?.remaining === "number") setRemaining(json.quota.remaining);
        setSlot(i, { status: "done", src: json.image });
      } catch {
        setSlot(i, { status: "error", error: s.errGeneric });
      }
    },
    [s.errGeneric, setSlot],
  );

  const start = useCallback(
    async (file: File) => {
      setError(null);
      if (!file.type.startsWith("image/")) {
        setError(s.errNotImage);
        return;
      }
      setPhase("advising");
      setSlots([EMPTY, EMPTY, EMPTY]);
      setAdvice(null);

      let dataUrl: string;
      try {
        const raw = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("read failed"));
          reader.readAsDataURL(file);
        });
        dataUrl = (await compressForVision(raw)).dataUrl;
      } catch {
        setPhase("error");
        setError(s.errNotImage);
        return;
      }
      setPhoto(dataUrl);

      try {
        const res = await fetch("/api/style/advice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photo: dataUrl, quiz, metrics, locale }),
        });
        const json = await res.json();
        if (!res.ok) {
          setPhase("error");
          setError(
            json?.error === "unauthorized"
              ? s.errSignIn
              : json?.error === "quota_exhausted"
                ? s.errQuota
                : (json?.error ?? s.errGeneric),
          );
          return;
        }

        const next: StyleAdvice = json.advice;
        setAdvice(next);
        if (typeof json?.quota?.remaining === "number") setRemaining(json.quota.remaining);
        setPhase("ready");

        // Staggered, not simultaneous — see the header.
        const jobs: Array<[number, string, "hairstyle" | "projection"]> = [
          [0, next.hairstyles[0].imagePrompt, "hairstyle"],
          [1, next.hairstyles[1].imagePrompt, "hairstyle"],
          [2, next.projectionPrompt, "projection"],
        ];
        jobs.forEach(([i, prompt, kind], n) => {
          window.setTimeout(() => void render(i, dataUrl, prompt, kind), n * 400);
        });
      } catch {
        setPhase("error");
        setError(s.errGeneric);
      }
    },
    [locale, metrics, quiz, render, s, t],
  );

  const retry = (i: number) => {
    if (!photo || !advice) return;
    const prompt = i === 2 ? advice.projectionPrompt : advice.hairstyles[i].imagePrompt;
    void render(i, photo, prompt, i === 2 ? "projection" : "hairstyle");
  };

  return (
    <section className="panel p-[var(--pad-panel)]">
      <header className="flex items-start gap-3.5">
        <span
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-deep)]"
        >
          <Scissors className="h-5 w-5 text-[var(--color-accent)]" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--color-accent)]">
            {s.title}
          </h2>
          <p className="t-caption mt-1 leading-relaxed text-[var(--color-ink-secondary)]">
            {s.body}
          </p>
        </div>
      </header>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Reset first, so choosing the same file twice fires again.
          e.target.value = "";
          if (file) void start(file);
        }}
      />

      {phase === "idle" ? (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="interactive mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] py-2.5 text-[12.5px] font-semibold text-[var(--color-accent-ink)] hover:bg-[var(--color-accent-bright)]"
        >
          <Upload className="h-4 w-4" aria-hidden />
          {s.cta}
        </button>
      ) : null}

      {phase === "advising" ? (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-[var(--color-hairline)] px-4 py-3.5">
          <Sparkles className="h-4 w-4 shrink-0 animate-pulse text-[var(--color-accent)]" aria-hidden />
          <p className="t-caption text-[var(--color-ink-secondary)]">{s.analysing}</p>
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-2xl border border-[var(--color-caution)]/40 bg-[var(--color-caution)]/10 px-4 py-3">
          <p className="t-caption text-[var(--color-ink-secondary)]">{error}</p>
          <button
            type="button"
            onClick={() => {
              setPhase("idle");
              setError(null);
            }}
            className="interactive mt-2 text-[12px] font-semibold text-[var(--color-accent)]"
          >
            {s.retry}
          </button>
        </div>
      ) : null}

      <AnimatePresence>
        {advice ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="mt-5"
          >
            <div className="rounded-2xl border border-[var(--color-hairline)] px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--color-ink-tertiary)]">
                {s.faceShapeLabel}
              </p>
              <p className="mt-1 text-sm font-semibold text-[var(--color-ink)]">
                {s.shapes[advice.faceShape]}
              </p>
              <p className="t-caption mt-1.5 leading-relaxed text-[var(--color-ink-secondary)]">
                {advice.shapeNote}
              </p>
            </div>

            {advice.hairstyles.map((cut, i) => (
              <article key={i} className="mt-3 overflow-hidden rounded-2xl border border-[var(--color-hairline)]">
                <ImageSlot
                  slot={slots[i]}
                  alt={cut.name}
                  labels={s}
                  onRetry={() => retry(i)}
                  filename={`facescan-${i === 0 ? "cut-1" : "cut-2"}.webp`}
                />
                <div className="px-4 py-3.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="text-sm font-semibold text-[var(--color-ink)]">{cut.name}</h3>
                    <span className="shrink-0 rounded-full bg-[var(--color-accent-deep)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-accent)]">
                      {s.upkeep[cut.upkeep]}
                    </span>
                  </div>
                  <p className="t-caption mt-1.5 leading-relaxed text-[var(--color-ink-secondary)]">
                    {cut.reason}
                  </p>
                  <p className="mt-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--color-ink-tertiary)]">
                    {s.barberLabel}
                  </p>
                  <p className="t-caption mt-1 leading-relaxed text-[var(--color-ink-secondary)]">
                    {cut.barberBrief}
                  </p>
                </div>
              </article>
            ))}

            <article className="mt-3 overflow-hidden rounded-2xl border border-[var(--color-hairline)]">
              <ImageSlot
                slot={slots[2]}
                alt={s.projectionTitle}
                labels={s}
                onRetry={() => retry(2)}
                filename="facescan-projection.webp"
              />
              <div className="px-4 py-3.5">
                <h3 className="text-sm font-semibold text-[var(--color-ink)]">
                  {s.projectionTitle}
                </h3>
                <p className="t-caption mt-1.5 leading-relaxed text-[var(--color-ink-secondary)]">
                  {advice.projectionNote}
                </p>
                {/* Not a footnote by accident: a generated picture of someone's
                    future is a claim, and this is where it gets qualified. */}
                <p className="mt-2 text-[11px] leading-relaxed text-[var(--color-ink-tertiary)]">
                  {s.projectionDisclaimer}
                </p>
              </div>
            </article>

            <div className="mt-3.5 flex items-center justify-between gap-3">
              {remaining !== null ? (
                <p className="text-[11px] text-[var(--color-ink-tertiary)]">
                  {s.remaining.replace("{n}", String(remaining))}
                </p>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="interactive flex items-center gap-1.5 text-[12px] font-semibold text-[var(--color-accent)]"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                {s.again}
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}

/** One picture: its own spinner, its own failure, its own retry. */
function ImageSlot({
  slot,
  alt,
  labels,
  onRetry,
  filename,
}: {
  slot: Slot;
  alt: string;
  labels: { rendering: string; retry: string; save: string; errGeneric: string };
  onRetry: () => void;
  filename: string;
}) {
  return (
    <div className="relative aspect-square w-full bg-[var(--color-surface-sunken)]">
      {slot.status === "done" && slot.src ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <motion.img
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            src={slot.src}
            alt={alt}
            className="h-full w-full object-cover"
          />
          <a
            href={slot.src}
            download={filename}
            className="interactive absolute bottom-2.5 right-2.5 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-[11px] font-semibold text-white backdrop-blur"
          >
            <Download className="h-3 w-3" aria-hidden />
            {labels.save}
          </a>
        </>
      ) : slot.status === "error" ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
          <p className="t-caption text-[var(--color-ink-tertiary)]">
            {slot.error ?? labels.errGeneric}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="interactive text-[12px] font-semibold text-[var(--color-accent)]"
          >
            {labels.retry}
          </button>
        </div>
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-2.5">
          <ImageIcon
            className={`h-6 w-6 text-[var(--color-ink-tertiary)] ${slot.status === "loading" ? "animate-pulse" : ""}`}
            aria-hidden
          />
          {slot.status === "loading" ? (
            <p className="t-caption text-[var(--color-ink-tertiary)]">{labels.rendering}</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
