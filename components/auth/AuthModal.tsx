"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, KeyRound, Loader2, Mail, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CodeInput } from "./CodeInput";
import { GoogleButton } from "./GoogleButton";
import { passwordLogin, requestCode, verifyCode } from "@/lib/auth/client";
import { fill, useT } from "@/lib/i18n";
import { cn } from "@/lib/cn";

type Stage = "email" | "code";
type Mode = "code" | "password";

/**
 * Sign-in: three ways to the same session. The email code is the root (it
 * proves the inbox and doubles as the password reset), the password is the
 * convenience for return visits, and Google appears whenever a client id is
 * configured — all of them end in the identical cookie.
 */
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
  const [mode, setMode] = useState<Mode>("code");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    setPassword("");
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
    // The server speaks snake_case ("wrong_code"), the dictionary camelCase
    // ("wrongCode") — without this normalisation every specific error fell
    // through to the generic "failed" text.
    const camel = key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
    const raw = e[camel] ?? e[key] ?? e.failed;
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

  const loginWithPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await passwordLogin(email, password);
    setBusy(false);
    if (!res.ok) {
      // "locked" means something different here than on the code path, so
      // it maps to its own text rather than through errorText().
      setError(
        res.error === "locked"
          ? t.auth.errors.pwdLocked
          : res.error === "unavailable"
            ? t.auth.errors.unavailable
            : t.auth.errors.wrongPassword,
      );
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
          <div>
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/[0.1] bg-white/[0.04]">
              {mode === "code" ? (
                <Mail className="h-4 w-4 text-accent" />
              ) : (
                <KeyRound className="h-4 w-4 text-accent" />
              )}
            </span>
            <h2 className="mt-5 text-xl font-semibold tracking-tight">
              {t.auth.title}
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-ink-secondary)]">
              {t.auth.sub}
            </p>

            {/* The two ways in, as a segmented control. */}
            <div className="fill mt-5 grid grid-cols-2 gap-1 rounded-full p-1">
              {(["code", "password"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m);
                    setError(null);
                  }}
                  aria-pressed={mode === m}
                  className={cn(
                    "rounded-full py-2 text-[12.5px] font-semibold transition-colors",
                    mode === m
                      ? "bg-white/[0.1] text-[var(--color-ink)]"
                      : "text-[var(--color-ink-tertiary)]",
                  )}
                >
                  {m === "code" ? t.auth.tabCode : t.auth.tabPassword}
                </button>
              ))}
            </div>

            <form onSubmit={mode === "code" ? send : loginWithPassword}>
              <input
                autoFocus
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.auth.emailPlaceholder}
                className="mt-4 w-full rounded-2xl border border-white/[0.1] bg-white/[0.03] px-4 py-3 text-sm outline-none transition-colors placeholder:text-[var(--color-ink-tertiary)] focus:border-accent/60"
              />

              {mode === "password" ? (
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t.auth.passwordPlaceholder}
                  className="mt-2.5 w-full rounded-2xl border border-white/[0.1] bg-white/[0.03] px-4 py-3 text-sm outline-none transition-colors placeholder:text-[var(--color-ink-tertiary)] focus:border-accent/60"
                />
              ) : null}

              {error ? (
                <p className="mt-2.5 text-[12px] text-red-400">{error}</p>
              ) : null}

              <Button type="submit" size="lg" className="mt-4 w-full" disabled={busy}>
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> {t.auth.sending}
                  </>
                ) : mode === "code" ? (
                  t.auth.sendCode
                ) : (
                  t.auth.passwordSubmit
                )}
              </Button>
            </form>

            {mode === "password" ? (
              <p className="mt-3 text-[11px] leading-relaxed text-[var(--color-ink-tertiary)]">
                {t.auth.passwordHint}
              </p>
            ) : null}

            <GoogleButton
              onSignedIn={(mail) => {
                onSignedIn(mail);
              }}
            />

            <p className="mt-3.5 flex items-start gap-2 text-[11px] leading-relaxed text-[var(--color-ink-tertiary)]">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
              {t.auth.privacy}
            </p>
          </div>
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
