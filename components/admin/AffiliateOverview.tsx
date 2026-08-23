"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, KeyRound, RefreshCw, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/cn";
import type {
  AffiliateAddress,
  AffiliateConfig,
  AffiliateStatus,
  CommissionStatus,
  Payout,
} from "@/lib/affiliate/model";
import type { PlanId } from "@/lib/pricing";

// The affiliate cockpit's front page — and, deliberately, the module the other
// four affiliate screens import their shared vocabulary from.
//
// Why the shared bits live here and not in a helpers file: the file set for
// this area is fixed, and money formatting, the status labels and the CSV
// writer are used by every one of these screens. Five private copies of "what
// does 'pending' say in German" is exactly how two screens end up disagreeing
// about a partner's status.

/* ------------------------------------------------------------------ types */
/* Mirrors of the admin API contract. They are declared client-side because the
   route handlers own their own response shapes; keeping a typed copy here means
   a contract drift shows up as a type error instead of as an empty column that
   nobody notices for a month. */

export interface AdminCommissionRow {
  id: string;
  at: number;
  customer: string;
  plan: PlanId;
  grossCents: number;
  amountCents: number;
  percent: number;
  level: number;
  status: CommissionStatus;
  maturesAt: number;
}

export interface AdminReferralRow {
  email: string;
  masked: string;
  boundAt: number;
  firstPurchaseAt: number | null;
  purchases: number;
  spentCents: number;
  commissionCents: number;
}

export interface PartnerRow {
  email: string;
  name: string;
  code: string;
  status: AffiliateStatus;
  level: number;
  levelLabel: string;
  percent: number;
  clicks: number;
  payingCustomers: number;
  signups: number;
  revenueCents: number;
  earnedCents: number;
  availableCents: number;
  pendingCents: number;
  paidCents: number;
  createdAt: number;
}

export interface PartnerDetail extends PartnerRow {
  address: AffiliateAddress;
  accountHolder: string;
  ibanMasked: string;
  note: string;
  percentOverride: number | null;
  levelOverride: number | null;
  payoutMinOverrideCents: number | null;
  minCents: number;
  history: Array<{ at: number; field: "iban" | "address"; ibanLast4?: string }>;
  commissions: AdminCommissionRow[];
  referrals: AdminReferralRow[];
  payouts: AdminPayoutRow[];
}

export type AdminPayoutRow = Payout & { name: string; ibanMasked: string };

export type Backing = "redis" | "sheets" | "memory";

/* ------------------------------------------------------------- formatting */

/** Cents to "1.234,56 EUR". Undefined stays a dash: a missing number is not a zero. */
export function eur(cents: number | null | undefined): string {
  if (typeof cents !== "number" || !Number.isFinite(cents)) return "—";
  return (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

export function int(n: number | null | undefined): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return n.toLocaleString("de-DE");
}

export function pct(p: number | null | undefined): string {
  if (typeof p !== "number" || !Number.isFinite(p)) return "—";
  return `${p.toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`;
}

export function dt(ms: number | null | undefined): string {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms <= 0) return "—";
  return new Date(ms).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

export function dtTime(ms: number | null | undefined): string {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms <= 0) return "—";
  return new Date(ms).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const COMMISSION_LABEL: Record<CommissionStatus, string> = {
  pending: "In Reifung",
  available: "Auszahlbar",
  requested: "Beantragt",
  paid: "Ausgezahlt",
  reversed: "Storniert",
};

export const AFFILIATE_LABEL: Record<AffiliateStatus, string> = {
  pending: "Wartet auf Freigabe",
  active: "Aktiv",
  blocked: "Gesperrt",
};

export const PAYOUT_LABEL: Record<Payout["status"], string> = {
  requested: "Beantragt",
  approved: "Genehmigt",
  paid: "Ausgezahlt",
  rejected: "Abgelehnt",
};

export const PLAN_LABEL: Record<PlanId, string> = {
  raw: "Basis",
  pro: "Pro",
  blueprint: "Blueprint",
};

export function planLabel(plan: PlanId | string): string {
  return PLAN_LABEL[plan as PlanId] ?? String(plan);
}

/* -------------------------------------------------------------------- CSV */

/** U+FEFF, written as a code point because an invisible character in a source
 *  file is a bug waiting to be "cleaned up" by the next editor. */
const BOM = String.fromCharCode(0xfeff);

/**
 * Excel on a German machine reads `;` as the separator and needs the BOM to
 * believe the file is UTF-8 — without it every umlaut in a partner's name
 * arrives broken.
 *
 * The leading-character guard is not cosmetic. A cell that starts with `=`,
 * `+` or `@` is a FORMULA to Excel, and names and notes here are text a
 * stranger typed into a public form. The apostrophe turns the payload back
 * into text. A leading minus is left alone when the field is a plain number,
 * because that is a negative amount and quoting it would break the column.
 */
export function toCsv(rows: Array<Array<string | number>>): string {
  const cell = (raw: string | number): string => {
    const s = raw === null || raw === undefined ? "" : String(raw);
    const risky =
      /^[=+@\t\r]/.test(s) || (s.startsWith("-") && !/^-?\d+([.,]\d+)?$/.test(s));
    return `"${(risky ? `'${s}` : s).replace(/"/g, '""')}"`;
  };
  return BOM + rows.map((r) => r.map(cell).join(";")).join("\r\n") + "\r\n";
}

/** Client-side download. No export endpoint exists and none is needed — the
 *  admin already holds every row on screen. */
export function downloadCsv(filename: string, rows: Array<Array<string | number>>): void {
  const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking in the same tick races the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/* ------------------------------------------------------------ shared bits */

export const inputCls =
  "w-full rounded-[var(--r-control)] border border-white/10 bg-white/[0.03] px-3 py-2 text-[13px] text-[var(--color-ink)] outline-none placeholder:text-[var(--color-ink-quaternary)] focus:border-[var(--color-accent)]/50";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="t-eyebrow block">{label}</span>
      {hint ? (
        <span className="t-caption mb-1.5 block text-[var(--color-ink-tertiary)]">{hint}</span>
      ) : (
        <span className="mb-1.5 block" />
      )}
      {children}
    </label>
  );
}

