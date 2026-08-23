"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { AffiliateAddress } from "@/lib/affiliate/model";
import { useI18n, useT } from "@/lib/i18n";
import { cn } from "@/lib/cn";

// Becoming a partner, and — the same form again — editing the payout details
// afterwards.
//
// THE SERVER IS THE TRUTH, THIS IS THE COURTESY.
// Everything checked here is checked again in lib/affiliate/apply.ts: the
// IBAN's check digits, the field lengths, the invite code, the consent. What
// the browser does is spare somebody a round trip for an empty field. When
// the server does reject something it names the field it rejected, and the
// message is shown AT that field — a form that answers "something was wrong"
// makes the customer hunt for it themselves.
//
// The IBAN never comes back. In edit mode the field starts empty and an
// empty field means "leave it as it is", because the stored value is
// encrypted and the only thing the API ever returns is the last four digits.

/** The countries the payout can go to. ISO-3166-1 alpha-2, SEPA. */
const COUNTRIES = [
  "AT", "BE", "BG", "CH", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR",
  "GB", "GR", "HR", "HU", "IE", "IS", "IT", "LI", "LT", "LU", "LV", "MT",
  "NL", "NO", "PL", "PT", "RO", "SE", "SI", "SK",
] as const;

interface Fields {
  firstName: string;
  lastName: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  accountHolder: string;
  iban: string;
  inviteCode: string;
}

interface Props {
  mode: "apply" | "edit";
  joinMode: "open" | "code";
  terms: string;
  /** Present in edit mode: what the account currently holds. */
  initial?: {
    firstName: string;
    lastName: string;
    address: AffiliateAddress;
    accountHolder: string;
  };
  /** Reload the dashboard — the caller owns the data, this form does not. */
  onDone: () => void;
  onCancel?: () => void;
}

