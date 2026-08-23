"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, Download, Plus, RefreshCw, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import type { InviteCode } from "@/lib/affiliate/model";
import {
  Field,
  Note,
  Pill,
  dt,
  downloadCsv,
  inputCls,
  int,
  readError,
  stamp,
} from "@/components/admin/AffiliateOverview";

// Access codes for the application form.
//
// They only matter when the programme is set to "Anmeldung nur mit Code" — the
// screen says so rather than hiding, because generating codes that nothing
// checks is a trap you would only notice when the first partner complains.
//
// A generated batch is shown ONCE as a block, because that is how it gets used:
// pasted into a DM, a spreadsheet, a story. Codes are not secret in the way a
// password is (they are single-use permits by default), so a copy button beats
// making the operator select thirty lines by hand.

interface CodesResponse {
  codes?: InviteCode[];
}

type Filter = "offen" | "alle" | "verbraucht";

export function AffiliateCodes() {
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("offen");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // The generator's form state.
  const [count, setCount] = useState(10);
  const [maxUses, setMaxUses] = useState(1);
  const [expires, setExpires] = useState("");
  const [codeNote, setCodeNote] = useState("");
  const [created, setCreated] = useState<InviteCode[] | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/affiliate/codes", { cache: "no-store" }).catch(() => null);
    if (!res?.ok) {
      setError(await readError(res));
      setLoading(false);
      return;
    }
    const data = (await res.json().catch(() => null)) as CodesResponse | null;
    setCodes(Array.isArray(data?.codes) ? data.codes : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = useMemo(() => {
    if (filter === "alle") return codes;
    if (filter === "verbraucht") return codes.filter((c) => c.uses >= c.maxUses || c.disabled);
    return codes.filter((c) => !c.disabled && c.uses < c.maxUses);
  }, [codes, filter]);

  async function generate() {
    setBusy("generate");
    setError(null);
    setNote(null);
    setCreated(null);

    // A date input gives a day, and a code that dies at 00:00 of the day the
    // operator typed would be dead on arrival. End of that day is what "gültig
    // bis" means to a human.
    const expiresAt = expires ? new Date(`${expires}T23:59:59`).getTime() : null;

    const res = await fetch("/api/admin/affiliate/codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count, maxUses, expiresAt, note: codeNote }),
    }).catch(() => null);

    if (!res?.ok) {
      setError(await readError(res));
      setBusy(null);
      return;
    }
    const data = (await res.json().catch(() => null)) as {
      created?: InviteCode[];
      incomplete?: boolean;
    } | null;
    setCreated(data?.created ?? []);
    setCopied(false);
    if (data?.incomplete) {
      setNote(
        `Nur ${data.created?.length ?? 0} von ${count} Codes konnten angelegt werden — der Speicher hat abgebrochen. Die angelegten sind gültig.`,
      );
    }
    setBusy(null);
    void load();
  }

  async function setDisabled(code: string, disabled: boolean) {
    setBusy(code);
    setError(null);
    const res = await fetch("/api/admin/affiliate/codes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, disabled }),
    }).catch(() => null);
    if (!res?.ok) setError(await readError(res));
    setBusy(null);
    void load();
  }

  async function remove(code: string) {
    setBusy(code);
    setError(null);
    const res = await fetch(`/api/admin/affiliate/codes?code=${encodeURIComponent(code)}`, {
      method: "DELETE",
    }).catch(() => null);
    if (!res?.ok) setError(await readError(res));
    setBusy(null);
    setConfirming(null);
    void load();
  }

  async function copyBatch() {
    if (!created?.length) return;
    try {
      await navigator.clipboard.writeText(created.map((c) => c.code).join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Die Zwischenablage hat abgelehnt. Markiere den Block und kopiere ihn von Hand.");
    }
  }

  function exportCsv() {
    downloadCsv(
      `affiliate-codes-${stamp()}.csv`,
      [
        ["Code", "Erstellt", "Gültig bis", "Nutzungen", "Maximal", "Deaktiviert", "Notiz", "Benutzt von"],
        ...codes.map((c) => [
          c.code,
          dt(c.createdAt),
          c.expiresAt ? dt(c.expiresAt) : "unbegrenzt",
          c.uses,
          c.maxUses,
          c.disabled ? "ja" : "nein",
          c.note,
          c.usedBy.join(" "),
        ]),
      ],
    );
  }

  return (
    <div className="mt-6 grid gap-6">
      {error ? <Note kind="error">{error}</Note> : null}
      {note ? <Note kind="info">{note}</Note> : null}

      {/* ------------------------------------------------------- generator */}
      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] px-3.5 py-3.5">
        <p className="t-eyebrow">Codes erzeugen</p>
        <div className="mt-2 grid gap-3 sm:grid-cols-4">
          <Field label="Anzahl" hint="1 bis 100">
            <input
              className={cn(inputCls, "tnum")}
              type="number"
              min={1}
              max={100}
              step={1}
              value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(100, Math.round(Number(e.target.value)))))}
            />
          </Field>
          <Field label="Nutzungen je Code" hint="1 = Einmalcode">
            <input
              className={cn(inputCls, "tnum")}
              type="number"
              min={1}
              max={1000}
              step={1}
              value={maxUses}
              onChange={(e) =>
                setMaxUses(Math.max(1, Math.min(1000, Math.round(Number(e.target.value)))))
              }
            />
          </Field>
          <Field label="Gültig bis" hint="leer = unbegrenzt">
            <input
              className={inputCls}
              type="date"
              value={expires}
              onChange={(e) => setExpires(e.target.value)}
            />
          </Field>
          <Field label="Notiz" hint="wofür die Charge war">
            <input
              className={inputCls}
              maxLength={120}
              placeholder="Instagram-Aktion"
              value={codeNote}
              onChange={(e) => setCodeNote(e.target.value)}
            />
          </Field>
        </div>
        <div className="mt-3">
          <Button onClick={() => void generate()} disabled={busy === "generate"}>
            <Plus className="mr-1.5 inline h-4 w-4" aria-hidden />
            {busy === "generate" ? "Erzeugt…" : `${count} Code${count === 1 ? "" : "s"} erzeugen`}
          </Button>
        </div>

        {created && created.length > 0 ? (
          <div className="mt-4">
            <div className="flex items-center justify-between gap-3">
              <p className="t-eyebrow">
                {created.length} neue{created.length === 1 ? "r" : ""} Code
                {created.length === 1 ? "" : "s"}
              </p>
              <button
                type="button"
                onClick={() => void copyBatch()}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] px-3 py-1.5 text-[11.5px] font-medium text-[var(--color-ink-secondary)] hover:border-white/25"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-[var(--color-accent)]" aria-hidden />
                ) : (
                  <Copy className="h-3.5 w-3.5" aria-hidden />
                )}
                {copied ? "Kopiert" : "Alle kopieren"}
              </button>
            </div>
            <pre className="mt-2 max-h-52 overflow-auto rounded-xl border border-white/[0.08] bg-black/30 px-3 py-2.5 font-mono text-[13px] leading-relaxed tracking-[0.08em] text-[var(--color-ink)]">
              {created.map((c) => c.code).join("\n")}
            </pre>
          </div>
        ) : null}
      </section>

      {/* ------------------------------------------------------------ list */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1.5">
            {(["offen", "verbraucht", "alle"] as Filter[]).map((f) => (
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
                {f === "offen" ? "Offen" : f === "verbraucht" ? "Verbraucht" : "Alle"}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={exportCsv}
              disabled={codes.length === 0}
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
        </div>

        {loading && codes.length === 0 ? (
          <p className="t-caption mt-3 text-[var(--color-ink-tertiary)]">Wird geladen…</p>
        ) : shown.length === 0 ? (
          <p className="t-caption mt-3 text-[var(--color-ink-tertiary)]">
            {codes.length === 0
              ? "Noch keine Codes. Sie werden erst gebraucht, wenn die Anmeldung auf „nur mit Code“ steht."
              : "Kein Code in dieser Ansicht."}
          </p>
        ) : (
          <ul className="mt-3 grid gap-1.5">
            {shown.map((c) => {
              const used = c.uses >= c.maxUses;
              const expired = c.expiresAt !== null && c.expiresAt < Date.now();
              return (
                <li
                  key={c.code}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-2xl border border-white/[0.08] bg-white/[0.02] px-3.5 py-2.5"
                >
                  <span className="font-mono text-[13.5px] font-semibold tracking-[0.1em] text-[var(--color-ink)]">
                    {c.code}
                  </span>
                  {c.disabled ? <Pill tone="danger">Deaktiviert</Pill> : null}
                  {expired && !c.disabled ? <Pill tone="muted">Abgelaufen</Pill> : null}
                  {used && !c.disabled && !expired ? <Pill tone="muted">Verbraucht</Pill> : null}
                  {!used && !expired && !c.disabled ? <Pill tone="accent">Offen</Pill> : null}

                  <span className="t-caption tnum text-[var(--color-ink-tertiary)]">
                    {int(c.uses)}/{int(c.maxUses)} genutzt
                  </span>
                  <span className="t-caption text-[var(--color-ink-quaternary)]">
                    erstellt {dt(c.createdAt)}
                    {c.expiresAt ? ` · gültig bis ${dt(c.expiresAt)}` : ""}
                  </span>
                  {c.note ? (
                    <span className="t-caption min-w-0 flex-1 truncate text-[var(--color-ink-tertiary)]">
                      {c.note}
                    </span>
                  ) : (
                    <span className="min-w-0 flex-1" />
                  )}

                  {c.usedBy.length > 0 ? (
                    <span className="t-caption w-full text-[var(--color-ink-quaternary)]">
                      benutzt von {c.usedBy.join(", ")}
                    </span>
                  ) : null}

                  <span className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      disabled={busy === c.code}
                      onClick={() => void setDisabled(c.code, !c.disabled)}
                      className="text-[11.5px] font-medium text-[var(--color-ink-secondary)] hover:text-[var(--color-ink)] disabled:opacity-40"
                    >
                      {c.disabled ? "Aktivieren" : "Deaktivieren"}
                    </button>
                    {confirming === c.code ? (
                      <>
                        <button
                          type="button"
                          disabled={busy === c.code}
                          onClick={() => void remove(c.code)}
                          className="text-[11.5px] font-semibold text-red-300 hover:text-red-200 disabled:opacity-40"
                        >
                          Wirklich löschen
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirming(null)}
                          className="text-[11.5px] font-medium text-[var(--color-ink-tertiary)]"
                        >
                          Abbrechen
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        aria-label={`Code ${c.code} löschen`}
                        onClick={() => setConfirming(c.code)}
                        className="text-[var(--color-ink-quaternary)] hover:text-red-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