export type NoteKind = "ok" | "error" | "info";

/** Every write on these screens answers here — inline, never in an alert().
 *  An alert steals focus and says nothing about WHICH row it is talking about. */
export function Note({ kind, children }: { kind: NoteKind; children: React.ReactNode }) {
  return (
    <p
      role={kind === "error" ? "alert" : "status"}
      className={cn(
        "rounded-xl border px-3 py-2 text-[12px] leading-relaxed",
        kind === "ok" &&
          "border-[var(--color-accent)]/30 bg-[var(--color-accent)]/[0.07] text-[var(--color-accent)]",
        kind === "error" && "border-red-500/30 bg-red-500/[0.07] text-red-300",
        kind === "info" && "border-white/[0.1] bg-white/[0.03] text-[var(--color-ink-secondary)]",
      )}
    >
      {children}
    </p>
  );
}

export type Tone = "neutral" | "accent" | "caution" | "danger" | "muted";

export function Pill({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-block shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]",
        tone === "accent" &&
          "border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/[0.08] text-[var(--color-accent)]",
        tone === "caution" &&
          "border border-[var(--color-caution)]/40 bg-[var(--color-caution)]/[0.08] text-[var(--color-caution)]",
        tone === "danger" && "border border-red-500/40 bg-red-500/[0.08] text-red-300",
        tone === "muted" && "border border-white/[0.08] text-[var(--color-ink-quaternary)]",
        tone === "neutral" && "border border-white/[0.12] text-[var(--color-ink-tertiary)]",
      )}
    >
      {children}
    </span>
  );
}

export function commissionTone(s: CommissionStatus): Tone {
  if (s === "available") return "accent";
  if (s === "pending") return "caution";
  if (s === "reversed") return "danger";
  if (s === "paid") return "muted";
  return "neutral";
}

export function payoutTone(s: Payout["status"]): Tone {
  if (s === "requested") return "caution";
  if (s === "approved") return "accent";
  if (s === "rejected") return "danger";
  return "muted";
}

export function affiliateTone(s: AffiliateStatus): Tone {
  if (s === "active") return "accent";
  if (s === "pending") return "caution";
  return "danger";
}

/** Reads whatever the admin API said went wrong. Never renders a raw body. */
export async function readError(res: Response | null): Promise<string> {
  if (!res) return "Keine Verbindung zum Server.";
  const data = (await res.json().catch(() => null)) as
    | { error?: string; errors?: string[] }
    | null;
  if (data?.errors?.length) return data.errors.join(" · ");
  if (data?.error) return data.error;
  return `Fehler ${res.status}.`;
}

/* --------------------------------------------------------------- overview */

interface OverviewTotals {
  partners?: number;
  activePartners?: number;
  pendingPartners?: number;
  blockedPartners?: number;
  boundCustomers?: number;
  payingCustomers?: number;
  clicks?: number;
  commissions?: number;
  revenueCents?: number;
  earnedCents?: number;
  pendingCents?: number;
  availableCents?: number;
  requestedCents?: number;
  paidCents?: number;
  openPayouts?: number;
  openPayoutCents?: number;
}

interface TopPartner {
  email: string;
  name?: string;
  code?: string;
  level?: number;
  levelLabel?: string;
  percent?: number;
  clicks?: number;
  payingCustomers?: number;
  revenueCents?: number;
  earnedCents?: number;
}

