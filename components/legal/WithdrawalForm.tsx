"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { fetchUser } from "@/lib/auth/client";
import { CONTACT_EMAIL, addressLines, operatorLine } from "@/lib/legal";

// Das Widerrufsformular.
//
// ES ERSETZT DAS MUSTERFORMULAR NICHT, ES STEHT DANEBEN. Art. 246a §1
// Abs. 2 Satz 1 Nr. 1 EGBGB verlangt, dass wir das Muster-Widerrufsformular
// ZUR VERFÜGUNG STELLEN — es bleibt also zum Abschreiben auf der Seite. Wer
// es ausfüllen und abschicken will, statt es abzutippen, nimmt dieses hier.
//
// NUR ZWEI PFLICHTFELDER. Ein Widerruf braucht keine Begründung (§355
// Abs. 1 BGB), und wer seine Bestellnummer nicht findet, darf trotzdem
// widerrufen. Jedes zusätzliche Sternchen wäre eine Hürde, die das Gesetz
// nicht kennt — und ein Formular, das mehr verlangt als der Gesetzgeber,
// ist ein Formular, das Widerrufe verhindert. Genau das darf es nicht.
//
// WAS PASSIERT, WENN DER VERSAND SCHEITERT, IST DER WICHTIGSTE ZUSTAND.
// Hier läuft eine Frist. Ein Formular, das im Fehlerfall nur "hat nicht
// geklappt" sagt, kostet den Kunden sein Recht. Deshalb nennt der
// Fehlerfall Postanschrift und E-Mail — zwei Wege, die von unserer Technik
// nicht abhängen — und der Erfolgsfall zeigt die Erklärung im Klartext,
// falls die Bestätigungsmail nicht ankam.

type State =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent"; receiptSent: boolean }
  | { kind: "error"; message: string; showFallback: boolean };

const ERRORS: Record<string, string> = {
  incomplete: "Bitte gib deinen Namen und deine E-Mail-Adresse an.",
  invalid_email: "Diese E-Mail-Adresse sieht nicht richtig aus.",
  too_long: "Eine der Angaben ist zu lang.",
  rate_limited:
    "Es wurden gerade mehrere Erklärungen von diesem Anschluss gesendet. Versuch es in einer Stunde erneut — oder schick uns den Widerruf direkt per E-Mail.",
  unconfigured:
    "Der Versand ist bei uns gerade gestört. Dein Widerruf wurde NICHT übermittelt.",
  failed:
    "Die Übermittlung ist fehlgeschlagen. Dein Widerruf ist NICHT bei uns angekommen.",
};

