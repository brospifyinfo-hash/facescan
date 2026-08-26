"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

export const ACCESS_KEY = "facescan.access";
const HOLD_MS = 5000;

// THE CODE IS NOT IN THIS FILE ANY MORE.
//
// It used to be `const CODE = "09052008"` — compared in the browser, and
// therefore shipped in the JavaScript bundle to every visitor. Anybody who
// opened devtools and searched for the string found a key that unlocks every
// paid section of the report. That was survivable while the site took test
// payments. It stops being survivable on the day it takes real ones, which is
// today.
//
// The prompt now asks the SERVER, against the same ADMIN_CODE that guards the
// admin area: constant-time comparison, nothing to find in the bundle, and one
// credential instead of two. A wrong code looks exactly like it did before.
//
// What this does NOT fix: the paid sections are still revealed by client-side
// state, so somebody who edits that state in devtools sees them anyway. Only
// the content that costs money to produce (/api/report, /api/style/*) is
// genuinely gated, server-side, on requireCapability(). Closing the rest means
// delivering the report from the server — a real piece of work, not a patch.

/** Has the owner's access code been entered in this session? */
export function hasAccessCode(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(ACCESS_KEY) === "1";
}

/**
 * Long-press target that opens a code prompt.
 *
 * Holding the wrapped element for five seconds reveals a neutral input; the
 * right code unlocks every gated section for the rest of the session so the
 * paid experience can be reviewed exactly as a customer sees it — no banner,
 * no badge, nothing that marks it as a test.
 *
 * ⚠️ Still a convenience for the site owner, not access control. The code is
 * checked server-side now (see the note at the top of this file), so it is no
 * longer readable in the bundle — but what it flips is client state, and
 * client state can be edited. The sections that cost money to produce are
 * gated separately and properly, on requireCapability() in the API routes.
 */
export function DevUnlock({ children }: { children: React.ReactNode }) {
  const [prompting, setPrompting] = useState(false);
  const [code, setCode] = useState("");
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef<number | null>(null);

  const clear = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const start = useCallback(() => {
    clear();
    timer.current = window.setTimeout(() => setPrompting(true), HOLD_MS);
  }, [clear]);

  useEffect(() => clear, [clear]);

  useEffect(() => {
    if (!prompting) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPrompting(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prompting]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);

    // The admin login endpoint is the check: it compares against ADMIN_CODE
    // server-side and mints its own cookie on success. Reusing it means this
    // prompt carries no secret of its own — and that the owner who is already
    // signed into the admin area uses the code they already know.
    const ok = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    })
      .then((r) => r.ok)
      .catch(() => false);

    setBusy(false);
    if (ok) {
      sessionStorage.setItem(ACCESS_KEY, "1");
      setPrompting(false);
      setCode("");
      // Re-render whatever is gated, without a visible state change.
      window.dispatchEvent(new Event("facescan:access"));
    } else {
      setShake(true);
      setCode("");
      window.setTimeout(() => setShake(false), 450);
    }
  };

  return (
    <>
      <span
        onPointerDown={start}
        onPointerUp={clear}
        onPointerLeave={clear}
        onPointerCancel={clear}
        onContextMenu={(e) => e.preventDefault()}
        className="inline-flex select-none"
        style={{ WebkitTouchCallout: "none" }}
      >
        {children}
      </span>

      {prompting ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--color-canvas)]/80 p-4 backdrop-blur-md"
          onClick={() => setPrompting(false)}
        >
          <motion.form
            onClick={(e) => e.stopPropagation()}
            onSubmit={submit}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1, x: shake ? [0, -8, 8, -6, 6, 0] : 0 }}
            transition={{ duration: shake ? 0.45 : 0.2 }}
            className="material-sheet w-full max-w-[260px] rounded-[var(--r-card)] p-5"
          >
            <input
              autoFocus
              type="password"
              inputMode="numeric"
              enterKeyHint="go"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="••••••••"
              aria-label="Code"
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-lg tracking-[0.5em] outline-none transition-colors placeholder:text-[var(--color-ink-quaternary)] focus:border-accent/50"
            />
            {/* An explicit submit — a soft keyboard has no reliable Enter,
                so the prompt was impossible to confirm on a phone. */}
            <button
              type="submit"
              disabled={code.length === 0}
              className="mt-3 w-full rounded-2xl bg-accent py-2.5 text-sm font-semibold text-[var(--color-accent-ink)] transition-opacity disabled:opacity-30"
            >
              OK
            </button>
          </motion.form>
        </div>
      ) : null}
    </>
  );
}
