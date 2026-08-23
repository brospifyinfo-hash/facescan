"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Eye, RefreshCw, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import {
  AFFILIATE_LABEL,
  COMMISSION_LABEL,
  Note,
  PAYOUT_LABEL,
  Pill,
  affiliateTone,
  commissionTone,
  downloadCsv,
  dt,
  dtTime,
  eur,
  inputCls,
  int,
  payoutTone,
  pct,
  planLabel,
  readError,
  stamp,
  type PartnerDetail,
  type PartnerRow,
} from "@/components/admin/AffiliateOverview";

// The partner list, and behind every row the complete picture of one partner:
// who they brought, what those people spent, what that earned them, and every
// lever the operator has.
//
// TWO DESIGN DECISIONS
//
// 1. The list is one request, the detail is another. A detail carries the
//    referred customers' addresses and the payout data; loading all of that
//    for fifty partners to render a table of numbers would put every
//    customer's address into a response nobody reads.
//
// 2. Every action goes through the same `act()` and re-renders from the
//    partner the SERVER returned. The alternative — patching local state
//    optimistically — invents a state the store may have refused, and the one
//    thing an operator must be able to trust here is that the screen shows
//    what was actually saved.

type SortKey = "revenue" | "earned" | "available" | "customers" | "created" | "name";

const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: "revenue", label: "Umsatz" },
  { key: "earned", label: "Verdient" },
  { key: "available", label: "Auszahlbar" },
  { key: "customers", label: "Kunden" },
  { key: "created", label: "Neueste" },
  { key: "name", label: "Name" },
];

