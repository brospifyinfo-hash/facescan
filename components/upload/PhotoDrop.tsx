"use client";

import { useRef, useState } from "react";
import { CheckCircle2, ImageUp } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { PhotoData } from "@/lib/store";
import { cn } from "@/lib/cn";

const MAX_BYTES = 10 * 1024 * 1024;

export function PhotoDrop({
  label,
  hint,
  silhouette,
  value,
  onPhoto,
}: {
  label: string;
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
          "group glass relative flex aspect-[4/5] w-full flex-col items-center justify-center overflow-hidden rounded-[28px] transition-all duration-200",
          dragging && "border-accent/60 bg-accent/[0.06]",
          !value && !dragging && "hover:bg-white/[0.06]",
        )}
      >
        {value ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value.dataUrl}
              alt={label}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/85 via-transparent to-transparent" />
            <div className="absolute bottom-4 left-4 flex items-center gap-2 text-sm font-medium text-accent">
              <CheckCircle2 className="h-4 w-4" /> {label} {t.upload.added}
            </div>
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/55 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
              <span className="glass rounded-full px-4 py-2 text-sm">
                {t.upload.replace}
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="h-40 w-40 text-zinc-600 transition-colors group-hover:text-zinc-500">
              {silhouette}
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm font-medium text-zinc-200">
              <ImageUp className="h-4 w-4 text-accent" /> {label}
            </div>
            <p className="mt-1 max-w-[85%] text-center text-xs text-zinc-500">
              {hint}
            </p>
          </>
        )}
      </button>
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
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
