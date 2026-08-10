"use client";

import { useRef, useState } from "react";
import { Check, Plus, RotateCcw } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { PhotoData } from "@/lib/store";
import { cn } from "@/lib/cn";

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Upload slot.
 *
 * Deliberately not a dashed rounded box with a big icon — that reads as an
 * unfinished form field. This is a framed capture target: a hairline plate,
 * corner registration marks, the silhouette as a faint guide, and a small
 * label bar along the bottom. It should look like the viewfinder of an
 * instrument, which is what the rest of the product looks like.
 */
export function PhotoDrop({
  label,
  badge,
  hint,
  silhouette,
  value,
  onPhoto,
}: {
  label: string;
  badge?: string;
  hint: string;
  silhouette: React.ReactNode;
  value?: PhotoData;
  onPhoto: (photo: PhotoData) => void;
}) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = (file: File | undefined) => {
    setError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError(t.upload.errType);
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(t.upload.errSize);
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      onPhoto({ dataUrl: String(reader.result), name: file.name });
    reader.readAsDataURL(file);
  };

  const corners = [
    "left-0 top-0 border-l border-t",
    "right-0 top-0 border-r border-t",
    "left-0 bottom-0 border-b border-l",
    "right-0 bottom-0 border-b border-r",
  ] as const;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFile(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          "group relative flex aspect-[3/4] w-full flex-col overflow-hidden rounded-2xl border transition-all duration-200",
          "bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.012))]",
          dragging
            ? "border-accent/70 shadow-[0_0_0_3px_rgba(149,191,71,0.12)]"
            : value
              ? "border-white/[0.14]"
              : "border-white/[0.10] hover:border-white/25",
        )}
      >
        {value ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value.dataUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/85 via-transparent to-zinc-950/20" />
            <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-canvas)]/60 opacity-0 backdrop-blur-[2px] transition-opacity duration-200 group-hover:opacity-100">
              <span className="flex items-center gap-1.5 rounded-full border border-white/20 bg-[var(--color-canvas)]/60 px-3 py-1.5 text-[11px] font-medium">
                <RotateCcw className="h-3 w-3" /> {t.upload.replace}
              </span>
            </div>
          </>
        ) : (
          <>
            {/* Faint measurement grid — the same visual language as the scan */}
            <div
              aria-hidden
              className="absolute inset-0 opacity-[0.055]"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,0.9) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.9) 1px, transparent 1px)",
                backgroundSize: "26px 26px",
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-[58%] w-[58%] text-[var(--color-ink-quaternary)] transition-colors duration-200 group-hover:text-[var(--color-ink-tertiary)]">
                {silhouette}
              </div>
            </div>
            <div className="absolute inset-x-0 top-4 flex justify-center">
              <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-[var(--color-ink-secondary)] transition-colors group-hover:border-accent/50 group-hover:text-accent">
                <Plus className="h-3.5 w-3.5" />
              </span>
            </div>
          </>
        )}

        {/* Registration marks */}
        {corners.map((c) => (
          <span
            key={c}
            aria-hidden
            className={cn(
              "pointer-events-none absolute m-2.5 h-3.5 w-3.5 transition-colors duration-200",
              c,
              value || dragging ? "border-accent/70" : "border-white/20",
            )}
          />
        ))}

        {/* Label bar */}
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 border-t border-white/[0.07] bg-[var(--color-canvas)]/55 px-3 py-2 backdrop-blur-sm">
          {value ? (
            <Check className="h-3 w-3 shrink-0 text-accent" />
          ) : (
            <span className="h-1 w-1 shrink-0 rounded-full bg-zinc-600" />
          )}
          <span className="truncate text-[11px] font-medium tracking-wide text-[var(--color-ink)]">
            {label}
          </span>
          {badge && !value ? (
            <span className="ml-auto shrink-0 font-mono-terminal t-eyebrow text-[var(--color-ink-tertiary)]">
              {badge}
            </span>
          ) : null}
        </div>
      </button>

      <p className="px-0.5 text-[11px] leading-snug text-[var(--color-ink-tertiary)]">
        {value ? `${label} · ${t.upload.added}` : hint}
      </p>
      {error ? <p className="px-0.5 text-[11px] text-red-400">{error}</p> : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}
