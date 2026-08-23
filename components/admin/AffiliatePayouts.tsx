"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Download, Eye, RefreshCw } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import {
  AdminPayoutRow,
  Note,
  PAYOUT_LABEL,
  Pill,
  downloadCsv,
  dtTime,
  eur,
  inputCls,
  int,
  payoutTone,
  readError,
  stamp,
} from "@/components/admin/AffiliateOverview";

// The payout desk.
//
// THE SYSTEM NEVER MOVES MONEY. Everything here is bookkeeping around a
// transfer that a human makes in their own banking app: mark it approved,
// export the batch, pay it, mark it paid. That is a deliberate limit — an app
// that can initiate SEPA transfers is a very different piece of software with
// very different consequences when it is wrong.
//
// THE FULL IBAN IS ONE CLICK AWAY, NOT ON THE SCREEN. The list shows the last
// four digits; the real number is fetched per row from
// /api/admin/affiliate/reveal-iban, which logs the access without logging the
// number. Rendering every partner's bank details just because the page loaded
// would put them into a browser cache, a screenshot and a shoulder-surf.

type Filter = "offen" | "alle" | "erledigt";

export function AffiliatePayouts() {
  const [rows, setRows] = useState<AdminPayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("offen");
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [reference, setReference] = useState<Record<string, string>>({});
  const [reason, setReason] = useState<Record<string, string>>({});
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [iban, setIban] = useState<Record<string, string>>({});
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/affiliate/payouts", { cache: "no-store" }).catch(() => null);
    if (!res?.ok) {
      setError(await readError(res));
      setLoading(false);
      return;
    }
    const data = (await res.json().catch(() => null)) as { payouts?: AdminPayoutRow[] } | null;
    setRows(Array.isArray(data?.payouts) ? data.payouts : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = useMemo(() => {
    if (filter === "alle") return rows;
    if (filter === "erledigt")
      return rows.filter((p) => p.status === "paid" || p.status === "rejected");
    return rows.filter((p) => p.status === "requested" || p.status === "approved");
  }, [rows, filter]);

  const openRows = useMemo(
    () => rows.filter((p) => p.status === "requested" || p.status === "approved"),
    [rows],
  );

  async function decide(p: AdminPayoutRow, action: "approve" | "paid" | "reject") {
    setBusy(p.id);
    setError(null);
    setNote(null);
    const res = await fetch("/api/admin/affiliate/payouts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: p.id,
        action,
        reference: reference[p.id] ?? "",
        reason: reason[p.id] ?? "",
      }),
    }).catch(() => null);

    if (!res?.ok) {
      setError(await readError(res));
      setBusy(null);
      return;
    }
    setNote(
      action === "paid"
        ? `${eur(p.amountCents)} an ${p.name || p.affiliateEmail} als ausgezahlt vermerkt. Der Partner wurde benachrichtigt.`
        : action === "approve"
          ? "Antrag genehmigt. Die Überweisung machst du in deiner Bank — danach hier auf „ausgezahlt“ setzen."
          : "Antrag abgelehnt. Die Provisionen sind wieder auszahlbar.",
    );
    setBusy(null);
    setRejecting(null);
    void load();
  }

  /** One deliberate click, one row. Never on load, never in a loop over the list. */
  async function reveal(p: AdminPayoutRow) {
    setBusy(`iban-${p.id}`);
    const value = await fetchIban(p.affiliateEmail);
    if (value.ok) setIban((m) => ({ ...m, [p.id]: value.iban }));
    else setError(value.error);
    setBusy(null);
  }

  /**
   * The SEPA batch.
   *
   * This is the one place that pulls several IBANs at once, and it says so
   * before it does it: the file that lands in the download folder is a list of
   * names and bank accounts, which is a different thing from a screen you can
   * close.
   */
  async function exportSepa() {
    if (openRows.length === 0) return;
    setExporting(true);
    setError(null);

    const lines: Array<Array<string | number>> = [
      ["Kontoinhaber", "IBAN", "Betrag", "Waehrung", "Verwendungszweck", "Partner", "Antrag"],
    ];
    let failed = 0;

    for (const p of openRows) {
      const res = await fetchIban(p.affiliateEmail);
      if (!res.ok) {
        failed += 1;
        continue;
      }
      lines.push([
        p.snapshot?.accountHolder ?? p.name,
        res.iban,
        (p.amountCents / 100).toFixed(2).replace(".", ","),
        "EUR",
        `Provision ${p.id}`,
        p.affiliateEmail,
        p.id,
      ]);
    }

    if (lines.length > 1) downloadCsv(`affiliate-auszahlungen-${stamp()}.csv`, lines);
    setNote(
      failed === 0
        ? `${lines.length - 1} Auszahlung${lines.length - 1 === 1 ? "" : "en"} exportiert. Die Datei enthält Bankdaten — nach der Überweisung löschen.`
        : `${lines.length - 1} exportiert, ${failed} ohne lesbare IBAN übersprungen. Diese Partner musst du einzeln prüfen.`,
    );
    setExporting(false);
  }

  return (
    <div className="mt-6 grid gap-5">
      {error ? <Note kind="error">{error}</Note> : null}
      {note ? <Note kind="ok">{note}</Note> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5">
          {(["offen", "erledigt", "alle"] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-full px-3 py-1.5 text-[11.5px]",
                filter === f
                  ? "bg-[var(--color-accent)] font-semibold text-[var(--color-accent-ink)]"
                  : "border border-white/[0.1] font-medium text-[var(--color-ink-secondary)] hover:border-white/25",
              )}
            >
              {f === "offen" ? `Offen${openRows.length ? ` (${openRows.length})` : ""}` : f === "erledigt" ? "Erledigt" : "Alle"}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void exportSepa()}
            disabled={openRows.length === 0 || exporting}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] px-3 py-1.5 text-[11.5px] font-medium text-[var(--color-ink-secondary)] hover:border-white/25 disabled:opacity-40"
          >
            <Download className={cn("h-3.5 w-3.5", exporting && "animate-pulse")} aria-hidden />
            {exporting ? "Exportiert…" : "Offene als CSV"}
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
      </div>

      {loading && rows.length === 0 ? (
        <p className="t-caption text-[var(--color-ink-tertiary)]">Wird geladen…</p>
      ) : shown.length === 0 ? (
        <p className="t-caption text-[var(--color-ink-tertiary)]">
          {rows.length === 0
            ? "Noch kein Auszahlungsantrag. Partner können erst ab dem Mindestbetrag beantragen, und Provisionen müssen vorher ihre Reifezeit hinter sich haben."
            : "Nichts in dieser Ansicht."}
        </p>
      ) : (
        <ul className="grid gap-2">
          {shown.map((p) => {
            const isOpen = open === p.id;
            const decidable = p.status === "requested" || p.status === "approved";
            return (
              <li
                key={p.id}
                className="rounded-2xl border border-white/[0.08] bg-white/[0.02] px-3.5 py-3"
              >
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : p.id)}
                  aria-expanded={isOpen}
                  className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 text-left"
                >
                  <span className="tnum shrink-0 text-[14px] font-semibold text-[var(--color-ink)]">
                    {eur(p.amountCents)}
                  </span>
                  <Pill tone={payoutTone(p.status)}>{PAYOUT_LABEL[p.status]}</Pill>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-[var(--color-ink-secondary)]">
                      {p.name || p.affiliateEmail}
                    </span>
                    <span className="t-caption block truncate text-[var(--color-ink-quaternary)]">
                      {p.affiliateEmail} · beantragt {dtTime(p.requestedAt)} ·{" "}
                      {int(p.commissionIds?.length ?? 0)} Provisionen
                    </span>
                  </span>
                  <span className="t-caption shrink-0 text-[var(--color-ink-quaternary)]">
                    {isOpen ? "schließen" : "öffnen"}
                  </span>
                </button>

                {isOpen ? (
                  <div className="mt-3 grid gap-3 border-t border-white/[0.08] pt-3">
                    <div className="grid gap-1 text-[12.5px] text-[var(--color-ink-secondary)] sm:grid-cols-2">
                      <p>
                        <span className="t-eyebrow block">Kontoinhaber</span>
                        {p.snapshot?.accountHolder || "—"}
                      </p>
                      <p>
                        <span className="t-eyebrow block">IBAN</span>
                        {iban[p.id] ? (
                          <span className="font-mono tracking-[0.06em] text-[var(--color-ink)]">
                            {iban[p.id]}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-2">
                            <span className="font-mono">{p.ibanMasked || "—"}</span>
                            <button
                              type="button"
                              onClick={() => void reveal(p)}
                              disabled={busy === `iban-${p.id}`}
                              className="inline-flex items-center gap-1 text-[11.5px] font-medium text-[var(--color-accent)] hover:underline disabled:opacity-40"
                            >
                              <Eye className="h-3.5 w-3.5" aria-hidden />
                              {busy === `iban-${p.id}` ? "lädt…" : "anzeigen"}
                            </button>
                          </span>
                        )}
                      </p>
                      <p className="sm:col-span-2">
                        <span className="t-eyebrow block">Anschrift zum Antragszeitpunkt</span>
                        {p.snapshot?.address
                          ? `${p.snapshot.address.street}, ${p.snapshot.address.postalCode} ${p.snapshot.address.city}, ${p.snapshot.address.country}`
                          : "—"}
                      </p>
                      {p.paidAt ? (
                        <p>
                          <span className="t-eyebrow block">Ausgezahlt</span>
                          {dtTime(p.paidAt)}
                          {p.reference ? ` · ${p.reference}` : ""}
                        </p>
                      ) : null}
                      {p.rejectionReason ? (
                        <p>
                          <span className="t-eyebrow block">Abgelehnt weil</span>
                          {p.rejectionReason}
                        </p>
                      ) : null}
                    </div>

                    {decidable ? (
                      <div className="grid gap-2">
                        <label className="block">
                          <span className="t-eyebrow block">Verwendungszweck / Referenz</span>
                          <input
                            className={cn(inputCls, "mt-1")}
                            placeholder={`Provision ${p.id}`}
                            value={reference[p.id] ?? ""}
                            onChange={(e) =>
                              setReference((m) => ({ ...m, [p.id]: e.target.value }))
                            }
                          />
                        </label>

                        <div className="flex flex-wrap items-center gap-2">
                          {p.status === "requested" ? (
                            <Button
                              variant="secondary"
                              onClick={() => void decide(p, "approve")}
                              disabled={busy === p.id}
                            >
                              Genehmigen
                            </Button>
                          ) : null}
                          <Button onClick={() => void decide(p, "paid")} disabled={busy === p.id}>
                            {busy === p.id ? "…" : "Als ausgezahlt markieren"}
                          </Button>
                          {rejecting === p.id ? (
                            <>
                              <input
                                className={cn(inputCls, "max-w-[16rem]")}
                                placeholder="Grund für die Ablehnung"
                                value={reason[p.id] ?? ""}
                                onChange={(e) =>
                                  setReason((m) => ({ ...m, [p.id]: e.target.value }))
                                }
                              />
                              <button
                                type="button"
                                onClick={() => void decide(p, "reject")}
                                disabled={busy === p.id}
                                className="text-[12px] font-semibold text-red-300 hover:text-red-200 disabled:opacity-40"
                              >
                                Wirklich ablehnen
                              </button>
                              <button
                                type="button"
                                onClick={() => setRejecting(null)}
                                className="text-[12px] font-medium text-[var(--color-ink-tertiary)]"
                              >
                                Abbrechen
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setRejecting(p.id)}
                              className="text-[12px] font-medium text-[var(--color-ink-tertiary)] hover:text-red-300"
                            >
                              Ablehnen
                            </button>
                          )}
                        </div>
                        <p className="t-caption text-[var(--color-ink-quaternary)]">
                          Ablehnen gibt die {int(p.commissionIds?.length ?? 0)} Provisionen wieder
                          frei — der Partner kann danach erneut beantragen.
                        </p>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <p className="t-caption flex items-start gap-2 text-[var(--color-ink-quaternary)]">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          Überwiesen wird in deiner Bank, nicht hier. Der CSV-Export enthält vollständige
          Bankdaten — er ist zum Hochladen ins Banking gedacht und danach zu löschen.
        </span>
      </p>
    </div>
  );
}

async function fetchIban(
  email: string,
): Promise<{ ok: true; iban: string } | { ok: false; error: string }> {
  const res = await fetch(`/api/admin/affiliate/reveal-iban?email=${encodeURIComponent(email)}`, {
    cache: "no-store",
  }).catch(() => null);
  if (!res?.ok) {
    const why = await readError(res);
    return {
      ok: false,
      error:
        why === "pii_unconfigured"
          ? "Kein Schlüssel für die Bankdaten: AUTH_SECRET fehlt oder ist zu kurz, und AFFILIATE_PII_KEY ist nicht gesetzt."
          : why === "decrypt_failed"
            ? `Die IBAN von ${email} lässt sich nicht entschlüsseln. Das passiert, wenn AUTH_SECRET oder AFFILIATE_PII_KEY seit dem Speichern gewechselt wurde.`
            : why,
    };
  }
  const data = (await res.json().catch(() => null)) as { iban?: string } | null;
  return data?.iban ? { ok: true, iban: data.iban } : { ok: false, error: "Keine IBAN hinterlegt." };
}
