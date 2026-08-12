"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { compressForVision } from "@/lib/vision/compress";
import { useT } from "@/lib/i18n";

// The product image.
//
// A file picker rather than a URL box. Pasting an image URL means finding the
// image on Amazon, right-clicking, copying the address and hoping it is a
// direct link and not a page — which is four steps and produces a link that
// can rot. Picking a file from the phone is one step.
//
// THE IMAGE IS SHRUNK BEFORE IT IS SENT. A phone photo is several megabytes
// and Vercel's request body cap is 4.5 MB, so an unresized upload does not
// merely waste bandwidth, it fails on a good camera. The existing compressor
// from the scan path does the work; a product card renders at about 84px, so
// 900px on the long edge is already generous.
//
// The URL field survives as the fallback when no Blob store is connected,
// because a form field that cannot work is worse than a plainer one that can.

const MAX_EDGE = 900;
const QUALITY = 0.82;
const MAX_BYTES = 400_000;

/** data URL → Blob, so it can go into a FormData as a file. */
function dataUrlToBlob(dataUrl: string): Blob {
  const [head, b64] = dataUrl.split(",");
  const type = /data:([^;]+)/.exec(head)?.[1] ?? "image/jpeg";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(file);
  });

export function ImageField({
  value,
  onChange,
  uploads,
  inputClass,
}: {
  value: string;
  onChange: (url: string) => void;
  /** False when no Blob store is attached; then this is a URL box. */
  uploads: boolean;
  inputClass: string;
}) {
  const t = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      // Anything the browser will not decode is rejected here rather than
      // travelling to the server to be rejected there.
      if (!file.type.startsWith("image/")) {
        setError(t.admin.uploadNotImage);
        return;
      }

      const original = await readAsDataUrl(file);
      const small = await compressForVision(original, {
        maxEdge: MAX_EDGE,
        quality: QUALITY,
        maxBytes: MAX_BYTES,
      });

      const form = new FormData();
      form.append("file", dataUrlToBlob(small.dataUrl), "product.jpg");

      const res = await fetch("/api/admin/upload", { method: "POST", body: form });
      const data = (await res.json().catch(() => ({}))) as {
        url?: string;
        details?: string[];
        error?: string;
      };
      if (!res.ok || !data.url) {
        setError(data.details?.[0] ?? data.error ?? `HTTP ${res.status}`);
        return;
      }
      onChange(data.url);
    } catch {
      setError(t.admin.uploadFailed);
    } finally {
      setBusy(false);
      // Clear the input so picking the SAME file twice still fires a change.
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  if (!uploads) {
    return (
      <>
        <input
          className={inputClass}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://…"
          inputMode="url"
        />
        <p className="t-caption mt-1.5 text-[var(--color-ink-tertiary)]">
          {t.admin.uploadUnavailable}
        </p>
      </>
    );
  }

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => void pick(e.target.files?.[0])}
      />

      {value ? (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt=""
            className="h-20 w-20 shrink-0 rounded-[14px] bg-white/[0.04] object-cover"
          />
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              className="rounded-full border border-white/12 px-3 py-1.5 text-[12px] font-medium text-[var(--color-ink-secondary)] hover:border-white/25 disabled:opacity-40"
            >
              {busy ? t.admin.uploading : t.admin.replaceImage}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onChange("")}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] text-[var(--color-ink-tertiary)] hover:text-red-300 disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              {t.admin.removeImage}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="flex w-full flex-col items-center gap-2 rounded-[var(--r-control)] border border-dashed border-white/15 bg-white/[0.02] px-4 py-6 text-[var(--color-ink-tertiary)] transition-colors hover:border-white/30 hover:text-[var(--color-ink-secondary)] disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          ) : (
            <ImagePlus className="h-5 w-5" aria-hidden />
          )}
          <span className="text-[12.5px] font-medium">
            {busy ? t.admin.uploading : t.admin.pickImage}
          </span>
        </button>
      )}

      {error ? <p className="mt-2 text-[12px] text-red-300">{error}</p> : null}
    </div>
  );
}
