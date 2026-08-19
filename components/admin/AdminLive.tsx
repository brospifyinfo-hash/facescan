"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, RefreshCw } from "lucide-react";
import { Globe, type GlobePoint } from "./Globe";
import type { LiveSession } from "@/lib/analytics";
import { cn } from "@/lib/cn";

// The owner's live view. German only — this is the cockpit, not the shop.
//
// Polls /api/admin/live every 10 s. Presence records expire at 90 s server-
// side, so "online" here means "sent a heartbeat in the last minute and a
// half" — the honest definition, stated in the header line.

type SessionRow = LiveSession & { sid: string };

interface LiveData {
  now: number;
  sessions: SessionRow[];
  today: { views: Record<string, number>; countries: Record<string, number> };
  yesterday: { views: Record<string, number>; countries: Record<string, number> };
}

const flag = (cc: string) =>
  /^[A-Z]{2}$/.test(cc)
    ? String.fromCodePoint(...[...cc].map((c) => 127397 + c.charCodeAt(0)))
    : "🌐";

const mins = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
};

function Bars({ data, unit }: { data: Record<string, number>; unit: string }) {
  const rows = Object.entries(data)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);
  const max = rows[0]?.[1] ?? 1;
  if (rows.length === 0) {
    return <p className="mt-2 text-[12px] text-[var(--color-ink-tertiary)]">Noch nichts heute.</p>;
  }
  return (
    <div className="mt-3 space-y-2">
      {rows.map(([label, n]) => (
        <div key={label} className="flex items-center gap-3">
          <span className="w-[38%] truncate text-[11.5px] text-[var(--color-ink-secondary)]">
            {/^[A-Z?]{2}$/.test(label) ? `${flag(label)} ${label}` : label}
          </span>
          <span className="bar-track flex-1">
            <span className="bar-fill" style={{ width: `${(n / max) * 100}%` }} />
          </span>
          <span className="tnum w-14 shrink-0 text-right text-[11.5px] font-medium text-[var(--color-ink)]">
            {n} {unit}
          </span>
        </div>
      ))}
    </div>
  );
}

