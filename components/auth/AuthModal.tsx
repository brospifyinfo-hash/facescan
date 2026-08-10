"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Mail, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CodeInput } from "./CodeInput";
import { requestCode, verifyCode } from "@/lib/auth/client";
import { fill, useT } from "@/lib/i18n";

type Stage = "email" | "code";

/** Passwordless sign-in: address → six-digit code → session cookie. */
export function AuthModal({
  open,
  onClose,
  onSignedIn,
}: {
  open: boolean;
  onClose: () => void;
  onSignedIn: (email: string) => void;
}) {
  const t = useT();
  const [stage, setStage] = useState<Stage>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devFallback, setDevFallback] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const verifying = useRef(false);

  useEffect(() => {
    if (open) return;
    // Reset so a reopened modal never shows a stale code or error.
    setStage("email");
    setCode("");
    setBusy(false);
    setError(null);
    verifying.current = false;
  }, [open]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const errorText = (key: string, n?: number) => {
    const e = t.auth.errors as Record<string, string>;
    const raw = e[key] ?? e.failed;
    return n === undefined ? raw : fill(raw, { n });
  };

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    setBusy(true);
    const res = await requestCode(email);
    setBusy(false);

    if (!res.ok) {
      setError(errorText(res.error));
      if (res.error === "cooldown" && res.retryAfterMs) {
        setCooldown(Math.ceil(res.retryAfterMs / 1000));
      }
      return;
    }
    setDevFallback(res.devFallback);
    setCode("");
    setStage("code");
    setCooldown(60);
  };

  const verify = async (submitted: string) => {
    if (verifying.current) return;
    verifying.current = true;
    setError(null);
    setBusy(true);
    const res = await verifyCode(email, submitted);
    setBusy(false);
    verifying.current = false;

    if (!res.ok) {
      setError(errorText(res.error, res.attemptsLeft));
      setCode("");
      return;
    }
    onSignedIn(res.email);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center overflow-y-auto bg-[var(--color-canvas)]/80 p-4 backdrop-blur-md">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        className="absolute inset-0 h-full w-full cursor-default"
        onClick={onClose}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={t.auth.title}
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="material-sheet relative my-auto w-full max-w-sm rounded-[var(--r-window)] p-6 sm:p-7"
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-full p-1.5 text-[var(--color-ink-tertiary)] transition-colors hover:bg-white/5 hover:text-[var(--color-ink)]"
        >
          <X className="h-4 w-4" />
        </button>

        {stage === "email" ? (
          <form onSubmit={send}>
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/[0.1] bg-white/[0.04]">
              <Mail className="h-4 w-4 text-accent" />
            </span>
            <h2 className="mt-5 text-xl font-semibold tracking-tight">
              {t.auth.title}
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-ink-secondary)]">
              {t.auth.sub}
            </p>

            <input
              autoFocus
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.auth.emailPlaceholder}
              className="mt-5 w-full rounded-2xl border border-white/[0.1] bg-white/[0.03] px-4 py-3 text-sm outline-none transition-colors placeholder:text-[var(--color-ink-tertiary)] focus:border-accent/60"
            />

            {error ? (
              <p className="mt-2.5 text-[12px] text-red-400">{error}</p>
            ) : null}

            <Button type="submit" size="lg" className="mt-4 w-full" disabled={busy}>
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> {t.auth.sending}
                </>
              ) : (
                t.auth.sendCode
              )}
            </Button>

            <p className="mt-3.5 flex items-start gap-2 text-[11px] leading-relaxed text-[var(--color-ink-tertiary)]">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
              {t.auth.privacy}
            </p>
          </form>
        ) : (
          <div>
            <button
              onClick={() => setStage("email")}
              className="flex items-center gap-1.5 text-[12px] text-[var(--color-ink-tertiary)] transition-colors hover:text-[var(--color-ink-secondary)]"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> {t.auth.changeEmail}
            </button>

            <h2 className="mt-4 text-xl font-semibold tracking-tight">
              {t.auth.codeTitle}
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-ink-secondary)]">
              {fill(t.auth.codeSub, { email })}
            </p>

            <div className="mt-6">
              <CodeInput
                value={code}
                onChange={setCode}
                onComplete={verify}
                disabled={busy}
                invalid={Boolean(error)}
              />
            </div>

            {error ? (
              <p className="mt-3 text-center text-[12px] text-red-400">{error}</p>
            ) : null}

            {devFallback ? (
              <p className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-2.5 t-caption leading-relaxed text-amber-300/90">
                {t.auth.devHint}
              </p>
            ) : null}

            <Button
              size="lg"
              className="mt-5 w-full"
              disabled={busy || code.length !== 6}
              onClick={() => verify(code)}
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> {t.auth.verifying}
                </>
              ) : (
                t.auth.verify
              )}
            </Button>

            <button
              onClick={() => send()}
              disabled={cooldown > 0 || busy}
              className="mt-3 w-full text-center text-[12px] text-[var(--color-ink-tertiary)] transition-colors hover:text-[var(--color-ink-secondary)] disabled:opacity-50"
            >
              {cooldown > 0
                ? fill(t.auth.resendIn, { s: cooldown })
                : t.auth.resend}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
