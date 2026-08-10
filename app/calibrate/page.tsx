"use client";

// Calibration harness — rated faces in, measured offsets out.
//
// WHAT THIS SOLVES
// ----------------
// The scorer compares a landmark mesh against caliper anthropometry. Those
// are different quantities, and the difference is a constant every user
// shares. Uncorrected, the scorer reads it as "this person deviates" and
// marks everyone down identically. It cannot be derived — only measured, by
// running the real pipeline over real photographs.
//
// WHAT IT DOES WITH FIVE FACES, AND WHAT IT DOES NOT
// --------------------------------------------------
// With a handful of rated faces this can do two useful things:
//
//   * estimate the mesh-vs-caliper OFFSET per measurement (one number per
//     measurement, from the median across all faces), and
//   * check whether the model's ORDERING agrees with the ratings, via
//     Spearman's rank correlation.
//
// What it cannot do is fit the 25-coefficient regression in training.ts.
// Twenty-five coefficients from five samples is not a fit, it is
// memorisation — it would reproduce these five perfectly and predict
// nothing. The button for that stays disabled below thirty faces, and says
// why.
//
// Everything runs on-device, exactly like the real scan. No upload.

import { useCallback, useRef, useState } from "react";
import { Check, ClipboardCopy, Loader2, Upload, X } from "lucide-react";
import { analyzeFront, loadImage } from "@/lib/analysis";
import { NORMS, MEASUREMENT_IDS, type MeasurementId } from "@/lib/analysis/norms";
import { referenceOf } from "@/lib/analysis/modules";

interface Sample {
  name: string;
  /** The human rating, 1–10. */
  rating: number;
  /** Model score, for comparison. */
  score: number;
  confidence: number;
  values: Partial<Record<MeasurementId, number>>;
  issues: string[];
}

const median = (a: number[]) => {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Spearman's rho — rank correlation, robust to the scale being nonlinear. */
function spearman(a: number[], b: number[]): number {
  const rank = (v: number[]) => {
    const idx = v.map((x, i) => [x, i] as const).sort((p, q) => p[0] - q[0]);
    const r = new Array(v.length).fill(0);
    idx.forEach(([, i], k) => (r[i] = k + 1));
    return r;
  };
  const ra = rank(a);
  const rb = rank(b);
  const n = a.length;
  const ma = ra.reduce((s, v) => s + v, 0) / n;
  const mb = rb.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    num += (ra[i] - ma) * (rb[i] - mb);
    da += (ra[i] - ma) ** 2;
    db += (rb[i] - mb) ** 2;
  }
  return num / (Math.sqrt(da * db) || 1e-12);
}

/** Faces needed before fitting coefficients is anything but memorisation. */
const MIN_FOR_FIT = 30;

