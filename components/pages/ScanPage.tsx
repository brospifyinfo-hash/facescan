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
// Floor, not a fixed duration: the screen ends as soon as the real analysis
// is done, and only waits out the remainder if the model finished sooner.
// Ten seconds of padding was most of the wait — the computation itself is
// well under a second once the model is cached.
const MIN_MS = 3_400;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Roughly how long the active engine takes, used to PACE the bar.
 *
 * Measured, not guessed: a GPT-4.1 call returning 25 measurements, nine
 * modules and a quality block took 7 s on a trivial image and longer on a
 * real face (scripts/smoke-vision.mts prints the figure). The on-device
 * pipeline is ~200 ms once the WASM model is cached, so MIN_MS is the whole
 * wait there.
 *
 * This is a pacing hint for the animation and nothing else. Both paths
 * still end the instant the real work ends.
 */
const PACE_MS = (vision: boolean) => (vision ? 16_000 : MIN_MS);

/**
 * Progress that approaches the ceiling instead of hitting it.
 *
 * The previous curve was linear against MIN_MS and clamped at 97, which was
 * right when the whole wait WAS MIN_MS. Against a network call it pins at
 * 97% after 3.4 s and then sits there — and a bar frozen at 97 reads as a
 * hung page, which is worse than an honest slow one.
 *
 * An exponential approach never stalls: it is still visibly moving at 30 s,
 * and it cannot reach 100 before the work does.
 */
const progressAt = (elapsed: number, pace: number) =>
  97 * (1 - Math.exp(-elapsed / (pace / 2.5)));

/**
 * Which engine scores the face.
 *
 * "vision" routes the analysis through GPT-4.1 (lib/vision/), which then
 * owns every value including the rating. "geometry" keeps the on-device
 * pipeline. Unset means geometry, so nothing changes for a deployment that
 * has not set an OpenAI key.
 *
 * The vision path is slower than the local one — a network round trip
 * instead of ~200 ms of WASM — which is why MIN_MS stays a floor rather
 * than becoming a target: the screen still ends when the work ends.
 */
const USE_VISION = process.env.NEXT_PUBLIC_SCORE_ENGINE === "vision";

/**
 * The vision path: GPT-4.1 scores the face, MediaPipe only draws the mesh.
 *
 * The two run CONCURRENTLY. The overlay detection is ~200 ms of WASM and
 * the vision call is seven to twenty seconds of network; running them in
 * sequence would add the smaller to the larger for no reason. Neither
 * overlay is allowed to fail the scan — the mesh is decoration, the rating
 * is the product.
 */
async function runVisionScan(
  analysis: typeof import("@/lib/analysis"),
  frontDataUrl: string,
) {
  const { analyzeWithVision, NO_OVERLAY } = await import("@/lib/vision/client");
  const side = useFunnel.getState().photos.side ?? null;

  const overlay = (async () => {
    try {
      const img = await analysis.loadImage(frontDataUrl);
      const front = await analysis.detectFrontOverlay(img);
      // No face for MediaPipe still leaves a usable aspect ratio, and GPT
      // may well find the face the local detector missed.
      if (!front) return { ...NO_OVERLAY, aspect: img.naturalWidth / img.naturalHeight };

      let sideMesh = null;
      let sideAspect = null;
      if (side) {
        try {
          const detected = await analysis.detectMesh(await analysis.loadImage(side.dataUrl));
          if (detected) {
            sideMesh = detected.mesh;
            sideAspect = detected.aspect;
          }
        } catch {
          /* keep the grid fallback */
        }
      }
      return { ...front, sideMesh, sideAspect };
    } catch {
      return NO_OVERLAY;
    }
  })();

  const [resolved, scan] = await Promise.all([
    overlay,
    analyzeWithVision({ frontDataUrl, sideDataUrl: side?.dataUrl ?? null }),
  ]);

  return { ...scan, ...resolved };
}

export function ScanPage() {
  const router = useRouter();
  const t = useT();
  const { photos, completeScan } = useFunnel();
  const started = useRef(false);
  const [progress, setProgress] = useState(0);
  const [lineIdx, setLineIdx] = useState(0);
  const [error, setError] = useState<"noFace" | "model" | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

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
    const pace = PACE_MS(USE_VISION && !demo);
    const t0 = Date.now();
    const tick = setInterval(() => {
      const elapsed = Date.now() - t0;
      setProgress(progressAt(elapsed, pace));
      setLineIdx(Math.min(lineCount - 1, Math.floor(elapsed / (pace / lineCount))));
    }, 60);

    (async () => {
      try {
        const analysis = await import("@/lib/analysis");
        let metrics;
        if (demo) {
          metrics = analysis.demoMetrics(front?.name ?? "demo");
        } else if (USE_VISION) {
          metrics = await runVisionScan(analysis, front!.dataUrl);
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

        const remaining = MIN_MS - (Date.now() - t0);
        if (remaining > 0) await sleep(remaining);
        clearInterval(tick);
        setProgress(100);
        completeScan(metrics);
        await sleep(300);
        router.push("/results");
      } catch (e) {
        clearInterval(tick);
        if (e instanceof Error && e.message === "no-face") {
          setError("noFace");
        } else {
          setError("model");
          // The vision route returns a message that says what to do about
          // it — a timeout, a rate limit and a refusal need different
          // actions from the user and the generic string covers none of them.
          if (e instanceof Error && "kind" in e) setErrorDetail(e.message);
        }
      }
    })();

    return () => clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-6">
        <div className="surface-raised w-full max-w-md p-8 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-amber-400" />
          <h1 className="mt-6 text-xl font-semibold tracking-tight">
            {t.scan.failedTitle}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[var(--color-ink-secondary)]">
            {error === "noFace" ? t.scan.errNoFace : (errorDetail ?? t.scan.errModel)}
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
      {/* Only render the side panel when a side photo exists — it is optional. */}
      <div
        className={
          photos.side
            ? "grid grid-cols-2 gap-3 sm:gap-5"
            : "mx-auto w-full max-w-[280px]"
        }
      >
        <FaceMesh
          src={photos.front?.dataUrl}
          mesh={null}
          aspect={0.8}
          label={t.scan.front}
          className="aspect-[3/4]"
          scanning
        />
        {photos.side ? (
          <FaceMesh
            src={photos.side.dataUrl}
            mesh={null}
            aspect={0.8}
            label={t.scan.side}
            className="aspect-[3/4]"
            scanning
          />
        ) : null}
      </div>

      <div className="surface mt-8 p-6">
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
        <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--color-ink-tertiary)]">
          <span>{t.scan.running}</span>
          <span className="font-mono-terminal tabular-nums">
            {Math.floor(progress)}%
          </span>
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-[var(--color-ink-tertiary)]">{t.scan.keepOpen}</p>
    </main>
  );
}
