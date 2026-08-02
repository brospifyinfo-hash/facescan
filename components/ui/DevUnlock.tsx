"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

export const ACCESS_KEY = "facescan.access";
const CODE = "1312";
const HOLD_MS = 5000;

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
 * ⚠️ This is a convenience for the site owner, NOT access control. The check
 * runs in the browser, so the code sits in the shipped bundle and anyone who
 * looks will find it. The same is true of the paid unlock itself today —
 * both need a server-verified entitlement before launch.
 */
export function DevUnlock({ children }: { children: React.ReactNode }) {
  const [prompting, setPrompting] = useState(false);
  const [code, setCode] = useState("");
  const [shake, setShake] = useState(false);
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

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code === CODE) {
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
          className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-950/80 p-4 backdrop-blur-md"
          onClick={() => setPrompting(false)}
        >
          <motion.form
            onClick={(e) => e.stopPropagation()}
            onSubmit={submit}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1, x: shake ? [0, -8, 8, -6, 6, 0] : 0 }}
            transition={{ duration: shake ? 0.45 : 0.2 }}
            className="glass-strong w-full max-w-[260px] rounded-3xl p-5"
          >
            <input
              autoFocus
              type="password"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="••••"
              aria-label="Code"
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-lg tracking-[0.5em] outline-none transition-colors placeholder:text-zinc-700 focus:border-accent/50"
            />
          </motion.form>
        </div>
      ) : null}
    </>
  );
}