export function AdminLive() {
  const [data, setData] = useState<LiveData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openSid, setOpenSid] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const res = await fetch("/api/admin/live", { cache: "no-store" }).catch(() => null);
      if (!alive) return;
      if (!res?.ok) {
        const body = await res?.json().catch(() => null);
        setError(
          body?.error === "script_outdated"
            ? "Das Apps Script kennt kv-scan noch nicht — bitte scripts/sheets-backend.gs neu einspielen (Bereitstellungen verwalten → Stift → Version „Neu“)."
            : "Live-Daten nicht erreichbar.",
        );
        return;
      }
      setError(null);
      setData((await res.json()) as LiveData);
    };
    void load();
    const id = setInterval(() => {
      setTick((t) => t + 1);
      void load();
    }, 10_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const globePoints: GlobePoint[] = useMemo(() => {
    const byCountry = new Map<string, number>();
    for (const s of data?.sessions ?? []) {
      byCountry.set(s.country, (byCountry.get(s.country) ?? 0) + 1);
    }
    return [...byCountry.entries()].map(([country, count]) => ({ country, count }));
  }, [data]);

  const viewsToday = Object.values(data?.today.views ?? {}).reduce((a, b) => a + b, 0);
  const viewsYesterday = Object.values(data?.yesterday.views ?? {}).reduce((a, b) => a + b, 0);
  const countriesToday = Object.keys(data?.today.countries ?? {}).length;
  const topPage =
    Object.entries(data?.today.views ?? {}).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

  const kpis = [
    { label: "Jetzt online", value: String(data?.sessions.length ?? "…"), hint: "Heartbeat < 90 s" },
    { label: "Views heute", value: String(viewsToday), hint: `gestern ${viewsYesterday}` },
    { label: "Länder heute", value: String(countriesToday), hint: "nach Seitenaufrufen" },
    { label: "Top-Seite heute", value: topPage, hint: "meiste Aufrufe" },
  ];

  return (
    <div className="mt-6">
      {error ? (
        <p className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-3 text-[12.5px] leading-relaxed text-amber-300">
          {error}
        </p>
      ) : null}

      {/* ---- KPIs ---- */}
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3.5">
            <p className="t-eyebrow">{k.label}</p>
            <p className="tnum mt-1.5 truncate text-[22px] font-bold leading-none text-[var(--color-ink)]">
              {k.value}
            </p>
            <p className="mt-1.5 text-[10.5px] text-[var(--color-ink-tertiary)]">{k.hint}</p>
          </div>
        ))}
      </section>

      {/* ---- Globe + sessions ---- */}
      <section className="mt-6 grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)] lg:items-start">
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
          <div className="flex items-center justify-between">
            <p className="t-eyebrow">Live-Weltkugel</p>
            <span className="flex items-center gap-1.5 text-[10.5px] text-[var(--color-ink-tertiary)]">
              <RefreshCw className={cn("h-3 w-3", tick % 2 === 0 && "opacity-60")} aria-hidden />
              alle 10 s
            </span>
          </div>
          <Globe points={globePoints} size={340} />
        </div>

        <div>
          <p className="t-eyebrow">Aktive Sitzungen</p>
          {data && data.sessions.length === 0 ? (
            <p className="mt-2 text-[12.5px] text-[var(--color-ink-tertiary)]">
              Gerade niemand online (nur Besucher, die Statistik-Cookies akzeptiert haben, sind
              sichtbar).
            </p>
          ) : null}
          <div className="mt-2 grid gap-2">
            {(data?.sessions ?? []).map((s) => {
              const open = openSid === s.sid;
              const pageRows = Object.entries(s.pages).sort((a, b) => b[1] - a[1]);
              return (
                <article key={s.sid} className="rounded-2xl border border-white/[0.08] bg-white/[0.02]">
                  <button
                    type="button"
                    onClick={() => setOpenSid(open ? null : s.sid)}
                    aria-expanded={open}
                    className="flex w-full items-center gap-3 p-3 text-left"
                  >
                    <span className="text-[18px]" aria-hidden>
                      {flag(s.country)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-medium text-[var(--color-ink)]">
                        {s.city ? `${s.city}, ` : ""}
                        {s.country} · <span className="font-mono-terminal">{s.ip || "?"}</span>
                      </span>
                      <span className="block truncate text-[10.5px] text-[var(--color-ink-tertiary)]">
                        auf <span className="text-[var(--color-accent)]">{s.path}</span> · seit{" "}
                        {mins((data?.now ?? Date.now()) - s.startedAt)}
                      </span>
                    </span>
                    <ChevronDown
                      aria-hidden
                      className={cn(
                        "h-4 w-4 shrink-0 text-[var(--color-ink-tertiary)] transition-transform",
                        open && "rotate-180",
                      )}
                    />
                  </button>
                  {open ? (
                    <div className="border-t border-[var(--color-hairline)] p-3">
                      <p className="t-caption break-all text-[var(--color-ink-tertiary)]">{s.ua}</p>
                      <div className="mt-2 space-y-1.5">
                        {pageRows.map(([path, secs]) => (
                          <div key={path} className="flex items-center justify-between gap-3">
                            <span className="truncate text-[11.5px] text-[var(--color-ink-secondary)]">
                              {path}
                            </span>
                            <span className="tnum shrink-0 text-[11.5px] text-[var(--color-ink)]">
                              {mins(secs * 1000)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---- Today ---- */}
      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <p className="t-eyebrow">Seiten heute (Aufrufe)</p>
          <Bars data={data?.today.views ?? {}} unit="×" />
        </div>
        <div>
          <p className="t-eyebrow">Länder heute (Aufrufe)</p>
          <Bars data={data?.today.countries ?? {}} unit="×" />
        </div>
      </section>
    </div>
  );
}
