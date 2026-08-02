"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FaceMesh } from "@/components/dashboard/FaceMesh";
import { useT } from "@/lib/i18n";
import { useFunnel } from "@/lib/store";

// Loading THEATER over REAL computation: MediaPipe FaceLandmarker runs
// concurrently while the beam animation plays. Every line names a step that
// actually executes in lib/analysis.ts — presentation, not fabrication.
const SCAN_MS = 10_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function ScanPage() {
  const router = useRouter();
  const t = useT();
  const { photos, completeScan } = useFunnel();
  const started = useRef(false);
  const [progress, setProgress] = useState(0);
  const [lineIdx, setLineIdx] = useState(0);
  const [error, setError] = useState<"noFace" | "model" | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const params = new URLSearchParams(window.location.search);
    if (params.has("raw")) sessionStorage.setItem("facescan.raw", "1");

    const demo =
      process.env.NODE_ENV === "development" && params.get("demo") === "1";

    const front = useFunnel.getState().photos.front;
    if (!front && !demo) {
      router.replace("/upload");
      return;
    }

    const lineCount = 9;
    const t0 = Date.now();
    const tick = setInterval(() => {
      const elapsed = Date.now() - t0;
      setProgress(Math.min(99, (elapsed / SCAN_MS) * 100));
      setLineIdx(Math.min(lineCount - 1, Math.floor(elapsed / (SCAN_MS / lineCount))));
    }, 80);

    (async () => {
      try {
        const analysis = await import("@/lib/analysis");
        let metrics;
        if (demo) {
          metrics = analysis.demoMetrics(front?.name ?? "demo");
        } else {
          const img = await analysis.loadImage(front!.dataUrl);
          metrics = await analysis.analyzeFront(img);
          if (!metrics) throw new Error("no-face");

          // Overlay for the side shot too. Only the front photo drives the
          // measurements; a failed detection here is not an error, it just
          // means that panel shows the grid instead of a mesh.
          const side = useFunnel.getState().photos.side;
          if (side) {
            try {
              const sideImg = await analysis.loadImage(side.dataUrl);
              const detected = await analysis.detectMesh(sideImg);
              if (detected) {
                metrics.sideMesh = detected.mesh;
                metrics.sideAspect = detected.aspect;
              }
            } catch {
              /* keep the grid fallback */
            }
          }
        }

        const remaining = SCAN_MS - (Date.now() - t0);
        if (remaining > 0) await sleep(remaining);
        clearInterval(tick);
        setProgress(100);
        completeScan(metrics);
        await sleep(450);
        router.push("/results");
      } catch (e) {
        clearInterval(tick);
        setError(e instanceof Error && e.message === "no-face" ? "noFace" : "model");
      }
    })();

    return () => clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-6">
        <div className="glass-strong w-full max-w-md rounded-[30px] p-8 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-amber-400" />
          <h1 className="mt-6 text-xl font-semibold tracking-tight">
            {t.scan.failedTitle}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            {error === "noFace" ? t.scan.errNoFace : t.scan.errModel}
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link href="/upload">
              <Button variant="outline">{t.scan.backToPhotos}</Button>
            </Link>
            <Button onClick={() => window.location.reload()}>{t.scan.retry}</Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col justify-center px-6 py-16">
      <div className="grid grid-cols-2 gap-3 sm:gap-5">
        <FaceMesh
          src={photos.front?.dataUrl}
          mesh={null}
          aspect={0.8}
          label={t.scan.front}
          className="aspect-[3/4]"
          scanning
        />
        <FaceMesh
          src={photos.side?.dataUrl}
          mesh={null}
          aspect={0.8}
          label={t.scan.side}
          className="aspect-[3/4]"
          scanning
        />
      </div>

      <div className="glass mt-8 rounded-[26px] p-6">
        <div className="font-mono-terminal flex items-center gap-2 text-xs text-accent">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent" />
          {t.scan.lines[lineIdx]}
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-500">
          <span>{t.scan.running}</span>
          <span className="font-mono-terminal tabular-nums">
            {Math.floor(progress)}%
          </span>
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-zinc-600">{t.scan.keepOpen}</p>
    </main>
  );
}
