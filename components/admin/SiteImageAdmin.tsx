"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, RotateCcw } from "lucide-react";
import { ImageField } from "./ImageField";
import { SLOT_SPECS, type ImageSlot, type SiteImages } from "@/lib/site-images";
import { useT } from "@/lib/i18n";

// The home-page artwork, editable without a deploy.
//
// EVERY SLOT SHOWS ITS DEFAULT WHEN EMPTY, and says so. An empty field here
// does not mean "no picture", it means "the shipped one" — and an editor that
// renders that as a blank box teaches the owner that they have broken
// something. The preview is the answer: it always shows what the page will
// actually render.
//
// Saved as a set, not per field. Everything is on screen at once, so what
// this posts IS the intended state, and clearing a field can mean "go back to
// the default" rather than being indistinguishable from not touching it.

interface SlotInfo {
  slot: ImageSlot;
  label: string;
  hint: string;
  fallback: string;
  aspect: string;
}

export function SiteImageAdmin() {
  const t = useT();
  const [slots, setSlots] = useState<SlotInfo[]>([]);
  const [images, setImages] = useState<SiteImages>({});
  const [uploads, setUploads] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/site-images", { cache: "no-store" });
      const data = (await res.json()) as {
        images?: SiteImages;
        slots?: SlotInfo[];
        uploads?: boolean;
      };
      setImages(data.images ?? {});
      setSlots(data.slots ?? []);
      setUploads(Boolean(data.uploads));
    } catch {
      setError(t.admin.images.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [t.admin.images.loadFailed]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/site-images", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        images?: SiteImages;
        error?: string;
        details?: string;
        slots?: string[];
      };
      if (!res.ok) {
        setError(data.details ?? data.error ?? `HTTP ${res.status}`);
        return;
      }
      setImages(data.images ?? {});
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch {
      setError(t.admin.images.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  const set = (slot: ImageSlot, url: string) =>
    setImages((prev) => {
      const next = { ...prev };
      if (url.trim().length === 0) delete next[slot];
      else next[slot] = url;
      return next;
    });

  if (loading) {
    return (
      <p className="t-caption py-6 text-[var(--color-ink-tertiary)]">{t.admin.loading}</p>
    );
  }

  return (
    <section className="mt-10">
      <header>
        <h2 className="t-title3">{t.admin.images.title}</h2>
        <p className="t-caption mt-1.5 leading-relaxed text-[var(--color-ink-secondary)]">
          {t.admin.images.body}
        </p>
      </header>

      <div className="mt-5 flex flex-col gap-5">
        {slots.map((info) => {
          const current = images[info.slot] ?? "";
          const shown = current || SLOT_SPECS[info.slot]?.fallback || info.fallback;
          return (
            <article
              key={info.slot}
              className="rounded-[var(--r-card)] border border-white/10 bg-white/[0.02] p-4"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-[13px] font-semibold text-[var(--color-ink)]">
                  {info.label}
                </h3>
                {current ? (
                  <button
                    type="button"
                    onClick={() => set(info.slot, "")}
                    className="flex items-center gap-1.5 text-[11.5px] text-[var(--color-ink-tertiary)] hover:text-[var(--color-ink-secondary)]"
                  >
                    <RotateCcw className="h-3 w-3" aria-hidden />
                    {t.admin.images.reset}
                  </button>
                ) : (
                  <span className="text-[11.5px] text-[var(--color-ink-tertiary)]">
                    {t.admin.images.usingDefault}
                  </span>
                )}
              </div>

              <p className="t-caption mt-1 leading-relaxed text-[var(--color-ink-tertiary)]">
                {info.hint}
              </p>

              <div className="mt-3.5 grid gap-3.5 sm:grid-cols-[minmax(0,1fr)_150px]">
                <div>
                  <ImageField
                    value={current}
                    onChange={(url) => set(info.slot, url)}
                    uploads={uploads}
                    inputClass={inputClass}
                  />
                </div>

                {/* Always the resolved picture — what the page will render. */}
                <div
                  className="flex items-center justify-center overflow-hidden rounded-[var(--r-control)] border border-white/10 bg-[var(--color-canvas)] p-2"
                  style={{ aspectRatio: info.aspect }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={shown}
                    alt=""
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {error ? <p className="mt-3 text-[12.5px] text-red-300">{error}</p> : null}

      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className="interactive mt-5 flex items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] px-5 py-2.5 text-[13px] font-semibold text-[var(--color-accent-ink)] hover:bg-[var(--color-accent-bright)] disabled:opacity-50"
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : saved ? (
          <Check className="h-4 w-4" aria-hidden />
        ) : null}
        {saving ? t.admin.saving : saved ? t.admin.images.saved : t.admin.save}
      </button>
    </section>
  );
}

const inputClass =
  "w-full rounded-[var(--r-control)] border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[14px] text-[var(--color-ink)] outline-none placeholder:text-[var(--color-ink-quaternary)] focus:border-[var(--color-accent)]/50";
