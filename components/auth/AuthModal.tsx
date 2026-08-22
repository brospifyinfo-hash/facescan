"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Loader2, ShieldCheck, X } from "lucide-react";
import { OrbitCode, ORBIT_TOTAL_MS } from "./OrbitCode";
import { GoogleButton } from "./GoogleButton";
import { createPassword, passwordLogin, requestCode, verifyCode } from "@/lib/auth/client";
import { fill, useT } from "@/lib/i18n";

// THE WAY IN.
//
// One rule decides the shape of this screen: THE EMAIL CODE IS NOT A LOGIN.
// It proves an inbox — once at registration, and again when a password was
// forgotten — and both times it ends at the same place, choosing a password.
// Signing in afterwards is the password, or Google. That is why:
//
//   * registering and signing in are a SWITCH, not a hidden second path.
//     They ask for different things (one address, or an address and a
//     password), so pretending they are one form costs a field that is
//     either wrong or empty.
//   * the password step cannot be skipped. An account without one could
//     only ever be re-entered by email code, which is the thing being
//     retired — so the flow does not offer a "later".
//   * "forgot password" is not a separate machine. It is the same code, the
//     same ticket, the same password screen, with copy that says so.
//
// The visual language is the reference the owner supplied — see the AUTH
// SURFACE block in globals.css for what its rules are and why colour only
// ever appears as a verdict.

type View = "login" | "register" | "code" | "password";

const EASE = [0.22, 1, 0.36, 1] as const;