export function WithdrawalForm() {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [orderRef, setOrderRef] = useState("");
  const [orderedAt, setOrderedAt] = useState("");
  const [address, setAddress] = useState("");
  const [reason, setReason] = useState("");
  const [company, setCompany] = useState("");

  useEffect(() => {
    void fetchUser().then((u) => {
      if (!u) return;
      setEmail((v) => v || u.email);
      setName((v) => v || (u.name === u.email ? "" : u.name));
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (state.kind === "sending") return;

    if (!name.trim() || !email.trim()) {
      setState({
        kind: "error",
        message: ERRORS.incomplete,
        showFallback: false,
      });
      return;
    }

    setState({ kind: "sending" });
    try {
      const res = await fetch("/api/withdrawal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          orderRef,
          orderedAt,
          address,
          reason,
          company,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        receiptSent?: boolean;
      };

      if (!res.ok) {
        const code = data.error ?? "failed";
        setState({
          kind: "error",
          message: ERRORS[code] ?? ERRORS.failed,
          // Bei allem, was nicht bloß ein Tippfehler im Formular ist, muss
          // der Weg am Formular vorbei sichtbar werden.
          showFallback: code !== "invalid_email" && code !== "too_long",
        });
        return;
      }

      setState({ kind: "sent", receiptSent: data.receiptSent !== false });
    } catch {
      setState({ kind: "error", message: ERRORS.failed, showFallback: true });
    }
  }

  if (state.kind === "sent") {
    return (
      <div className="auth-scope rounded-2xl border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/[0.05] p-6">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full"
          style={{ background: "var(--color-accent-deep)" }}
        >
          <Check className="h-6 w-6 text-[var(--color-accent)]" aria-hidden />
        </div>
        <h3 className="mt-4 text-[17px] font-semibold text-[var(--color-ink)]">
          Dein Widerruf ist bei uns eingegangen
        </h3>
        <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--color-ink-secondary)]">
          Wir erstatten dir den vollen Betrag binnen 14 Tagen, über dasselbe
          Zahlungsmittel, mit dem du bezahlt hast. Kosten entstehen dir keine.
        </p>
        {state.receiptSent ? (
          <p className="mt-3 text-[13px] leading-relaxed text-[var(--color-ink-tertiary)]">
            Eine Eingangsbestätigung ist an {email} unterwegs. Heb sie auf —
            sie ist dein Beleg.
          </p>
        ) : (
          <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] p-3.5 text-[12.5px] leading-relaxed text-amber-200">
            <p className="font-semibold">
              Die Bestätigungsmail konnten wir nicht zustellen.
            </p>
            <p className="mt-1.5">
              Dein Widerruf ist trotzdem bei uns angekommen und wirksam. Mach
              dir am besten einen Screenshot dieser Seite, dann hast du den
              Zeitpunkt festgehalten.
            </p>
          </div>
        )}
      </div>
    );
  }

  const sending = state.kind === "sending";
  const optional = (
    <span className="text-[var(--color-ink-quaternary)]"> · freiwillig</span>
  );

  return (
    <form onSubmit={submit} className="auth-scope">
      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        className="pointer-events-none absolute left-[-9999px] h-0 w-0 opacity-0"
      />

      <label className="mb-1.5 block text-[12px] text-[var(--color-ink-tertiary)]">
        Dein Name
      </label>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={120}
        disabled={sending}
        placeholder="Vor- und Nachname"
        className="auth-field"
        autoComplete="name"
      />

      <label className="mb-1.5 mt-4 block text-[12px] text-[var(--color-ink-tertiary)]">
        E-Mail-Adresse der Bestellung
      </label>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        maxLength={200}
        disabled={sending}
        placeholder="du@beispiel.de"
        className="auth-field"
        autoComplete="email"
      />

      <label className="mb-1.5 mt-4 block text-[12px] text-[var(--color-ink-tertiary)]">
        Bestellnummer{optional}
      </label>
      <input
        type="text"
        value={orderRef}
        onChange={(e) => setOrderRef(e.target.value)}
        maxLength={120}
        disabled={sending}
        placeholder="steht in deiner Kaufbestätigung, beginnt mit pi_"
        className="auth-field"
      />

      <label className="mb-1.5 mt-4 block text-[12px] text-[var(--color-ink-tertiary)]">
        Kaufdatum{optional}
      </label>
      <input
        type="text"
        value={orderedAt}
        onChange={(e) => setOrderedAt(e.target.value)}
        maxLength={60}
        disabled={sending}
        placeholder="z. B. 27.08.2026"
        className="auth-field"
      />

      <label className="mb-1.5 mt-4 block text-[12px] text-[var(--color-ink-tertiary)]">
        Anschrift{optional}
      </label>
      <textarea
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        maxLength={300}
        rows={2}
        disabled={sending}
        placeholder="Straße, PLZ, Ort"
        className="auth-field resize-y leading-relaxed"
        autoComplete="street-address"
      />

      <label className="mb-1.5 mt-4 block text-[12px] text-[var(--color-ink-tertiary)]">
        Begründung{optional}
      </label>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={2000}
        rows={4}
        disabled={sending}
        placeholder="Du musst nichts angeben. Wenn du magst, hilft es uns besser zu werden."
        className="auth-field resize-y leading-relaxed"
      />
      <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--color-ink-quaternary)]">
        Ein Widerruf braucht keine Begründung. Das Feld ändert nichts an
        deinem Recht.
      </p>

      {state.kind === "error" ? (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-red-500/25 bg-red-500/[0.07] p-3.5 text-[12.5px] leading-relaxed text-red-300"
        >
          <p className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            {state.message}
          </p>
          {state.showFallback ? (
            <div className="mt-3 border-t border-red-500/20 pt-3 text-[var(--color-ink-secondary)]">
              <p className="font-semibold text-[var(--color-ink)]">
                Damit dir keine Frist verloren geht:
              </p>
              <p className="mt-1.5">
                Schick uns den Widerruf formlos an{" "}
                <a
                  href={`mailto:${CONTACT_EMAIL}?subject=Widerruf`}
                  className="text-accent underline underline-offset-2"
                >
                  {CONTACT_EMAIL}
                </a>{" "}
                oder per Post an {operatorLine()},{" "}
                {addressLines().join(", ")}. Für die Frist zählt, wann du
                absendest.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      <button type="submit" disabled={sending} className="auth-cta mt-6">
        {sending ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Wird übermittelt …
          </span>
        ) : (
          "Widerruf absenden"
        )}
      </button>
    </form>
  );
}