interface OverviewResponse {
  config: AffiliateConfig;
  backing: Backing;
  persistent: boolean;
  piiKey: boolean;
  totals: OverviewTotals;
  top: TopPartner[];
}

export function AffiliateOverview() {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/affiliate/overview", { cache: "no-store" }).catch(
      () => null,
    );
    if (!res?.ok) {
      setError(await readError(res));
      setLoading(false);
      return;
    }
    setError(null);
    setData((await res.json()) as OverviewResponse);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const cfg = data?.config ?? null;
  const t: OverviewTotals = data?.totals ?? {};

  return (
    <div className="mt-6">
      {error ? (
        <div className="mb-3">
          <Note kind="error">{error}</Note>
        </div>
      ) : null}

      {/* Two things can quietly break the whole programme and show up nowhere
          else: a store that forgets everything on restart, and a missing PII
          key that makes every application fail at the last step. Both belong at
          the top of the first screen, not in a log nobody reads. */}
      {data && !data.persistent ? (
        <p className="mb-3 flex items-start gap-2 rounded-xl border border-[var(--color-caution)]/30 bg-[var(--color-caution)]/[0.07] p-3 text-[12px] leading-relaxed text-[var(--color-caution)]">
          <AlertTriangle className="mt-px h-4 w-4 shrink-0" aria-hidden />
          <span>
            Der Affiliate-Store läuft im Arbeitsspeicher ({data.backing}). Partner, Provisionen
            und Auszahlungsanträge sind beim nächsten Neustart weg. Für echten Betrieb
            SHEETS_URL/SHEETS_TOKEN oder Redis setzen.
          </span>
        </p>
      ) : null}

      {data && !data.piiKey ? (
        <p className="mb-3 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/[0.07] p-3 text-[12px] leading-relaxed text-red-300">
          <KeyRound className="mt-px h-4 w-4 shrink-0" aria-hidden />
          <span>
            <strong className="font-semibold">Kein Schlüssel für die Bankdaten.</strong>{" "}
            Normalerweise wird er aus <span className="font-mono-terminal">AUTH_SECRET</span>{" "}
            abgeleitet — die fehlt hier oder ist kürzer als 16 Zeichen. Solange das so ist, kann
            sich niemand als Partner bewerben: eine IBAN im Klartext kommt nicht in Frage.
            Entweder <span className="font-mono-terminal">AUTH_SECRET</span> setzen (die braucht
            auch der Login) oder einen eigenen Schlüssel hinterlegen:{" "}
            <span className="font-mono-terminal break-all">
              {"AFFILIATE_PII_KEY=$(node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\")"}
            </span>
          </span>
        </p>
      ) : null}

      {data?.piiKey && data.persistent ? (
        <p className="mb-3 flex items-center gap-2 text-[11.5px] text-[var(--color-ink-tertiary)]">
          <ShieldCheck className="h-3.5 w-3.5 text-[var(--color-accent)]" aria-hidden />
          Speicher: {data.backing} · IBAN-Verschlüsselung aktiv
        </p>
      ) : null}

      {cfg && !cfg.enabled ? (
        <div className="mb-3">
          <Note kind="info">
            Das Partnerprogramm ist ausgeschaltet. Neue Bewerbungen und Provisionen werden nicht
            angenommen.{" "}
            <Link className="underline" href="/admin/affiliate/einstellungen">
              In den Einstellungen einschalten
            </Link>
            .
          </Note>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <p className="t-eyebrow">Kennzahlen</p>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] px-3 py-1.5 text-[11.5px] font-medium text-[var(--color-ink-secondary)] hover:border-white/25 disabled:opacity-40"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden />
          {loading ? "Lädt…" : "Aktualisieren"}
        </button>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Kpi
          label="Aktive Partner"
          value={int(t.activePartners)}
          sub={typeof t.partners === "number" ? `${int(t.partners)} insgesamt` : undefined}
        />
        <Kpi
          label="Gebundene Kunden"
          value={int(t.boundCustomers)}
          sub={
            typeof t.payingCustomers === "number" ? `${int(t.payingCustomers)} zahlend` : undefined
          }
        />
        <Kpi
          label="Geworbener Umsatz"
          value={eur(t.revenueCents)}
          sub={typeof t.commissions === "number" ? `${int(t.commissions)} Provisionen` : undefined}
        />
        <Kpi label="Provisionen gesamt" value={eur(t.earnedCents)} />
        <Kpi label="In Reifung" value={eur(t.pendingCents)} />
        <Kpi label="Auszahlbar" value={eur(t.availableCents)} />
        <Kpi label="Ausgezahlt" value={eur(t.paidCents)} />
        <Kpi
          label="Offene Anträge"
          value={int(t.openPayouts)}
          sub={typeof t.openPayoutCents === "number" ? eur(t.openPayoutCents) : undefined}
          highlight={typeof t.openPayouts === "number" && t.openPayouts > 0}
          href="/admin/affiliate/auszahlungen"
        />
      </div>

      {cfg ? (
        <div className="mt-6">
          <div className="flex items-center justify-between gap-3">
            <p className="t-eyebrow">Aktuelle Regeln</p>
            <Link
              href="/admin/affiliate/einstellungen"
              className="text-[11.5px] font-medium text-[var(--color-accent)] hover:underline"
            >
              Ändern
            </Link>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Chip>{cfg.enabled ? "Programm an" : "Programm aus"}</Chip>
            <Chip>{cfg.joinMode === "code" ? "Anmeldung nur mit Code" : "Anmeldung offen"}</Chip>
            <Chip>{cfg.requireApproval ? "Freigabe nötig" : "Ohne Freigabe"}</Chip>
            <Chip>{cfg.commissionScope === "first" ? "Nur Erstkauf" : "Lebenslang"}</Chip>
            <Chip>
              {cfg.commissionBase === "net" ? `Netto (${cfg.vatPercent} % MwSt.)` : "Brutto"}
            </Chip>
            <Chip>Cookie {cfg.cookieDays} Tage</Chip>
            <Chip>Reifezeit {cfg.holdDays} Tage</Chip>
            <Chip>Mindestauszahlung {eur(cfg.payoutMinCents)}</Chip>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[...cfg.levels]
              .sort((a, b) => a.level - b.level)
              .map((l) => (
                <Chip key={l.level}>
                  L{l.level} {l.label} · ab {int(l.minReferrals)} · {pct(l.percent)}
                </Chip>
              ))}
          </div>
        </div>
      ) : null}

      <div className="mt-6">
        <p className="t-eyebrow">Top-Partner nach Umsatz</p>
        {!data ? (
          <p className="t-caption mt-2 text-[var(--color-ink-tertiary)]">Wird geladen…</p>
        ) : data.top.length === 0 ? (
          <p className="t-caption mt-2 text-[var(--color-ink-tertiary)]">
            Noch kein Partner mit Umsatz. Sobald der erste geworbene Kauf gebucht ist, steht er
            hier.
          </p>
        ) : (
          <ol className="mt-2 grid gap-1.5">
            {data.top.slice(0, 10).map((p, i) => (
              <li
                key={p.email}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-white/[0.08] bg-white/[0.02] px-3.5 py-2.5"
              >
                <span className="tnum w-5 shrink-0 text-[12px] text-[var(--color-ink-quaternary)]">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-[var(--color-ink)]">
                    {p.name && p.name.trim() ? p.name : p.email}
                  </span>
                  <span className="block truncate text-[11px] text-[var(--color-ink-tertiary)]">
                    {p.email}
                    {p.code ? ` · ${p.code}` : ""}
                    {typeof p.level === "number"
                      ? ` · L${p.level}${p.levelLabel ? ` ${p.levelLabel}` : ""} · ${pct(p.percent)}`
                      : ""}
                  </span>
                </span>
                <span className="tnum shrink-0 text-right text-[12.5px]">
                  <span className="block font-semibold text-[var(--color-ink)]">
                    {eur(p.revenueCents)}
                  </span>
                  <span className="block text-[11px] text-[var(--color-ink-tertiary)]">
                    davon {eur(p.earnedCents)} Provision
                  </span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <p className="mt-6 text-[11px] leading-relaxed text-[var(--color-ink-quaternary)]">
        Alle Zahlen kommen aus dem Store. Fehlt eine Zahl, steht hier ein Strich statt einer
        geschätzten. Provisionen reifen {cfg ? cfg.holdDays : "—"} Tage, bevor sie auszahlbar
        werden.
      </p>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  highlight,
  href,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
  href?: string;
}) {
  const body = (
    <>
      <span className="t-eyebrow block text-[var(--color-ink-tertiary)]">{label}</span>
      <span
        className={cn(
          "tnum mt-1 block text-[19px] font-semibold tracking-[-0.01em]",
          highlight ? "text-[var(--color-caution)]" : "text-[var(--color-ink)]",
        )}
      >
        {value}
      </span>
      {sub ? (
        <span className="tnum mt-0.5 block text-[11px] text-[var(--color-ink-tertiary)]">
          {sub}
        </span>
      ) : null}
    </>
  );
  const cls = cn(
    "block rounded-2xl border bg-white/[0.02] p-3.5",
    highlight ? "border-[var(--color-caution)]/35" : "border-white/[0.08]",
  );
  return href ? (
    <Link href={href} className={cn(cls, "hover:border-white/20")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-white/[0.1] px-2.5 py-1 text-[11px] text-[var(--color-ink-secondary)]">
      {children}
    </span>
  );
}
