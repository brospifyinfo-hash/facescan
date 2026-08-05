"use client";

// Calibration harness.
//
// The scoring model is internally consistent — 60 000 synthetic faces built
// from Farkas millimetre tables spread cleanly around a median of 5.8. Real
// photos score ~3. That gap is a MEASUREMENT OFFSET, not a scoring bug:
// what MediaPipe reads off a photograph sits systematically beside what
// caliper anthropometry describes, and the scorer cannot tell a constant
// offset apart from an unattractive face.
//
// The offset cannot be derived from first principles, only measured. This
// page measures it. Drop in a batch of photos, mark each one "average" or
// "attractive", and it reports, per metric, where the mesh actually lands
// against the band it is being judged by.
//
//   bias      = median(average group) − band centre
//   separation= median(attractive group) − median(average group)
//
// `bias` is what gets subtracted from the bands. `separation` is the
// sanity check: if a metric does not separate the two groups, it carries no
// aesthetic signal and its weight should go down.
//
// Everything runs on-device, exactly like the real scan. No upload.

import { useCallback, useRef, useState } from "react";
import { Check, ClipboardCopy, Loader2, Upload, X } from "lucide-react";
import { analyzeFront, loadImage } from "@/lib/analysis";
import { METRIC_ORDER, SPECS } from "@/lib/specs";
import type { MetricId } from "@/lib/metrics";

type Group = "average" | "attractive";

interface Sample {
  name: string;
  group: Group;
  values: Partial<Record<MetricId, number>>;
  overall: number;
  symmetry: number;
}

