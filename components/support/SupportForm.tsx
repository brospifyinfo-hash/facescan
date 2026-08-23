"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { fetchUser } from "@/lib/auth/client";
import { fill, useI18n, useT } from "@/lib/i18n";

// The way out.
//
// One rule shapes this screen: IT MUST WORK FOR SOMEBODY WHO CANNOT SIGN
// IN. A locked-out customer is the likeliest visitor, so nothing here is
// behind a session — the address is a field, not something read from a
// cookie. A session, when there is one, only PREFILLS that field; it never
// becomes a requirement and never hides the input, because the address the
// customer wants a reply at is not always the one they signed up with.
//
// The reply arrives by email rather than in-app for the same reason: an
// in-app thread is unreachable to exactly the person who opened the ticket
// because they could not get in.
//
// Field styling reuses the auth surface (.auth-scope / .auth-field), which
// is the app's one form language. No new tokens for a second form.

type State =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent" }
  | { kind: "error"; message: string };

export function SupportForm() {
  const t = useT();
  const { locale } = useI18n();
  const [state, setState] = useState<State>({ kind: "idle" });
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [company, setCompany] = useState("");

  // Prefill from the session when there is one. Not awaited by anything —
  // the form is usable from first paint whether or not this resolves.
  useEffect(() => {
    void fetchUser().then((u) => {
      if (!u) return;
      setSessionEmail(u.email);
      setEmail((current) => current || u.email);
      setName((current) => current || (u.name === u.email ? "" : u.name));
    });
  }, []);

  const errorText = (code: string): string => {
    const e = t.support.errors as Record<string, string>;
    // Any code the dictionary does not know falls through to the generic
    // failure, so a new server-side reason can never render as a raw slug.
    return e[
      { invalid_email: "invalidEmail", too_long: "tooLong", rate_limited: "rateLimited" }[
        code
      ] ?? code
    ] ?? e.failed;
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (state.kind === "sending") return;

    if (!name.trim() || !email.trim() || !subject.trim() || !message.trim()) {
      setState({ kind: "error", message: t.support.errors.incomplete });
      return;
    }

    setState({ kind: "sending" });
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          subject,
          body: message,
          locale,
          company,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };

      if (!res.ok) {
        setState({ kind: "error", message: errorText(data.error ?? "failed") });
        return;
      }

      setSubject("");
      setMessage("");
      setState({ kind: "sent" });
    } catch {
      setState({ kind: "error", message: t.support.errors.failed });
    }
  }

  if (state.kind === "sent") {
    return (
      <div className="auth-scope text-center">
        <div
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-full"
          style={{ background: "var(--color-accent-deep)" }}
        >
          <Check className="h-6 w-6 text-[var(--color-accent)]" aria-hidden />
        </div>
        <h2 className="mt-5 text-[19px] font-semibold text-[var(--color-ink)]">
          {t.support.sentTitle}
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-[14px] leading-relaxed text-[var(--color-ink-secondary)]">
          {t.support.sentBody}
        </p>
        <button
          type="button"
          onClick={() => setState({ kind: "idle" })}
          className="mt-6 text-[13px] font-medium text-[var(--color-accent)] transition-opacity hover:opacity-80"
        >
          {t.support.again}
        </button>
      </div>
    );
  }

  const sending = state.kind === "sending";

  return (
    <form onSubmit={submit} className="auth-scope">
      {/* Honeypot: off-screen rather than display:none, which some bots skip. */}
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
        {t.support.name}
      </label>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={100}
        disabled={sending}
        placeholder={t.support.namePlaceholder}
        className="auth-field"
        autoComplete="name"
      />

      <label className="mb-1.5 mt-4 block text-[12px] text-[var(--color-ink-tertiary)]">
        {t.support.email}
      </label>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        maxLength={200}
        disabled={sending}
        placeholder={t.support.emailPlaceholder}
        className="auth-field"
        autoComplete="email"
      />
      {sessionEmail ? (
        <p className="mt-1.5 text-[11px] text-[var(--color-ink-quaternary)]">
          {fill(t.support.signedInAs, { email: sessionEmail })}
        </p>
      ) : null}

      <label className="mb-1.5 mt-4 block text-[12px] text-[var(--color-ink-tertiary)]">
        {t.support.subject}
      </label>
      <input
        type="text"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        maxLength={150}
        disabled={sending}
        placeholder={t.support.subjectPlaceholder}
        className="auth-field"
      />

      <label className="mb-1.5 mt-4 block text-[12px] text-[var(--color-ink-tertiary)]">
        {t.support.message}
      </label>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={5000}
        rows={7}
        disabled={sending}
        placeholder={t.support.messagePlaceholder}
        className="auth-field resize-y leading-relaxed"
      />

      {state.kind === "error" ? (
        <p role="alert" className="mt-3 text-[12px] text-[var(--auth-bad)]">
          {state.message}
        </p>
      ) : null}

      <button type="submit" disabled={sending} className="auth-cta mt-6">
        {sending ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {t.support.sending}
          </span>
        ) : (
          t.support.send
        )}
      </button>

      <Link
        href="/"
        className="mt-5 inline-flex items-center gap-1.5 text-[12px] text-[var(--color-ink-tertiary)] transition-colors hover:text-[var(--color-ink-secondary)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        {t.support.back}
      </Link>
    </form>
  );
}
