"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";

// The official Google Identity Services button.
//
// RENDERS NOTHING WITHOUT A CLIENT ID. The id is a deploy-time decision
// (NEXT_PUBLIC_GOOGLE_CLIENT_ID); until it exists there is no Google
// sign-in to offer, and a button that errors on tap is worse than no
// button. The GIS script is loaded once and shared — a second mount finds
// `window.google` already there and skips the injection.
//
// The credential that comes back is an ID TOKEN, not an identity: it goes
// to /api/auth/google, which verifies the signature against Google's JWKS
// before any session exists. Nothing in this component trusts the payload.

interface GoogleId {
  initialize(config: {
    client_id: string;
    callback: (response: { credential: string }) => void;
  }): void;
  renderButton(parent: HTMLElement, options: Record<string, unknown>): void;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleId } };
  }
}

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

export function GoogleButton({ onSignedIn }: { onSignedIn: (email: string) => void }) {
  const t = useT();
  const slot = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  // The handler the GIS callback closes over, kept current via a ref so the
  // one-time initialize() never captures a stale onSignedIn.
  const handler = useRef(onSignedIn);
  handler.current = onSignedIn;

  useEffect(() => {
    if (!CLIENT_ID) return;
    const el = slot.current;
    if (!el) return;

    const init = () => {
      const gsi = window.google?.accounts?.id;
      if (!gsi || !el.isConnected) return;
      gsi.initialize({
        client_id: CLIENT_ID,
        callback: async ({ credential }) => {
          setError(false);
          const res = await fetch("/api/auth/google", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ credential }),
          }).catch(() => null);
          const data = await res?.json().catch(() => null);
          if (res?.ok && typeof data?.email === "string") handler.current(data.email);
          else setError(true);
        },
      });
      gsi.renderButton(el, {
        theme: "filled_black",
        size: "large",
        shape: "pill",
        text: "continue_with",
        width: 300,
      });
    };

    if (window.google?.accounts?.id) {
      init();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = init;
    document.head.appendChild(script);
    // The script stays: it is a shared singleton, and removing it would
    // break a second modal that mounted meanwhile.
  }, []);

  if (!CLIENT_ID) return null;

  return (
    <div>
      <div className="my-4 flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-[var(--color-hairline)]" />
        <span className="t-caption text-[var(--color-ink-tertiary)]">{t.auth.or}</span>
        <span className="h-px flex-1 bg-[var(--color-hairline)]" />
      </div>
      <div ref={slot} className="flex justify-center" />
      {error ? (
        <p className="mt-2 text-center text-[12px] text-red-400">{t.auth.errors.failed}</p>
      ) : null}
    </div>
  );
}
