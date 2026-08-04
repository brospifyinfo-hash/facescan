"use client";

// Browser-side wrapper around the auth routes. Keeps fetch shapes and error
// codes in one place so components deal in outcomes, not HTTP.

export type RequestCodeResult =
  | { ok: true; devFallback: boolean }
  | { ok: false; error: "invalid_email" | "cooldown" | "rate_limited" | "unconfigured" | "failed"; retryAfterMs?: number };

export async function requestCode(email: string): Promise<RequestCodeResult> {
  try {
    const res = await fetch("/api/auth/request-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data.error ?? "failed", retryAfterMs: data.retryAfterMs };
    }
    return { ok: true, devFallback: Boolean(data.devFallback) };
  } catch {
    return { ok: false, error: "failed" };
  }
}

export type VerifyResult =
  | { ok: true; email: string }
  | { ok: false; error: "wrong_code" | "expired" | "locked" | "invalid_input" | "failed"; attemptsLeft?: number };

export async function verifyCode(
  email: string,
  code: string,
): Promise<VerifyResult> {
  try {
    const res = await fetch("/api/auth/verify-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data.error ?? "failed", attemptsLeft: data.attemptsLeft };
    }
    return { ok: true, email: data.email };
  } catch {
    return { ok: false, error: "failed" };
  }
}

export async function fetchSession(): Promise<string | null> {
  try {
    const res = await fetch("/api/auth/session");
    const data = await res.json();
    return data.email ?? null;
  } catch {
    return null;
  }
}

export async function signOut(): Promise<void> {
  try {
    await fetch("/api/auth/session", { method: "DELETE" });
  } catch {
    /* the cookie expires on its own */
  }
}
