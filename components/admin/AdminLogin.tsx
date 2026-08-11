"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";

/**
 * The code prompt.
 *
 * It submits to /api/admin/login and never sees the code it is checking
 * against — the server answers yes or no and sets the cookie itself.
 */
export function AdminLogin() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [wrong, setWrong] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setWrong(false);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (res.ok) {
        // Server component, so the gate is re-evaluated on the server.
        router.refresh();
      } else {
        setWrong(true);
        setCode("");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-sm flex-col justify-center px-4">
      <form onSubmit={submit} className="panel p-[var(--pad-panel)]">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-accent-deep)]">
          <Lock className="h-5 w-5 text-[var(--color-accent)]" aria-hidden />
        </div>

        <h1 className="t-title3 mt-4 text-center">Admin</h1>
        <p className="t-caption mt-1.5 text-center text-[var(--color-ink-secondary)]">
          Code eingeben, um den Produktkatalog zu bearbeiten.
        </p>

        <input
          autoFocus
          type="password"
          inputMode="numeric"
          enterKeyHint="go"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="••••••••"
          aria-label="Admin-Code"
          className="mt-5 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-lg tracking-[0.4em] outline-none transition-colors placeholder:text-[var(--color-ink-quaternary)] focus:border-[var(--color-accent)]/50"
        />

        {wrong ? (
          <p className="mt-2 text-center text-[12px] text-red-300">Falscher Code.</p>
        ) : null}

        <button
          type="submit"
          disabled={busy || code.length === 0}
          className="mt-4 w-full rounded-2xl bg-[var(--color-accent)] py-3 text-[15px] font-semibold text-[var(--color-accent-ink)] transition-opacity disabled:opacity-30"
        >
          {busy ? "Wird geprüft…" : "Weiter"}
        </button>
      </form>
    </main>
  );
}