export function AffiliatePartners() {
  const [rows, setRows] = useState<PartnerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("revenue");
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/affiliate/partners", { cache: "no-store" }).catch(
      () => null,
    );
    if (!res?.ok) {
      setError(await readError(res));
      setLoading(false);
      return;
    }
    const data = (await res.json().catch(() => null)) as { partners?: PartnerRow[] } | null;
    setRows(Array.isArray(data?.partners) ? data.partners : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? rows.filter(
          (r) =>
            r.email.toLowerCase().includes(q) ||
            (r.name ?? "").toLowerCase().includes(q) ||
            r.code.toLowerCase().includes(q),
        )
      : rows;

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      switch (sort) {
        case "earned":
          return b.earnedCents - a.earnedCents;
        case "available":
          return b.availableCents - a.availableCents;
        case "customers":
          return b.payingCustomers - a.payingCustomers;
        case "created":
          return b.createdAt - a.createdAt;
        case "name":
          return (a.name || a.email).localeCompare(b.name || b.email, "de");
        default:
          return b.revenueCents - a.revenueCents;
      }
    });
    return sorted;
  }, [rows, query, sort]);

  function exportCsv() {
    downloadCsv(
      `affiliate-partner-${stamp()}.csv`,
      [
        [
          "E-Mail", "Name", "Code", "Status", "Level", "Prozent", "Klicks", "Anmeldungen",
          "Zahlende Kunden", "Umsatz EUR", "Verdient EUR", "Auszahlbar EUR", "In Reifung EUR",
          "Ausgezahlt EUR", "Partner seit",
        ],
        ...shown.map((r) => [
          r.email,
          r.name,
          r.code,
          AFFILIATE_LABEL[r.status],
          r.level,
          r.percent,
          r.clicks,
          r.signups,
          r.payingCustomers,
          (r.revenueCents / 100).toFixed(2).replace(".", ","),
          (r.earnedCents / 100).toFixed(2).replace(".", ","),
          (r.availableCents / 100).toFixed(2).replace(".", ","),
          (r.pendingCents / 100).toFixed(2).replace(".", ","),
          (r.paidCents / 100).toFixed(2).replace(".", ","),
          dt(r.createdAt),
        ]),
      ],
    );
  }

  return (
    <div className="mt-6 grid gap-4">
      {error ? <Note kind="error">{error}</Note> : null}

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[12rem] flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-ink-quaternary)]"
            aria-hidden
          />
          <input
            className={cn(inputCls, "pl-8")}
            placeholder="E-Mail, Name oder Code"
            aria-label="Partner suchen"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          className={cn(inputCls, "w-auto")}
          value={sort}
          aria-label="Sortierung"
          onChange={(e) => setSort(e.target.value as SortKey)}
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              Sortiert nach {s.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={exportCsv}
          disabled={shown.length === 0}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] px-3 py-1.5 text-[11.5px] font-medium text-[var(--color-ink-secondary)] hover:border-white/25 disabled:opacity-40"
        >
          <Download className="h-3.5 w-3.5" aria-hidden />
          CSV
        </button>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] px-3 py-1.5 text-[11.5px] font-medium text-[var(--color-ink-secondary)] hover:border-white/25 disabled:opacity-40"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden />
          Aktualisieren
        </button>
      </div>

      {loading && rows.length === 0 ? (
        <p className="t-caption text-[var(--color-ink-tertiary)]">Wird geladen…</p>
      ) : shown.length === 0 ? (
        <p className="t-caption text-[var(--color-ink-tertiary)]">
          {rows.length === 0
            ? "Noch kein Partner. Sobald sich jemand über /partner bewirbt, steht er hier."
            : "Kein Partner passt zur Suche."}
        </p>
      ) : (
        <ul className="grid gap-1.5">
          {shown.map((r) => (
            <li
              key={r.email}
              className="rounded-2xl border border-white/[0.08] bg-white/[0.02] px-3.5 py-2.5"
            >
              <button
                type="button"
                onClick={() => setOpen(open === r.email ? null : r.email)}
                aria-expanded={open === r.email}
                className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-[13px] font-medium text-[var(--color-ink)]">
                      {r.name || r.email}
                    </span>
                    <Pill tone={affiliateTone(r.status)}>{AFFILIATE_LABEL[r.status]}</Pill>
                  </span>
                  <span className="t-caption block truncate text-[var(--color-ink-tertiary)]">
                    {r.email} · <span className="font-mono">{r.code}</span> · L{r.level}{" "}
                    {r.levelLabel} · {pct(r.percent)}
                  </span>
                </span>
                <span className="tnum shrink-0 text-right text-[12.5px]">
                  <span className="block font-semibold text-[var(--color-ink)]">
                    {eur(r.revenueCents)}
                  </span>
                  <span className="block text-[11px] text-[var(--color-ink-tertiary)]">
                    {eur(r.earnedCents)} verdient · {int(r.payingCustomers)} Kunden
                  </span>
                </span>
              </button>

              {open === r.email ? (
                <Detail email={r.email} onChanged={() => void load()} />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ detail */

function Detail({ email, onChanged }: { email: string; onChanged: () => void }) {
  const [p, setP] = useState<PartnerDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [iban, setIban] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [bindEmail, setBindEmail] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [confirm, setConfirm] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch(
      `/api/admin/affiliate/partners?email=${encodeURIComponent(email)}`,
      { cache: "no-store" },
    ).catch(() => null);
    if (!res?.ok) {
      setError(await readError(res));
      return;
    }
    const data = (await res.json().catch(() => null)) as { partner?: PartnerDetail } | null;
    if (data?.partner) {
      setP(data.partner);
      setNoteDraft(data.partner.note ?? "");
    }
  }, [email]);

  useEffect(() => {
    void load();
  }, [load]);

  /** One path for every write: send, read back what the server saved, show it. */
  async function act(action: string, value?: unknown, okText?: string) {
    setBusy(action);
    setError(null);
    setNote(null);
    const res = await fetch("/api/admin/affiliate/partners", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, action, value }),
    }).catch(() => null);

    if (!res?.ok) {
      setError(await readError(res));
      setBusy(null);
      return;
    }
    const data = (await res.json().catch(() => null)) as { partner?: PartnerDetail } | null;
    if (data?.partner) {
      setP(data.partner);
      setNoteDraft(data.partner.note ?? "");
    }
    setNote(okText ?? "Gespeichert.");
    setBusy(null);
    setConfirm(null);
    onChanged();
  }

  async function revealIban() {
    setBusy("iban");
    const res = await fetch(`/api/admin/affiliate/reveal-iban?email=${encodeURIComponent(email)}`, {
      cache: "no-store",
    }).catch(() => null);
    if (!res?.ok) setError(await readError(res));
    else {
      const data = (await res.json().catch(() => null)) as { iban?: string } | null;
      setIban(data?.iban ?? null);
    }
    setBusy(null);
  }

  if (!p) {
    return (
      <div className="mt-3 border-t border-white/[0.08] pt-3">
        {error ? <Note kind="error">{error}</Note> : (
          <p className="t-caption text-[var(--color-ink-tertiary)]">Details werden geladen…</p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 grid gap-4 border-t border-white/[0.08] pt-3">
      {error ? <Note kind="error">{error}</Note> : null}
      {note ? <Note kind="ok">{note}</Note> : null}

      {/* ------------------------------------------------------------ money */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        <Num label="Klicks" value={int(p.clicks)} />
        <Num label="Anmeldungen" value={int(p.signups)} />
        <Num label="Zahlende Kunden" value={int(p.payingCustomers)} />
        <Num label="Umsatz" value={eur(p.revenueCents)} />
        <Num label="Verdient" value={eur(p.earnedCents)} />
        <Num label="In Reifung" value={eur(p.pendingCents)} />
        <Num label="Auszahlbar" value={eur(p.availableCents)} />
        <Num label="Ausgezahlt" value={eur(p.paidCents)} />
      </div>

      {/* --------------------------------------------------------- payout data */}
      <section>
        <p className="t-eyebrow">Zahlungsdaten</p>
        <div className="mt-1 grid gap-1 text-[12.5px] text-[var(--color-ink-secondary)] sm:grid-cols-2">
          <p>{p.accountHolder || "—"}</p>
          <p>
            {iban ? (
              <span className="font-mono tracking-[0.06em] text-[var(--color-ink)]">{iban}</span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <span className="font-mono">{p.ibanMasked || "—"}</span>
                <button
                  type="button"
                  onClick={() => void revealIban()}
                  disabled={busy === "iban"}
                  className="inline-flex items-center gap-1 text-[11.5px] font-medium text-[var(--color-accent)] hover:underline disabled:opacity-40"
                >
                  <Eye className="h-3.5 w-3.5" aria-hidden />
                  {busy === "iban" ? "lädt…" : "IBAN anzeigen"}
                </button>
              </span>
            )}
          </p>
          <p className="sm:col-span-2">
            {p.address
              ? `${p.address.street}, ${p.address.postalCode} ${p.address.city}, ${p.address.country}`
              : "—"}
          </p>
          <p className="t-caption text-[var(--color-ink-quaternary)] sm:col-span-2">
            Partner seit {dt(p.createdAt)} · Mindestauszahlung {eur(p.minCents)}
            {p.payoutMinOverrideCents !== null ? " (eigener Wert)" : ""}
          </p>
          {p.history?.length ? (
            <p className="t-caption text-[var(--color-ink-quaternary)] sm:col-span-2">
              Zuletzt geändert:{" "}
              {p.history
                .slice(-3)
                .map((h) => `${h.field === "iban" ? "IBAN" : "Adresse"} ${dt(h.at)}`)
                .join(" · ")}
            </p>
          ) : null}
        </div>
      </section>

      {/* ------------------------------------------------------------ status */}
      <section>
        <p className="t-eyebrow">Status</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {p.status === "pending" ? (
            <>
              <Button onClick={() => void act("approve", null, "Freigegeben. Der Partner wurde benachrichtigt.")} disabled={busy !== null}>
                Freigeben
              </Button>
              {confirm === "reject" ? (
                <>
                  <input
                    className={cn(inputCls, "max-w-[15rem]")}
                    placeholder="Grund (geht per Mail raus)"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => void act("reject", { reason: rejectReason }, "Bewerbung abgelehnt.")}
                    disabled={busy !== null}
                    className="text-[12px] font-semibold text-red-300 hover:text-red-200"
                  >
                    Wirklich ablehnen
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirm(null)}
                    className="text-[12px] font-medium text-[var(--color-ink-tertiary)]"
                  >
                    Abbrechen
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirm("reject")}
                  className="text-[12px] font-medium text-[var(--color-ink-tertiary)] hover:text-red-300"
                >
                  Ablehnen
                </button>
              )}
            </>
          ) : p.status === "blocked" ? (
            <Button
              variant="secondary"
              onClick={() => void act("unblock", null, "Entsperrt — der Partner ist wieder aktiv.")}
              disabled={busy !== null}
            >
              Entsperren
            </Button>
          ) : (
            <button
              type="button"
              onClick={() => void act("block", null, "Gesperrt. Neue Käufe bringen keine Provision mehr.")}
              disabled={busy !== null}
              className="text-[12px] font-medium text-[var(--color-ink-tertiary)] hover:text-red-300"
            >
              Sperren
            </button>
          )}
          <button
            type="button"
            onClick={() => void act("recalc", null, "Zähler aus den Provisionszeilen neu berechnet.")}
            disabled={busy !== null}
            className="text-[12px] font-medium text-[var(--color-ink-tertiary)] hover:text-[var(--color-ink)]"
          >
            Zähler neu berechnen
          </button>
        </div>
      </section>

      {/* --------------------------------------------------------- overrides */}
      <section>
        <p className="t-eyebrow">Sonderkonditionen</p>
        <p className="t-caption mt-0.5 text-[var(--color-ink-tertiary)]">
          Leer lassen heißt: die normale Regel gilt. Änderungen wirken auf künftige Käufe, nicht
          auf bereits gebuchte Provisionen.
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <Override
            label="Fester Prozentsatz"
            unit="%"
            value={p.percentOverride}
            min={0}
            max={50}
            step={0.5}
            busy={busy !== null}
            onSave={(v) => void act("set-percent", v, v === null ? "Fester Satz entfernt." : "Fester Satz gesetzt.")}
          />
          <Override
            label="Festes Level"
            unit=""
            value={p.levelOverride}
            min={1}
            max={5}
            step={1}
            busy={busy !== null}
            onSave={(v) => void act("set-level", v === null ? null : Math.round(v), v === null ? "Festes Level entfernt." : "Festes Level gesetzt.")}
          />
          <Override
            label="Mindestauszahlung"
            unit="€"
            value={p.payoutMinOverrideCents === null ? null : p.payoutMinOverrideCents / 100}
            min={0}
            max={1000}
            step={1}
            busy={busy !== null}
            onSave={(v) =>
              void act(
                "set-min",
                v === null ? null : Math.round(v * 100),
                v === null ? "Eigene Mindestauszahlung entfernt." : "Eigene Mindestauszahlung gesetzt.",
              )
            }
          />
        </div>
      </section>

      {/* -------------------------------------------------------------- note */}
      <section>
        <p className="t-eyebrow">Interne Notiz</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <input
            className={cn(inputCls, "min-w-[14rem] flex-1")}
            maxLength={500}
            placeholder="Nur für dich sichtbar"
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
          />
          <button
            type="button"
            onClick={() => void act("note", noteDraft, "Notiz gespeichert.")}
            disabled={busy !== null || noteDraft === (p.note ?? "")}
            className="rounded-full border border-white/[0.1] px-3 py-1.5 text-[11.5px] font-medium text-[var(--color-ink-secondary)] hover:border-white/25 disabled:opacity-40"
          >
            Notiz speichern
          </button>
        </div>
      </section>

      {/* --------------------------------------------------------- referrals */}
      <section>
        <p className="t-eyebrow">Geworbene Kunden ({int(p.referrals?.length ?? 0)})</p>
        {p.referrals?.length ? (
          <div className="mt-1.5 overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse text-[12px]">
              <thead>
                <tr className="text-left text-[var(--color-ink-quaternary)]">
                  <th className="py-1 pr-3 font-medium">Kunde</th>
                  <th className="py-1 pr-3 font-medium">Geworben</th>
                  <th className="py-1 pr-3 font-medium">Erster Kauf</th>
                  <th className="py-1 pr-3 text-right font-medium">Käufe</th>
                  <th className="py-1 pr-3 text-right font-medium">Ausgegeben</th>
                  <th className="py-1 pr-3 text-right font-medium">Provision</th>
                  <th className="py-1 font-medium" />
                </tr>
              </thead>
              <tbody>
                {p.referrals.map((r) => (
                  <tr key={r.email} className="border-t border-white/[0.06]">
                    <td className="py-1.5 pr-3 text-[var(--color-ink-secondary)]">{r.email}</td>
                    <td className="tnum py-1.5 pr-3 text-[var(--color-ink-tertiary)]">
                      {dt(r.boundAt)}
                    </td>
                    <td className="tnum py-1.5 pr-3 text-[var(--color-ink-tertiary)]">
                      {r.firstPurchaseAt ? dt(r.firstPurchaseAt) : "—"}
                    </td>
                    <td className="tnum py-1.5 pr-3 text-right">{int(r.purchases)}</td>
                    <td className="tnum py-1.5 pr-3 text-right">{eur(r.spentCents)}</td>
                    <td className="tnum py-1.5 pr-3 text-right text-[var(--color-accent)]">
                      {eur(r.commissionCents)}
                    </td>
                    <td className="py-1.5 text-right">
                      {confirm === `unbind-${r.email}` ? (
                        <span className="inline-flex gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              void act("unbind", { customerEmail: r.email }, "Zuordnung gelöst.")
                            }
                            className="font-semibold text-red-300 hover:text-red-200"
                          >
                            wirklich lösen
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirm(null)}
                            className="text-[var(--color-ink-tertiary)]"
                          >
                            abbrechen
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirm(`unbind-${r.email}`)}
                          className="text-[var(--color-ink-quaternary)] hover:text-red-300"
                        >
                          lösen
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="t-caption mt-1 text-[var(--color-ink-tertiary)]">
            Noch niemand. Klicks allein erzeugen keine Zuordnung — erst der Login hinter dem Link.
          </p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            className={cn(inputCls, "max-w-[16rem]")}
            placeholder="kunde@example.com"
            aria-label="Kunde manuell zuordnen"
            value={bindEmail}
            onChange={(e) => setBindEmail(e.target.value)}
          />
          <button
            type="button"
            onClick={() =>
              void act("bind", { customerEmail: bindEmail }, `${bindEmail} zugeordnet.`).then(() =>
                setBindEmail(""),
              )
            }
            disabled={busy !== null || !bindEmail.includes("@")}
            className="rounded-full border border-white/[0.1] px-3 py-1.5 text-[11.5px] font-medium text-[var(--color-ink-secondary)] hover:border-white/25 disabled:opacity-40"
          >
            Kunde zuordnen
          </button>
          <span className="t-caption text-[var(--color-ink-quaternary)]">
            Überschreibt eine bestehende Zuordnung — der bisherige Partner verliert künftige
            Provisionen dieses Kunden.
          </span>
        </div>
      </section>

      {/* ------------------------------------------------------- commissions */}
      <section>
        <p className="t-eyebrow">Provisionen ({int(p.commissions?.length ?? 0)})</p>
        {p.commissions?.length ? (
          <ul className="mt-1.5 grid gap-1">
            {p.commissions.slice(0, 50).map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-0.5 border-t border-white/[0.06] py-1.5 text-[12px]"
              >
                <span className="tnum w-16 shrink-0 text-[var(--color-ink-tertiary)]">
                  {dt(c.at)}
                </span>
                <span className="w-20 shrink-0 text-[var(--color-ink-secondary)]">
                  {planLabel(c.plan)}
                </span>
                <span className="min-w-0 flex-1 truncate text-[var(--color-ink-tertiary)]">
                  {c.customer}
                </span>
                <span className="tnum shrink-0 text-[var(--color-ink-tertiary)]">
                  {eur(c.grossCents)} · {pct(c.percent)} · L{c.level}
                </span>
                <span className="tnum w-20 shrink-0 text-right font-semibold text-[var(--color-ink)]">
                  {eur(c.amountCents)}
                </span>
                <Pill tone={commissionTone(c.status)}>
                  {c.status === "pending"
                    ? `Reift bis ${dt(c.maturesAt)}`
                    : COMMISSION_LABEL[c.status]}
                </Pill>
              </li>
            ))}
          </ul>
        ) : (
          <p className="t-caption mt-1 text-[var(--color-ink-tertiary)]">Noch keine Provision.</p>
        )}
      </section>

      {/* ----------------------------------------------------------- payouts */}
      {p.payouts?.length ? (
        <section>
          <p className="t-eyebrow">Auszahlungen</p>
          <ul className="mt-1.5 grid gap-1">
            {p.payouts.map((po) => (
              <li
                key={po.id}
                className="flex flex-wrap items-center gap-x-3 border-t border-white/[0.06] py-1.5 text-[12px]"
              >
                <span className="tnum w-24 shrink-0 font-semibold text-[var(--color-ink)]">
                  {eur(po.amountCents)}
                </span>
                <Pill tone={payoutTone(po.status)}>{PAYOUT_LABEL[po.status]}</Pill>
                <span className="t-caption min-w-0 flex-1 truncate text-[var(--color-ink-quaternary)]">
                  beantragt {dtTime(po.requestedAt)}
                  {po.paidAt ? ` · ausgezahlt ${dtTime(po.paidAt)}` : ""}
                  {po.reference ? ` · ${po.reference}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Num({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="t-eyebrow block">{label}</span>
      <span className="tnum text-[13.5px] font-semibold text-[var(--color-ink)]">{value}</span>
    </p>
  );
}

/**
 * A number that may be "not set".
 *
 * The empty field is a real state, not a zero: an empty "fester Prozentsatz"
 * means the ladder decides, while 0 means this partner earns nothing. Those
 * two must never be one keystroke apart without saying so, hence the separate
 * "Entfernen" instead of "clear the box and save".
 */
function Override({
  label,
  unit,
  value,
  min,
  max,
  step,
  busy,
  onSave,
}: {
  label: string;
  unit: string;
  value: number | null;
  min: number;
  max: number;
  step: number;
  busy: boolean;
  onSave: (value: number | null) => void;
}) {
  const [draft, setDraft] = useState(value === null ? "" : String(value));

  useEffect(() => {
    setDraft(value === null ? "" : String(value));
  }, [value]);

  const parsed = draft.trim() === "" ? null : Number(draft.replace(",", "."));
  const valid = parsed === null || (Number.isFinite(parsed) && parsed >= min && parsed <= max);

  return (
    <div>
      <span className="t-eyebrow block">{label}</span>
      <div className="mt-1 flex items-center gap-1.5">
        <input
          className={cn(inputCls, "tnum", !valid && "border-red-500/50")}
          inputMode="decimal"
          placeholder="Standard"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        {unit ? (
          <span className="t-caption shrink-0 text-[var(--color-ink-tertiary)]">{unit}</span>
        ) : null}
      </div>
      <div className="mt-1 flex items-center gap-2">
        <button
          type="button"
          disabled={busy || !valid || parsed === null || parsed === value}
          onClick={() => onSave(parsed)}
          className="text-[11.5px] font-medium text-[var(--color-accent)] hover:underline disabled:opacity-40"
        >
          Setzen
        </button>
        {value !== null ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onSave(null)}
            className="text-[11.5px] font-medium text-[var(--color-ink-tertiary)] hover:text-[var(--color-ink)] disabled:opacity-40"
          >
            Entfernen
          </button>
        ) : null}
        {!valid ? (
          <span className="text-[11px] text-red-300">
            {min}–{max}
          </span>
        ) : null}
      </div>
    </div>
  );
}