export function ApplyForm({ mode, joinMode, terms, initial, onDone, onCancel }: Props) {
  const t = useT();
  const { locale } = useI18n();

  const [f, setF] = useState<Fields>({
    firstName: initial?.firstName ?? "",
    lastName: initial?.lastName ?? "",
    street: initial?.address.street ?? "",
    postalCode: initial?.address.postalCode ?? "",
    city: initial?.address.city ?? "",
    country: initial?.address.country ?? "DE",
    accountHolder: initial?.accountHolder ?? "",
    iban: "",
    inviteCode: "",
  });
  const [accepted, setAccepted] = useState(mode === "edit");
  const [showTerms, setShowTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  // Keyed by field name; "" is the bucket for anything the server did not
  // pin to a field.
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Country names in the reader's language rather than a hardcoded list:
  // one source of names for four locales, and it stays correct when a fifth
  // is added. Sorted by the localised name, so the list reads alphabetically
  // in the language on screen.
  const countries = useMemo(() => {
    let display: Intl.DisplayNames | null = null;
    try {
      display = new Intl.DisplayNames([locale], { type: "region" });
    } catch {
      // Very old engines: fall back to the bare code, which is still a
      // usable choice, just not a pretty one.
    }
    return COUNTRIES.map((code) => ({
      code,
      name: display?.of(code) ?? code,
    })).sort((a, b) => a.name.localeCompare(b.name, locale));
  }, [locale]);

  const set = (key: keyof Fields, value: string) => {
    setF((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (key in prev || "" in prev ? { ...prev, [key]: "", "": "" } : prev));
    setSaved(false);
  };

  const message = (code: string): string =>
    (t.partner.apply.errors as Record<string, string>)[code] ?? t.partner.apply.errors.invalid_input;

  // The server names a field, but not every name it can name is an input on
  // this form: "body" and "email" are its own words for "the request was
  // malformed" and "your session went away". Pinning a message to one of
  // those would hide it completely, so anything unrecognised falls into the
  // general bucket under the buttons.
  const pin = (field: string | undefined): string =>
    field && (field in f || field === "acceptTerms") ? field : "";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;

    // The one thing worth catching before the round trip: an empty required
    // field. Anything with a rule behind it goes to the server.
    const missing: Record<string, string> = {};
    const required: Array<keyof Fields> = [
      "firstName", "lastName", "street", "postalCode", "city", "country", "accountHolder",
    ];
    for (const key of required) {
      if (!f[key].trim()) missing[key] = t.partner.apply.errors.invalid_input;
    }
    if (mode === "apply" && !f.iban.trim()) {
      missing.iban = t.partner.apply.errors.invalid_input;
    }
    if (mode === "apply" && joinMode === "code" && !f.inviteCode.trim()) {
      missing.inviteCode = t.partner.apply.errors.invite_required;
    }
    if (mode === "apply" && !accepted) {
      missing.acceptTerms = t.partner.apply.errors.terms_required;
    }
    if (Object.keys(missing).length > 0) {
      setErrors(missing);
      return;
    }

    setBusy(true);
    setErrors({});
    try {
      const body: Record<string, unknown> = {
        firstName: f.firstName,
        lastName: f.lastName,
        street: f.street,
        postalCode: f.postalCode,
        city: f.city,
        country: f.country,
        accountHolder: f.accountHolder,
        iban: f.iban,
      };
      if (mode === "apply") {
        body.acceptTerms = accepted;
        if (joinMode === "code") body.inviteCode = f.inviteCode;
      }

      const res = await fetch(
        mode === "apply" ? "/api/affiliate/apply" : "/api/affiliate/payout-info",
        {
          method: mode === "apply" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data: { ok?: boolean; error?: string; field?: string } = await res
        .json()
        .catch(() => ({}));

      if (!res.ok || !data.ok) {
        const code = typeof data.error === "string" ? data.error : "invalid_input";
        setErrors({ [pin(data.field)]: message(code) });
        return;
      }

      setSaved(true);
      if (mode === "apply") {
        onDone();
      } else {
        // The confirmation is the whole point of the edit path: the IBAN is
        // never shown back, so "Saved." is the only evidence the change took.
        // Closing in the same frame would swallow it.
        window.setTimeout(onDone, 1200);
      }
    } catch {
      setErrors({ "": t.partner.apply.errors.network });
    } finally {
      setBusy(false);
    }
  };

  const editing = mode === "edit";

  return (
    <form onSubmit={submit} noValidate className="border-t border-[var(--color-hairline)] pt-6">
      <h2 className="t-title3 text-[var(--color-ink)]">
        {editing ? t.partner.apply.editTitle : t.partner.apply.title}
      </h2>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--color-ink-secondary)]">
        {editing ? t.partner.apply.editSub : t.partner.apply.sub}
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Field
          label={t.partner.apply.firstName}
          value={f.firstName}
          onChange={(v) => set("firstName", v)}
          error={errors.firstName}
          autoComplete="given-name"
        />
        <Field
          label={t.partner.apply.lastName}
          value={f.lastName}
          onChange={(v) => set("lastName", v)}
          error={errors.lastName}
          autoComplete="family-name"
        />
        <Field
          className="col-span-2"
          label={t.partner.apply.street}
          value={f.street}
          onChange={(v) => set("street", v)}
          error={errors.street}
          autoComplete="street-address"
        />
        <Field
          label={t.partner.apply.postalCode}
          value={f.postalCode}
          onChange={(v) => set("postalCode", v)}
          error={errors.postalCode}
          autoComplete="postal-code"
          inputMode="numeric"
        />
        <Field
          label={t.partner.apply.city}
          value={f.city}
          onChange={(v) => set("city", v)}
          error={errors.city}
          autoComplete="address-level2"
        />

        <label className="col-span-2 block">
          <span className="t-caption block text-[var(--color-ink-tertiary)]">
            {t.partner.apply.country}
          </span>
          <span className="relative mt-1.5 block">
            <select
              value={f.country}
              onChange={(e) => set("country", e.target.value)}
              autoComplete="country"
              className={cn(
                "w-full appearance-none rounded-[var(--r-control)] border bg-white/[0.02] px-3.5 py-3 pr-9 text-[15px] text-[var(--color-ink)] outline-none",
                "focus:border-[var(--color-accent)]/60",
                errors.country ? "border-[var(--color-caution)]/70" : "border-white/[0.08]",
              )}
            >
              <option value="">{t.partner.apply.countryPlaceholder}</option>
              {countries.map((c) => (
                // The native menu paints its options on the system surface,
                // so they need the app's colours set explicitly or they come
                // out black-on-black on Windows.
                <option key={c.code} value={c.code} className="bg-[var(--color-surface)] text-[var(--color-ink)]">
                  {c.name}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-ink-tertiary)]"
              aria-hidden
            />
          </span>
          {errors.country ? <FieldError text={errors.country} /> : null}
        </label>

        <Field
          className="col-span-2"
          label={t.partner.apply.accountHolder}
          hint={t.partner.apply.accountHolderHint}
          value={f.accountHolder}
          onChange={(v) => set("accountHolder", v)}
          error={errors.accountHolder}
          autoComplete="name"
        />
        <Field
          className="col-span-2"
          label={t.partner.apply.iban}
          hint={editing ? t.partner.apply.editIbanPlaceholder : t.partner.apply.ibanHint}
          value={f.iban}
          onChange={(v) => set("iban", v.toUpperCase())}
          error={errors.iban}
          mono
          autoComplete="off"
          spellCheck={false}
        />

        {mode === "apply" && joinMode === "code" ? (
          <Field
            className="col-span-2"
            label={t.partner.apply.inviteCode}
            hint={t.partner.apply.inviteHint}
            value={f.inviteCode}
            onChange={(v) => set("inviteCode", v.toUpperCase())}
            error={errors.inviteCode}
            mono
            autoComplete="off"
            spellCheck={false}
          />
        ) : null}
      </div>

      {mode === "apply" ? (
        <div className="mt-5">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => {
                setAccepted(e.target.checked);
                setErrors((prev) => ({ ...prev, acceptTerms: "" }));
              }}
              className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[var(--color-accent)]"
            />
            <span className="text-[12.5px] leading-[1.45] text-[var(--color-ink-secondary)]">
              {t.partner.apply.terms}
            </span>
          </label>
          {errors.acceptTerms ? <FieldError text={errors.acceptTerms} /> : null}

          {terms ? (
            <>
              <button
                type="button"
                onClick={() => setShowTerms((v) => !v)}
                className="interactive mt-2 text-[11.5px] font-medium text-[var(--color-accent)] underline underline-offset-2"
              >
                {showTerms ? t.partner.apply.termsHide : t.partner.apply.termsShow}
              </button>
              {showTerms ? (
                <p className="mt-2 whitespace-pre-line rounded-[var(--r-control)] border border-white/[0.08] bg-white/[0.02] p-3.5 text-[11.5px] leading-[1.5] text-[var(--color-ink-secondary)]">
                  {terms}
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {errors[""] ? <FieldError text={errors[""]} /> : null}
      {saved && editing ? (
        <p className="mt-4 text-[12.5px] font-medium text-[var(--color-accent)]">
          {t.partner.apply.saved}
        </p>
      ) : null}

      <div className="mt-6 flex items-center gap-2">
        <Button type="submit" size="lg" disabled={busy}>
          {busy
            ? t.partner.apply.submitting
            : editing
              ? t.partner.apply.editSubmit
              : t.partner.apply.submit}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" size="lg" onClick={onCancel} disabled={busy}>
            {t.partner.apply.cancel}
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function FieldError({ text }: { text: string }) {
  return (
    <p role="alert" className="mt-1.5 text-[11.5px] leading-tight text-[var(--color-caution)]">
      {text}
    </p>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
  error,
  className,
  mono,
  ...input
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  className?: string;
  mono?: boolean;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "className">) {
  return (
    <label className={cn("block", className)}>
      <span className="t-caption block text-[var(--color-ink-tertiary)]">{label}</span>
      <input
        {...input}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          // The outline lives on the control and nowhere else — the page
          // around it stays containerless.
          "mt-1.5 w-full rounded-[var(--r-control)] border bg-white/[0.02] px-3.5 py-3 text-[15px] text-[var(--color-ink)] outline-none",
          "placeholder:text-[var(--color-ink-quaternary)] focus:border-[var(--color-accent)]/60",
          mono && "font-mono tracking-[0.06em]",
          error ? "border-[var(--color-caution)]/70" : "border-white/[0.08]",
        )}
      />
      {error ? <FieldError text={error} /> : hint ? (
        <span className="mt-1.5 block text-[11px] leading-tight text-[var(--color-ink-quaternary)]">
          {hint}
        </span>
      ) : null}
    </label>
  );
}
