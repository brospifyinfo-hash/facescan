"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { PLAN_ORDER, type PlanId } from "@/lib/pricing";
import { cn } from "@/lib/cn";

// Every customer the product knows: everyone who ever saved a scan, plus
// everyone who ever bought (even without a saved scan). The one write this
// page can do is GRANT A PLAN — the support action that used to require
// hand-editing a spreadsheet cell. Granting can only ever upgrade (the
// store's rank guard), and admin grants carry an "admin-…" intent id so the
// books always distinguish them from money.

interface CustomerRow {
  email: string;
  scans: number;
  firstAt: number;
  lastAt: number;
  best: number;
  plan: PlanId | null;
  grantedAt: number | null;
  paidCents: number;
}

const PLAN_LABEL: Record<PlanId, string> = {
  raw: "Basis",
  pro: "Pro",
  blueprint: "Blueprint",
};

export function CustomerAdmin() {
  const [rows, setRows] = useState<CustomerRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [granting, setGranting] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch("/api/admin/customers", { cache: "no-store" }).catch(() => null);
    if (!res?.ok) {
      const body = await res?.json().catch(() => null);
      setError(
        body?.error === "script_outdated"
          ? "Das Apps Script kennt die Kunden-Abfrage noch nicht — bitte scripts/sheets-backend.gs neu einspielen."
          : "Kundenliste nicht erreichbar.",
      );
      return;
    }
    setError(null);
    setRows(((await res.json()) as { customers: CustomerRow[] }).customers);
  };

  useEffect(() => {
    void load();
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!rows) return [];
    return q ? rows.filter((r) => r.email.includes(q)) : rows;
  }, [rows, query]);

  const date = (ms: number) =>
    ms > 0 ? new Date(ms).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—";

  const grant = async (email: string, plan: PlanId) => {
    if (!window.confirm(`${PLAN_LABEL[plan]} an ${email} vergeben? (Kostenlos, nur Upgrade möglich.)`)) {
      return;
    }
    setGranting(email);
    setNote(null);
    const res = await fetch("/api/admin/grant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, plan }),
    }).catch(() => null);
    setGranting(null);
    if (res?.ok) {
      setNote(`${PLAN_LABEL[plan]} an ${email} vergeben.`);
      void load();
    } else {
      setNote("Vergabe fehlgeschlagen.");
    }
  };

  return (
    <div className="mt-6">
      {error ? (
        <p className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-3 text-[12.5px] leading-relaxed text-amber-300">
          {error}
        </p>
      ) : null}
      {note ? <p className="mb-3 text-[12.5px] text-[var(--color-accent)]">{note}</p> : null}

      <label className="flex items-center gap-2 rounded-2xl border border-white/[0.1] bg-white/[0.03] px-4 py-2.5">
        <Search className="h-4 w-4 shrink-0 text-[var(--color-ink-tertiary)]" aria-hidden />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="E-Mail suchen…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--color-ink-tertiary)]"
        />
      </label>

      <p className="mt-3 text-[11px] text-[var(--color-ink-tertiary)]">
        {rows ? `${shown.length} von ${rows.length} Konten` : "Wird geladen…"}
      </p>

      <div className="mt-2 grid gap-2">
        {shown.map((r) => (
          <article
            key={r.email}
            className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3.5"
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--color-ink)]">
                {r.email}
              </span>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]",
                  r.plan
                    ? "border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/[0.08] text-[var(--color-accent)]"
                    : "border border-white/[0.1] text-[var(--color-ink-tertiary)]",
                )}
              >
                {r.plan ? PLAN_LABEL[r.plan] : "kein Kauf"}
              </span>
            </div>
            <p className="tnum mt-1.5 text-[11px] text-[var(--color-ink-tertiary)]">
              {r.scans} Scans · bester Score {r.best > 0 ? r.best.toFixed(1) : "—"} · zuletzt{" "}
              {date(r.lastAt)} · gezahlt{" "}
              {(r.paidCents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <span className="text-[10.5px] text-[var(--color-ink-tertiary)]">Vergeben:</span>
              {PLAN_ORDER.map((p) => (
                <button
                  key={p}
                  type="button"
                  disabled={granting === r.email || r.plan === p}
                  onClick={() => grant(r.email, p)}
                  className="rounded-full border border-white/[0.1] px-3 py-1 text-[11px] font-medium text-[var(--color-ink-secondary)] hover:border-white/25 disabled:opacity-40"
                >
                  {PLAN_LABEL[p]}
                </button>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