export default function CalibratePage() {
  const [samples, setSamples] = useState<Sample[]>([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string[]>([]);
  const [rating, setRating] = useState(5);
  const [copied, setCopied] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const ingest = useCallback(async (files: FileList | null, r: number) => {
    if (!files?.length) return;
    setBusy(true);
    const bad: string[] = [];
    const next: Sample[] = [];

    for (const file of Array.from(files)) {
      try {
        const dataUrl = await new Promise<string>((res, rej) => {
          const fr = new FileReader();
          fr.onload = () => res(fr.result as string);
          fr.onerror = () => rej(fr.error);
          fr.readAsDataURL(file);
        });
        const img = await loadImage(dataUrl);
        const m = await analyzeFront(img);
        if (!m) {
          bad.push(file.name);
          continue;
        }
        next.push({
          name: file.name,
          rating: r,
          score: m.overall,
          confidence: m.confidence,
          issues: m.qualityIssues,
          values: Object.fromEntries(
            (m.report?.measurements ?? []).map((x) => [x.id, x.value]),
          ),
        });
      } catch {
        bad.push(file.name);
      }
    }

    setSamples((s) => [...s, ...next]);
    setFailed((f) => [...f, ...bad]);
    setBusy(false);
  }, []);

  // Per-measurement offset: the median z across all rated faces. If the mesh
  // reads a measurement consistently high for everyone, that is the
  // definitional difference, not a property of any of these faces.
  const rows = MEASUREMENT_IDS.map((id) => {
    const norm = NORMS[id];
    const ref = referenceOf(norm, id);
    const zs = samples
      .map((s) => s.values[id])
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v))
      .map((v) => (v - ref) / norm.sd);
    return { id, grade: norm.grade, n: zs.length, offset: median(zs) };
  });

  const offsets = Object.fromEntries(
    rows
      .filter((r) => Number.isFinite(r.offset) && Math.abs(r.offset) > 0.05)
      .map((r) => [r.id, Number(r.offset.toFixed(3))]),
  );

  const rho =
    samples.length >= 3
      ? spearman(samples.map((s) => s.rating), samples.map((s) => s.score))
      : NaN;

  const block = `export const CALIBRATION: CalibrationSet = {
  offsets: ${JSON.stringify(offsets, null, 4).replace(/\n/g, "\n  ")},
  n: ${samples.length},
  provenance: "${samples.length} rated faces, ${new Date().toISOString().slice(0, 10)}",
};`;

  const fmt = (v: number, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : "—");

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <h1 className="text-xl font-semibold tracking-tight">🔧 Kalibrierung</h1>
      <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-[var(--color-ink-secondary)]">
        Stell die Bewertung ein, die du dem Gesicht geben würdest, und lade dann
        das Bild dazu hoch. Wiederhole das pro Bild. Alles läuft lokal im
        Browser, nichts wird hochgeladen. Am Ende unten auf „Kopieren“.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-[12px] text-[var(--color-ink-secondary)]">
          Bewertung
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={rating}
            onChange={(e) => setRating(Number(e.target.value))}
            className="w-40 accent-[var(--color-accent)]"
          />
          <span className="w-10 text-center text-[15px] font-semibold tabular-nums text-[var(--color-ink)]">
            {rating}
          </span>
          <span className="text-[var(--color-ink-tertiary)]">/ 10</span>
        </label>

        <button
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
          className="fill interactive ml-auto flex items-center gap-2 rounded-full px-4 py-2 text-[12px] text-[var(--color-ink)] disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          Bild(er) mit Bewertung {rating} hinzufügen
        </button>
        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            void ingest(e.target.files, rating);
            e.target.value = "";
          }}
        />
      </div>

      {failed.length > 0 ? (
        <p className="mt-3 text-[11px] text-amber-400">
          <X className="inline h-3 w-3" /> kein Gesicht erkannt: {failed.join(", ")}
        </p>
      ) : null}

      {samples.length > 0 ? (
        <>
          <div className="surface mt-5 overflow-x-auto p-4">
            <table className="w-full text-left text-[11px]">
              <thead>
                <tr className="border-b border-white/10 text-[var(--color-ink-tertiary)]">
                  <th className="pb-2 font-medium">Datei</th>
                  <th className="pb-2 text-right font-medium">deine Note</th>
                  <th className="pb-2 text-right font-medium">Modell</th>
                  <th className="pb-2 text-right font-medium">Differenz</th>
                  <th className="pb-2 text-right font-medium">Confidence</th>
                </tr>
              </thead>
              <tbody className="font-mono-terminal">
                {samples.map((s, i) => (
                  <tr key={i} className="border-b border-white/[0.05] last:border-0">
                    <td className="py-1.5 text-[var(--color-ink-secondary)]">{s.name}</td>
                    <td className="py-1.5 text-right tabular-nums text-[var(--color-ink)]">
                      {s.rating}
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-[var(--color-ink)]">
                      {s.score.toFixed(1)}
                    </td>
                    <td
                      className={`py-1.5 text-right tabular-nums ${
                        Math.abs(s.score - s.rating) > 2
                          ? "text-amber-400"
                          : "text-[var(--color-ink-tertiary)]"
                      }`}
                    >
                      {(s.score - s.rating > 0 ? "+" : "") +
                        (s.score - s.rating).toFixed(1)}
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-[var(--color-ink-tertiary)]">
                      {(s.confidence * 100).toFixed(0)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-4 border-t border-white/10 pt-3 text-[11px] text-[var(--color-ink-secondary)]">
              <p>
                Rangkorrelation (Spearman ρ):{" "}
                <strong
                  className={
                    rho > 0.7 ? "text-accent" : rho > 0.3 ? "text-[var(--color-ink)]" : "text-amber-400"
                  }
                >
                  {fmt(rho)}
                </strong>{" "}
                <span className="text-[var(--color-ink-tertiary)]">
                  {samples.length < 3
                    ? "(braucht mindestens 3 Gesichter)"
                    : "— 1.0 = gleiche Reihenfolge wie deine Noten, 0 = keinerlei Zusammenhang"}
                </span>
              </p>
              <p className="mt-1.5">
                Regressionsmodell fitten:{" "}
                <strong className={samples.length >= MIN_FOR_FIT ? "text-accent" : "text-[var(--color-ink-tertiary)]"}>
                  {samples.length} / {MIN_FOR_FIT} Gesichter
                </strong>{" "}
                <span className="text-[var(--color-ink-tertiary)]">
                  — 25 Koeffizienten aus weniger als {MIN_FOR_FIT} Beispielen wäre
                  Auswendiglernen, kein Fit.
                </span>
              </p>
            </div>
          </div>

          <div className="surface mt-3 overflow-x-auto p-4">
            <h2 className="text-[13px] font-semibold text-[var(--color-ink)]">
              Gemessener Versatz je Metrik (in Standardabweichungen)
            </h2>
            <p className="mt-1 t-caption leading-relaxed text-[var(--color-ink-tertiary)]">
              Median über alle Gesichter. Ein Wert weit von 0 heißt: der Mesh
              misst diese Größe für <em>jeden</em> anders als die Zirkel-Norm —
              das ist der Definitionsunterschied, nicht das Gesicht.
            </p>
            <table className="mt-3 w-full text-left text-[11px]">
              <tbody className="font-mono-terminal">
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-white/[0.05] last:border-0">
                    <td className="py-1 text-[var(--color-ink-secondary)]">{r.id}</td>
                    <td className="py-1 text-right text-[var(--color-ink-tertiary)]">{r.grade}</td>
                    <td
                      className={`py-1 text-right tabular-nums ${
                        Math.abs(r.offset) > 1.5
                          ? "text-amber-400"
                          : Math.abs(r.offset) > 0.5
                            ? "text-[var(--color-ink)]"
                            : "text-[var(--color-ink-tertiary)]"
                      }`}
                    >
                      {fmt(r.offset)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(block);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                /* selectable below */
              }
            }}
            className="mt-4 flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-[12px] font-semibold text-black"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
            {copied ? "Kopiert" : "Kalibrierung kopieren"}
          </button>

          <pre className="mt-4 max-h-80 overflow-auto rounded-xl bg-black/40 p-3 t-caption leading-relaxed text-[var(--color-ink-secondary)]">
            {block}
          </pre>
        </>
      ) : null}
    </main>
  );
}
