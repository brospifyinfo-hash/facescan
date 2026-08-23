"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import type { AffiliateConfig, LevelRule } from "@/lib/affiliate/model";
import { Field, Note, eur, inputCls, pct, readError } from "@/components/admin/AffiliateOverview";

// The settings screen: the money rules, in one form.
//
// TWO THINGS IT REFUSES TO DO
//
// 1. It does not save field by field. The server validates the whole config
//    and rejects all of it on the first bad value (lib/affiliate/config.ts),
//    and this form mirrors that: one "Speichern", one answer. A ladder that
//    is half-applied is a rate nobody agreed to.
//
// 2. It does not recompute anything that has already been earned. Changing a
//    percentage here changes the NEXT sale — every commission line carries
//    the rate it was booked at. That sentence is on the screen, because it is
//    the first question anybody asks before touching these numbers.

type Draft = AffiliateConfig;

export function AffiliateSettings() {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saved, setSaved] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErrors([]);
    const res = await fetch("/api/admin/affiliate/config", { cache: "no-store" }).catch(() => null);
    if (!res?.ok) {
      setErrors([await readError(res)]);
      setLoading(false);
      return;
    }
    const data = (await res.json().catch(() => null)) as { config?: AffiliateConfig } | null;
    if (data?.config) {
      setDraft(data.config);
      setSaved(data.config);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = Boolean(draft && saved && JSON.stringify(draft) !== JSON.stringify(saved));

  function patch(next: Partial<Draft>) {
    setDraft((d) => (d ? { ...d, ...next } : d));
    setNote(null);
  }

  function patchLevel(level: number, next: Partial<LevelRule>) {
    setDraft((d) =>
      d ? { ...d, levels: d.levels.map((l) => (l.level === level ? { ...l, ...next } : l)) } : d,
    );
    setNote(null);
  }

  async function save() {
    if (!draft) return;
    setBusy(true);
    setErrors([]);
    setNote(null);
    const res = await fetch("/api/admin/affiliate/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config: draft }),
    }).catch(() => null);

    if (!res?.ok) {
      const data = (await res?.json().catch(() => null)) as { errors?: string[] } | null;
      setErrors(data?.errors?.length ? data.errors : [await readError(res)]);
      setBusy(false);
      return;
    }
    const data = (await res.json().catch(() => null)) as { config?: AffiliateConfig } | null;
    if (data?.config) {
      setDraft(data.config);
      setSaved(data.config);
    }
    setNote("Gespeichert. Die neuen Sätze gelten ab dem nächsten Kauf.");
    setBusy(false);
  }

  if (loading && !draft) {
    return <p className="t-caption mt-6 text-[var(--color-ink-tertiary)]">Wird geladen…</p>;
  }
  if (!draft) {
    return (
      <div className="mt-6">
        <Note kind="error">{errors[0] ?? "Die Einstellungen konnten nicht geladen werden."}</Note>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] px-3 py-1.5 text-[11.5px] font-medium text-[var(--color-ink-secondary)] hover:border-white/25"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          Erneut versuchen
        </button>
      </div>
    );
  }

  const levels = [...draft.levels].sort((a, b) => a.level - b.level);

  return (
    <div className="mt-6 grid gap-7">
      {errors.length > 0 ? (
        <Note kind="error">
          <span className="block font-semibold">Nicht gespeichert:</span>
          <ul className="mt-1 list-disc pl-4">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </Note>
      ) : null}
      {note ? <Note kind="ok">{note}</Note> : null}

      {/* ------------------------------------------------------- programme */}
      <section>
        <p className="t-eyebrow">Programm</p>
        <div className="mt-2 grid gap-2">
          <Toggle
            checked={draft.enabled}
            onChange={(v) => patch({ enabled: v })}
            label="Partnerprogramm aktiv"
            hint="Aus: keine neuen Bindungen, keine neuen Provisionen, /partner zeigt einen Hinweis. Bereits gebuchte Provisionen bleiben bestehen und können weiter ausgezahlt werden."
          />
          <Toggle
            checked={draft.joinMode === "code"}
            onChange={(v) => patch({ joinMode: v ? "code" : "open" })}
            label="Anmeldung nur mit Zugangscode"
            hint="Aus: jeder eingeloggte Kunde kann sich bewerben. An: es braucht einen Code aus dem Reiter „Codes“."
          />
          <Toggle
            checked={draft.requireApproval}
            onChange={(v) => patch({ requireApproval: v })}
            label="Bewerbungen müssen freigegeben werden"
            hint="An: neue Partner landen auf „Wartet auf Freigabe“ und verdienen erst nach deinem Klick. Ihre Links funktionieren trotzdem schon — die Zuordnung wird beim Kauf entschieden."
          />
          <Toggle
            checked={draft.selfReferralBlocked}
            onChange={(v) => patch({ selfReferralBlocked: v })}
            label="Eigenkäufe zählen nicht"
            hint="Aus wäre ein Rabatt, den sich jeder selbst gibt."
          />
        </div>
      </section>

      {/* ---------------------------------------------------------- levels */}
      <section>
        <p className="t-eyebrow">Die fünf Level</p>
        <p className="t-caption mt-1 text-[var(--color-ink-tertiary)]">
          Die Schwelle zählt <strong className="text-[var(--color-ink-secondary)]">zahlende</strong>{" "}
          geworbene Kunden — nicht Klicks, nicht Anmeldungen. Ein Kunde, der dreimal kauft, zählt
          einmal. Level 1 beginnt immer bei 0, die Schwellen müssen aufsteigen.
        </p>

        <div className="mt-3 grid gap-2">
          <div className="hidden grid-cols-[2rem_1fr_7rem_6rem] gap-2 px-1 sm:grid">
            <span className="t-eyebrow">Lvl</span>
            <span className="t-eyebrow">Name</span>
            <span className="t-eyebrow">ab Kunden</span>
            <span className="t-eyebrow">Provision</span>
          </div>
          {levels.map((l) => (
            <div
              key={l.level}
              className="grid grid-cols-[2rem_1fr] items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 sm:grid-cols-[2rem_1fr_7rem_6rem]"
            >
              <span className="tnum text-[13px] font-semibold text-[var(--color-accent)]">
                {l.level}
              </span>
              <input
                className={inputCls}
                value={l.label}
                maxLength={40}
                aria-label={`Name von Level ${l.level}`}
                onChange={(e) => patchLevel(l.level, { label: e.target.value })}
              />
              <label className="col-span-2 flex items-center gap-2 sm:col-span-1">
                <span className="t-caption w-20 text-[var(--color-ink-tertiary)] sm:hidden">
                  ab Kunden
                </span>
                <input
                  className={cn(inputCls, "tnum")}
                  type="number"
                  min={0}
                  step={1}
                  value={l.minReferrals}
                  disabled={l.level === 1}
                  aria-label={`Schwelle von Level ${l.level}`}
                  onChange={(e) =>
                    patchLevel(l.level, { minReferrals: Math.max(0, Number(e.target.value)) })
                  }
                />
              </label>
              <label className="col-span-2 flex items-center gap-2 sm:col-span-1">
                <span className="t-caption w-20 text-[var(--color-ink-tertiary)] sm:hidden">
                  Provision
                </span>
                <input
                  className={cn(inputCls, "tnum")}
                  type="number"
                  min={0}
                  max={50}
                  step={0.5}
                  value={l.percent}
                  aria-label={`Provision von Level ${l.level}`}
                  onChange={(e) => patchLevel(l.level, { percent: Number(e.target.value) })}
                />
              </label>
            </div>
          ))}
        </div>

        <Preview draft={draft} />
      </section>

      {/* ------------------------------------------------------- accounting */}
      <section>
        <p className="t-eyebrow">Abrechnung</p>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <Field
            label="Provisionsumfang"
            hint="Lebenslang: jeder Kauf des geworbenen Kunden zählt. Erstkauf: nur der erste."
          >
            <select
              className={inputCls}
              value={draft.commissionScope}
              onChange={(e) =>
                patch({ commissionScope: e.target.value === "first" ? "first" : "lifetime" })
              }
            >
              <option value="lifetime">Lebenslang</option>
              <option value="first">Nur Erstkauf</option>
            </select>
          </Field>

          <Field
            label="Berechnungsbasis"
            hint="Netto rechnet die MwSt. heraus, die Stripe beim Kauf berechnet hat — nicht den Satz von heute."
          >
            <select
              className={inputCls}
              value={draft.commissionBase}
              onChange={(e) => patch({ commissionBase: e.target.value === "net" ? "net" : "gross" })}
            >
              <option value="gross">Brutto (der gezahlte Betrag)</option>
              <option value="net">Netto (ohne MwSt.)</option>
            </select>
          </Field>

          {draft.commissionBase === "net" ? (
            <Field label="MwSt.-Satz in %" hint="Nur als Rückfallwert, wenn der Kauf keinen trägt.">
              <input
                className={cn(inputCls, "tnum")}
                type="number"
                min={0}
                max={30}
                step={0.5}
                value={draft.vatPercent}
                onChange={(e) => patch({ vatPercent: Number(e.target.value) })}
              />
            </Field>
          ) : null}

          <Field
            label="Cookie-Laufzeit in Tagen"
            hint="So lange nach dem Klick zählt ein späterer Login noch auf den Partner."
          >
            <input
              className={cn(inputCls, "tnum")}
              type="number"
              min={1}
              max={365}
              step={1}
              value={draft.cookieDays}
              onChange={(e) => patch({ cookieDays: Math.round(Number(e.target.value)) })}
            />
          </Field>

          <Field
            label="Reifezeit in Tagen"
            hint="Dein Erstattungsfenster. So lange steht eine Provision auf „In Reifung“ und ist nicht auszahlbar."
          >
            <input
              className={cn(inputCls, "tnum")}
              type="number"
              min={0}
              max={90}
              step={1}
              value={draft.holdDays}
              onChange={(e) => patch({ holdDays: Math.round(Number(e.target.value)) })}
            />
          </Field>

          <Field
            label="Mindestauszahlung in Euro"
            hint="Darunter kann niemand beantragen. Einzelne Partner können im Reiter „Partner“ davon ausgenommen werden."
          >
            <input
              className={cn(inputCls, "tnum")}
              type="number"
              min={0}
              max={1000}
              step={1}
              value={Math.round(draft.payoutMinCents / 100)}
              onChange={(e) =>
                patch({ payoutMinCents: Math.max(0, Math.round(Number(e.target.value) * 100)) })
              }
            />
          </Field>
        </div>
      </section>

      {/* ------------------------------------------------------------ terms */}
      <section>
        <p className="t-eyebrow">Teilnahmebedingungen</p>
        <p className="t-caption mt-1 text-[var(--color-ink-tertiary)]">
          Steht im Bewerbungsformular und muss dort abgehakt werden. Dies ist dein Text, kein
          Rechtsrat von uns.
        </p>
        <textarea
          className={cn(inputCls, "mt-2 min-h-[9rem] leading-relaxed")}
          value={draft.terms}
          maxLength={4000}
          onChange={(e) => patch({ terms: e.target.value })}
        />
        <p className="t-caption mt-1 text-right text-[var(--color-ink-quaternary)]">
          {draft.terms.length} / 4000
        </p>
      </section>

      <div className="sticky bottom-4 flex flex-wrap items-center gap-3">
        <Button onClick={() => void save()} disabled={busy || !dirty}>
          {busy ? "Speichert…" : "Speichern"}
        </Button>
        {dirty ? (
          <button
            type="button"
            onClick={() => {
              setDraft(saved);
              setErrors([]);
              setNote(null);
            }}
            className="text-[12px] font-medium text-[var(--color-ink-tertiary)] hover:text-[var(--color-ink-secondary)]"
          >
            Änderungen verwerfen
          </button>
        ) : (
          <span className="t-caption text-[var(--color-ink-quaternary)]">
            Keine offenen Änderungen
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * What the numbers above actually pay.
 *
 * Computed from the DRAFT, not from the saved config: the point is to see the
 * consequence before saving it. 100 € is the example because it makes the
 * percentage readable as euros without arithmetic.
 */
function Preview({ draft }: { draft: Draft }) {
  const example = 10000;
  const base =
    draft.commissionBase === "net"
      ? Math.round(example / (1 + (Number.isFinite(draft.vatPercent) ? draft.vatPercent : 0) / 100))
      : example;

  return (
    <div className="mt-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] px-3.5 py-3">
      <p className="t-eyebrow">Bei 100 € Umsatz zahlt gerade</p>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
        {[...draft.levels]
          .sort((a, b) => a.level - b.level)
          .map((l) => (
            <span key={l.level} className="tnum text-[12.5px] text-[var(--color-ink-secondary)]">
              L{l.level}{" "}
              <strong className="font-semibold text-[var(--color-ink)]">
                {eur(Math.round((base * l.percent) / 100))}
              </strong>{" "}
              <span className="text-[var(--color-ink-quaternary)]">({pct(l.percent)})</span>
            </span>
          ))}
      </div>
      {draft.commissionBase === "net" ? (
        <p className="t-caption mt-1.5 text-[var(--color-ink-tertiary)]">
          Basis sind {eur(base)} netto, nicht die vollen 100 €.
        </p>
      ) : null}
      <p className="t-caption mt-1.5 text-[var(--color-ink-tertiary)]">
        Gilt ab dem nächsten Kauf. Bereits gebuchte Provisionen behalten ihren Satz — sonst würde
        eine Änderung hier rückwirkend ändern, was ein Partner schon verdient hat.
      </p>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] px-3.5 py-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-accent)]"
      />
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-[var(--color-ink)]">{label}</span>
        {hint ? (
          <span className="t-caption mt-0.5 block leading-relaxed text-[var(--color-ink-tertiary)]">
            {hint}
          </span>
        ) : null}
      </span>
    </label>
  );
}