export function AuthModal({
  open,
  onClose,
  onSignedIn,
  start = "register",
}: {
  open: boolean;
  onClose: () => void;
  onSignedIn: (email: string) => void;
  /**
   * Which half of the switch is lit when the sheet opens. A returning
   * customer tapping "Anmelden" in their account means sign in; somebody
   * about to buy has no account yet and means register. Guessing wrong
   * costs a tap and, worse, reads as the app not knowing who is standing
   * in front of it.
   */
  start?: "login" | "register";
}) {
  const t = useT();
  const [view, setView] = useState<View>(start);
  /** Came here through "forgot password", or the address already existed. */
  const [reset, setReset] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [code, setCode] = useState("");
  const [verdict, setVerdict] = useState<"ok" | "bad" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devFallback, setDevFallback] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const verifying = useRef(false);

  useEffect(() => {
    if (open) return;
    // Reset on close, so a reopened modal never shows a stale code, a stale
    // error, or — worst of the three — a stale password in a field.
    setView(start);
    setReset(false);
    setCode("");
    setPassword("");
    setPw1("");
    setPw2("");
    setVerdict(null);
    setBusy(false);
    setError(null);
    verifying.current = false;
  }, [open, start]);

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
    // The server speaks snake_case, the dictionary camelCase — without this
    // every specific error falls through to the generic text.
    const camel = key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
    const raw = e[camel] ?? e[key] ?? e.failed;
    return n === undefined ? raw : fill(raw, { n });
  };

  const sendCode = useCallback(
    async (address: string, asReset: boolean) => {
      setError(null);
      setBusy(true);
      const res = await requestCode(address);
      setBusy(false);
      if (!res.ok) {
        setError(errorText(res.error));
        if (res.error === "cooldown" && res.retryAfterMs) {
          setCooldown(Math.ceil(res.retryAfterMs / 1000));
        }
        return;
      }
      setDevFallback(res.devFallback);
      setReset(asReset);
      setCode("");
      setVerdict(null);
      setView("code");
      setCooldown(60);
    },
    // errorText reads only from the dictionary, which is stable per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const verify = async (submitted: string) => {
    if (verifying.current) return;
    verifying.current = true;
    setError(null);
    setBusy(true);
    const res = await verifyCode(email, submitted);
    setBusy(false);
    verifying.current = false;

    if (!res.ok) {
      setVerdict("bad");
      setError(errorText(res.error, res.attemptsLeft));
      // Let the shake finish before the row is usable again.
      window.setTimeout(() => {
        setCode("");
        setVerdict(null);
      }, 450);
      return;
    }

    // An address that already had a password is a reset, whatever the
    // customer thought they were doing when they typed it.
    if (res.existing) setReset(true);
    setVerdict("ok");
    // The orbit is the transition: the digits travel, then the next screen
    // is already the one they were travelling toward.
    window.setTimeout(() => setView("password"), ORBIT_TOTAL_MS - 120);
  };

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await passwordLogin(email, password);
    setBusy(false);
    if (!res.ok) {
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

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (pw1.length < 8) {
      setError(t.auth.errors.pwShort);
      return;
    }
    if (pw1 !== pw2) {
      setError(t.auth.errors.pwMismatch);
      return;
    }
    setBusy(true);
    const res = await createPassword(pw1);
    setBusy(false);
    if (!res.ok) {
      setError(res.error === "no_ticket" ? t.auth.errors.ticketExpired : errorText(res.error));
      if (res.error === "no_ticket") setView(start);
      return;
    }
    onSignedIn(res.email || email);
  };

  if (!open) return null;

  const heading =
    view === "login"
      ? t.auth.modeLogin
      : view === "register"
        ? t.auth.modeRegister
        : view === "code"
          ? t.auth.codeTitle
          : reset
            ? t.auth.pwResetTitle
            : t.auth.pwCreateTitle;

  const sub =
    view === "login"
      ? t.auth.loginSub
      : view === "register"
        ? t.auth.registerSub
        : view === "code"
          ? fill(t.auth.codeSub, { email })
          : reset
            ? t.auth.pwResetSub
            : t.auth.pwCreateSub;

  return (
    <div className="auth-scope auth-scrim fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto p-4">
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
        aria-label={heading}
        initial={{ opacity: 0, y: 22, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.42, ease: EASE }}
        className="auth-sheet relative my-auto w-full max-w-sm p-7 sm:p-8"
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="auth-quiet absolute right-4 top-4 rounded-full p-1.5 transition-colors hover:text-[var(--auth-ink)]"
        >
          <X className="h-4 w-4" />
        </button>

        {/* The switch — only where there is genuinely a choice to make. */}
        {view === "login" || view === "register" ? (
          <div className="auth-switch relative mb-6 mt-1">
            {(["register", "login"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={view === m}
                onClick={() => {
                  setView(m);
                  setError(null);
                }}
              >
                {m === "register" ? t.auth.modeRegister : t.auth.modeLogin}
              </button>
            ))}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setView(reset ? "login" : "register");
              setError(null);
              setCode("");
              setVerdict(null);
            }}
            className="auth-quiet mb-5 mt-1 flex items-center gap-1.5 text-[12px] transition-colors hover:text-[var(--auth-ink)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {reset ? t.auth.backToLogin : t.auth.changeEmail}
          </button>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.26, ease: EASE }}
          >
            <h2 className="auth-title">{heading}</h2>
            <p className="auth-sub mt-2 text-[13.5px] leading-relaxed">{sub}</p>

            {/* ---------------- Sign in ---------------- */}
            {view === "login" ? (
              <form onSubmit={signIn} className="mt-6">
                <input
                  autoFocus
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t.auth.emailPlaceholder}
                  className="auth-field"
                />
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t.auth.passwordPlaceholder}
                  className="auth-field mt-2.5"
                />
                {error ? (
                  <p className="mt-2.5 text-[12px] text-[var(--auth-bad)]">{error}</p>
                ) : null}
                <button type="submit" className="auth-cta mt-4" disabled={busy}>
                  {busy ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> {t.auth.verifying}
                    </span>
                  ) : (
                    t.auth.passwordSubmit
                  )}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (!email) {
                      setError(t.auth.errors.invalidEmail);
                      return;
                    }
                    void sendCode(email, true);
                  }}
                  className="auth-quiet mt-3 w-full text-center text-[12px] transition-colors hover:text-[var(--auth-ink)]"
                >
                  {t.auth.forgot}
                </button>
                <GoogleButton onSignedIn={onSignedIn} />
              </form>
            ) : null}

            {/* ---------------- Register ---------------- */}
            {view === "register" ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void sendCode(email, false);
                }}
                className="mt-6"
              >
                <input
                  autoFocus
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t.auth.emailPlaceholder}
                  className="auth-field"
                />
                {error ? (
                  <p className="mt-2.5 text-[12px] text-[var(--auth-bad)]">{error}</p>
                ) : null}
                <button type="submit" className="auth-cta mt-4" disabled={busy}>
                  {busy ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> {t.auth.sending}
                    </span>
                  ) : (
                    t.auth.sendCode
                  )}
                </button>
                <GoogleButton onSignedIn={onSignedIn} />
                <p className="auth-quiet mt-4 flex items-start gap-2 text-[11px] leading-relaxed">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {t.auth.privacy}
                </p>
              </form>
            ) : null}

            {/* ---------------- The code ---------------- */}
            {view === "code" ? (
              <div className="mt-7">
                <OrbitCode
                  value={code}
                  onChange={setCode}
                  onComplete={verify}
                  disabled={busy || verdict === "ok"}
                  verdict={verdict}
                />

                {error ? (
                  <p className="mt-4 text-center text-[12px] text-[var(--auth-bad)]">{error}</p>
                ) : null}

                {devFallback ? (
                  <p className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-2.5 text-[11px] leading-relaxed text-amber-300/90">
                    {t.auth.devHint}
                  </p>
                ) : null}

                <button
                  type="button"
                  onClick={() => void sendCode(email, reset)}
                  disabled={cooldown > 0 || busy || verdict === "ok"}
                  className="auth-quiet mt-5 w-full text-center text-[12px] transition-colors hover:text-[var(--auth-ink)] disabled:opacity-50"
                >
                  {cooldown > 0 ? fill(t.auth.resendIn, { s: cooldown }) : t.auth.resend}
                </button>
              </div>
            ) : null}

            {/* ---------------- The password ---------------- */}
            {view === "password" ? (
              <form onSubmit={savePassword} className="mt-6">
                <input
                  autoFocus
                  type="password"
                  required
                  autoComplete="new-password"
                  value={pw1}
                  onChange={(e) => setPw1(e.target.value)}
                  placeholder={t.auth.pwNew}
                  className="auth-field"
                />
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                  placeholder={t.auth.pwRepeat}
                  className="auth-field mt-2.5"
                />
                {error ? (
                  <p className="mt-2.5 text-[12px] text-[var(--auth-bad)]">{error}</p>
                ) : null}
                <button type="submit" className="auth-cta mt-4" disabled={busy}>
                  {busy ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> {t.auth.verifying}
                    </span>
                  ) : (
                    t.auth.pwCreateCta
                  )}
                </button>
              </form>
            ) : null}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