const median = (a: number[]) => {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export default function CalibratePage() {
  const [samples, setSamples] = useState<Sample[]>([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string[]>([]);
  const [group, setGroup] = useState<Group>("average");
  const [copied, setCopied] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const ingest = useCallback(
    async (files: FileList | null, g: Group) => {
      if (!files?.length) return;
      setBusy(true);
      const bad: string[] = [];
      const next: Sample[] = [];

      for (const file of Array.from(files)) {
        try {
          const dataUrl = await new Promise<string>((res, rej) => {
            const r = new FileReader();
            r.onload = () => res(r.result as string);
            r.onerror = () => rej(r.error);
            r.readAsDataURL(file);
          });
          const img = await loadImage(dataUrl);
          const m = await analyzeFront(img);
          if (!m) {
            bad.push(file.name);
            continue;
          }
          next.push({
            name: file.name,
            group: g,
            overall: m.overall,
            symmetry: m.symmetry,
            values: Object.fromEntries(m.metrics.map((x) => [x.id, x.value])),
          });
        } catch {
          bad.push(file.name);
        }
      }

      setSamples((s) => [...s, ...next]);
      setFailed((f) => [...f, ...bad]);
      setBusy(false);
    },
    [],
  );

  const avg = samples.filter((s) => s.group === "average");
  const att = samples.filter((s) => s.group === "attractive");

  const rows = METRIC_ORDER.map((id) => {
    const spec = SPECS[id];
    const centre = (spec.ideal[0] + spec.ideal[1]) / 2;
    const half = (spec.ideal[1] - spec.ideal[0]) / 2 || 1e-6;
    const mAvg = median(avg.map((s) => s.values[id]!).filter(Number.isFinite));
    const mAtt = median(att.map((s) => s.values[id]!).filter(Number.isFinite));
    return {
      id,
      centre,
      half,
      mAvg,
      mAtt,
      /** Offset of the average group from the band centre, in half-widths. */
      bias: Number.isFinite(mAvg) ? (mAvg - centre) / half : NaN,
      /** How far the attractive group sits from the average one, in half-widths. */
      sep: Number.isFinite(mAtt) && Number.isFinite(mAvg) ? (mAtt - mAvg) / half : NaN,
      dir: spec.dir,
    };
  });

  const payload = JSON.stringify(
    {
      n: { average: avg.length, attractive: att.length },
      overall: {
        average: avg.map((s) => s.overall),
        attractive: att.map((s) => s.overall),
      },
      symmetry: {
        average: median(avg.map((s) => s.symmetry)),
        attractive: median(att.map((s) => s.symmetry)),
      },
      metrics: Object.fromEntries(
        rows.map((r) => [
          r.id,
          {
            band: SPECS[r.id].ideal,
            dir: r.dir,
            medianAverage: Number.isFinite(r.mAvg) ? Number(r.mAvg.toFixed(4)) : null,
            medianAttractive: Number.isFinite(r.mAtt) ? Number(r.mAtt.toFixed(4)) : null,
            biasHalfWidths: Number.isFinite(r.bias) ? Number(r.bias.toFixed(3)) : null,
            separationHalfWidths: Number.isFinite(r.sep) ? Number(r.sep.toFixed(3)) : null,
          },
        ]),
      ),
      raw: samples,
    },
    null,
    2,
  );

  const fmt = (v: number, d = 3) => (Number.isFinite(v) ? v.toFixed(d) : "—");

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <h1 className="text-xl font-semibold tracking-tight">
        🔧 Kalibrierung
      </h1>
      <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-zinc-400">
        Lade mehrere Fotos auf einmal hoch — erst eine Gruppe durchschnittlicher
        Gesichter, dann eine Gruppe, die du als attraktiv einstufst. Alles läuft
        lokal im Browser, nichts wird hochgeladen. Am Ende unten auf „Kopieren"
        und mir den Block schicken.
      </p>

      {/* Group switch + picker */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        {(["average", "attractive"] as Group[]).map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setGroup(g)}
            className={`rounded-full px-3 py-1.5 text-[12px] transition ${
              group === g
                ? "bg-accent text-black"
                : "glass-subtle text-zinc-300"
            }`}
          >
            {g === "average" ? "Durchschnitt" : "Attraktiv"}
          </button>
        ))}

        <button
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
          className="glass-subtle ml-auto flex items-center gap-2 rounded-full px-4 py-2 text-[12px] text-zinc-200 disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          Fotos wählen ({group === "average" ? "Durchschnitt" : "Attraktiv"})
        </button>
        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            void ingest(e.target.files, group);
            e.target.value = "";
          }}
        />
      </div>

      <p className="mt-3 text-[11px] text-zinc-500">
        Erfasst: <strong className="text-zinc-300">{avg.length}</strong>{" "}
        Durchschnitt · <strong className="text-zinc-300">{att.length}</strong>{" "}
        attraktiv
        {failed.length ? (
          <span className="ml-2 text-amber-400">
            <X className="inline h-3 w-3" /> kein Gesicht erkannt:{" "}
            {failed.join(", ")}
          </span>
        ) : null}
      </p>

      {samples.length > 0 ? (
        <>
          <div className="glass mt-5 overflow-x-auto rounded-2xl p-4">
            <table className="w-full min-w-[640px] text-left text-[11px]">
              <thead>
                <tr className="border-b border-white/10 text-zinc-500">
                  <th className="pb-2 font-medium">Metrik</th>
                  <th className="pb-2 text-right font-medium">Band</th>
                  <th className="pb-2 text-right font-medium">Ø-Gruppe</th>
                  <th className="pb-2 text-right font-medium">Attraktiv</th>
                  <th className="pb-2 text-right font-medium">Versatz</th>
                  <th className="pb-2 text-right font-medium">Trennung</th>
                </tr>
              </thead>
              <tbody className="font-mono-terminal">
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-white/[0.05] last:border-0">
                    <td className="py-1.5 text-zinc-300">{r.id}</td>
                    <td className="py-1.5 text-right text-zinc-600">
                      {SPECS[r.id].ideal[0]}–{SPECS[r.id].ideal[1]}
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-zinc-300">
                      {fmt(r.mAvg)}
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-zinc-300">
                      {fmt(r.mAtt)}
                    </td>
                    <td
                      className={`py-1.5 text-right tabular-nums ${
                        Math.abs(r.bias) > 1 ? "text-amber-400" : "text-zinc-400"
                      }`}
                    >
                      {fmt(r.bias, 2)}
                    </td>
                    <td
                      className={`py-1.5 text-right tabular-nums ${
                        Math.abs(r.sep) < 0.15 ? "text-zinc-600" : "text-accent"
                      }`}
                    >
                      {fmt(r.sep, 2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-[10px] leading-relaxed text-zinc-500">
              <strong>Versatz</strong> = wie weit die Durchschnittsgruppe neben
              der Bandmitte liegt, in halben Bandbreiten. Alles über 1,0 (gelb)
              heißt: das Band steht am falschen Ort, nicht das Gesicht.{" "}
              <strong>Trennung</strong> = wie weit die attraktive Gruppe von der
              Durchschnittsgruppe abweicht. Grau heißt: diese Metrik
              unterscheidet die beiden Gruppen nicht und trägt kein Signal.
            </p>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(payload);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {
                  /* selectable below */
                }
              }}
              className="flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-[12px] font-semibold text-black"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
              {copied ? "Kopiert" : "Kopieren"}
            </button>
            <span className="text-[11px] text-zinc-500">
              Scores Ø-Gruppe: {avg.map((s) => s.overall).join(", ") || "—"} ·
              attraktiv: {att.map((s) => s.overall).join(", ") || "—"}
            </span>
          </div>

          <pre className="mt-4 max-h-80 overflow-auto rounded-xl bg-black/40 p-3 text-[10px] leading-relaxed text-zinc-400">
            {payload}
          </pre>
        </>
      ) : null}
    </main>
  );
}
