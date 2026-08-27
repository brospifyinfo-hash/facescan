"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { GoogleMark } from "./GoogleMark";
import { useT } from "@/lib/i18n";

// "Continue with Google", as OUR control.
//
// WHY NOT THE BUTTON GOOGLE RENDERS. google.accounts.id.renderButton()
// injects its own markup into the page: a fixed pixel width that never
// matches the sheet, its own type, its own height, and a white logo disc
// that hangs out of the pill on a dark theme. It cannot be styled — the
// library owns it — so on a designed surface it always reads as a widget
// somebody pasted in, which is exactly what it looked like here.
//
// So the control is ours and the FLOW is the token client: a click opens
// Google's own popup, and what comes back is an access token that the
// server takes to Google's tokeninfo endpoint, where the audience is
// checked against our client id (see lib/auth/google.ts — that check is
// what stops a token minted for another app from opening a session here).
//
// The logo is Google's official four-colour G and the label is one of
// their sanctioned strings, per the branding guidelines: a custom button
// is allowed, an unofficial mark is not.
//
// The script is loaded once and shared: a second mount finds
// window.google.accounts.oauth2 already there and skips the injection.

interface TokenClient {
  requestAccessToken(): void;
}

interface GoogleOAuth2 {
  initTokenClient(config: {
    client_id: string;
    scope: string;
    callback: (res: { access_token?: string; error?: string }) => void;
    error_callback?: (err: unknown) => void;
  }): TokenClient;
}

declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GoogleOAuth2 } };
  }
}

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const SRC = "https://accounts.google.com/gsi/client";

export function GoogleButton({ onSignedIn }: { onSignedIn: (email: string) => void }) {
  const t = useT();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const client = useRef<TokenClient | null>(null);
  // The handler the callback closes over, kept current via a ref so the
  // one-time client never captures a stale onSignedIn.
  const handler = useRef(onSignedIn);
  handler.current = onSignedIn;

  useEffect(() => {
    if (!CLIENT_ID) return;

    const init = () => {
      const oauth2 = window.google?.accounts?.oauth2;
      if (!oauth2) return;
      client.current = oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: "openid email profile",
        callback: async (res) => {
          if (!res.access_token) {
            setBusy(false);
            setError(true);
            return;
          }
          const r = await fetch("/api/auth/google", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ accessToken: res.access_token }),
          }).catch(() => null);
          const data = await r?.json().catch(() => null);
          setBusy(false);
          if (r?.ok && typeof data?.email === "string") handler.current(data.email);
          else setError(true);
        },
        // A closed popup is a decision, not a fault — clear the spinner and
        // say nothing.
        error_callback: () => setBusy(false),
      });
      setReady(true);
    };

    if (window.google?.accounts?.oauth2) {
      init();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SRC}"]`);
    if (existing) {
      existing.addEventListener("load", init);
      return () => existing.removeEventListener("load", init);
    }
    const script = document.createElement("script");
    script.src = SRC;
    script.async = true;
    script.onload = init;
    document.head.appendChild(script);
    // The script stays: it is a shared singleton, and removing it would
    // break a second sheet that mounted meanwhile.
  }, []);

  if (!CLIENT_ID) return null;

  return (
    <div>
      <div className="my-5 flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-[rgba(255,255,255,0.12)]" />
        <span className="auth-quiet text-[11px]">{t.auth.or}</span>
        <span className="h-px flex-1 bg-[rgba(255,255,255,0.12)]" />
      </div>

      <button
        type="button"
        className="auth-google"
        disabled={!ready || busy}
        onClick={() => {
          setError(false);
          setBusy(true);
          client.current?.requestAccessToken();
        }}
      >
        {busy ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <GoogleMark />}
        <span>{t.auth.googleCta}</span>
      </button>

      {error ? (
        <p className="mt-2 text-center text-[12px] text-[var(--auth-bad)]">
          {t.auth.errors.failed}
        </p>
      ) : null}
    </div>
  );
}
