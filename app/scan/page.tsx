"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FaceMesh } from "@/components/dashboard/FaceMesh";
import { useFunnel } from "@/lib/store";

// Loading THEATER over REAL computation: MediaPipe FaceLandmarker runs
// concurrently while the beam animation plays. Every line below names a
// step that actually executes in lib/analysis.ts — presentation, not
// fabrication. The pacing is fixed so the screen always feels the same.
const LINES = [
  "Loading FaceLandmarker model…",
  "Detecting face region…",
  "Mapping 478 facial landmarks…",
  "Correcting head roll from canthi axis…",
  "Measuring canthal tilt…",
  "Analyzing jawline contour…",
  "Computing bilateral symmetry…",
  "Scoring facial proportions…",
  "Compiling your action plan…",
] as const;

const SCAN_MS = 10_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function ScanPage() {
  const router = useRouter();
  const { photos, completeScan } = useFunnel();
  const started = useRef(false);
  const [progress, setProgress] = useState(0);
  const [lineIdx, setLineIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    // Dev-only shortcut to test downstream screens without a face photo.
    const demo =
      process.env.NODE_ENV === "development" &&
      window.location.search.includes("demo=1");

    const front = useFunnel.getState().photos.front;
    if (!front && !demo) {
      router.replace("/upload");
      return;
    }

    const t0 = Date.now();
    const tick = setInterval(() => {
      const elapsed = Date.now() - t0;
      setProgress(Math.min(99, (elapsed / SCAN_MS) * 100));
      setLineIdx(
        Math.min(LINES.length - 1, Math.floor(elapsed / (SCAN_MS / LINES.length))),
      );
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
        setError(
          e instanceof Error && e.message === "no-face"
            ? "We couldn't detect a face in your front photo. Use even lighting, face the camera directly, and make sure your whole face is visible."
            : "The on-device analysis model could not be loaded. Check your connection (the model downloads once) and try again.",
        );
      }
    })();

    return () => clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-6">
        <div className="glass-deep w-full max-w-md rounded-3xl p-8 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-amber-400" />
          <h1 className="mt-6 text-xl font-semibold">Scan failed</h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">{error}</p>
          <div className="mt-8 flex justify-center gap-3">
            <Link href="/upload">
              <Button variant="outline">Back to photos</Button>
            </Link>
            <Button onClick={() => window.location.reload()}>Try again</Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col justify-center px-6 py-16">
      <div className="grid gap-6 sm:grid-cols-2">
        <FaceMesh
          src={photos.front?.dataUrl}
          mesh={null}
          aspect={0.8}
          scanning
        />
        <FaceMesh
          src={photos.side?.dataUrl}
          mesh={null}
          aspect={0.8}
          scanning
        />
      </div>

      {/* Terminal readout */}
      <div className="glass mt-8 rounded-2xl p-5">
        <div className="font-mono-terminal flex items-center gap-2 text-xs text-accent">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent" />
          {LINES[lineIdx]}
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-500">
          <span>Running locally in your browser — nothing is uploaded.</span>
          <span className="font-mono-terminal tabular-nums">
            {Math.floor(progress)}%
          </span>
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-zinc-600">
        Keep this tab open until the analysis completes.
      </p>
    </main>
  );
}
