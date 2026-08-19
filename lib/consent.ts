"use client";

// The consent switch the banner writes and the tracker reads.
//
// TWO STATES PLUS "NOT ANSWERED YET". Essential cookies (session, checkout)
// never needed consent to function — the choice being made here is ONLY
// about the visit statistics, so declining must cost the visitor nothing:
// the tracker simply never starts. localStorage rather than a cookie, so
// the decision never travels to the server at all.

export type Consent = "unset" | "all" | "essential";

const KEY = "facescan.consent";

export function getConsent(): Consent {
  if (typeof window === "undefined") return "unset";
  try {
    const v = localStorage.getItem(KEY);
    return v === "all" || v === "essential" ? v : "unset";
  } catch {
    // Storage blocked entirely — treat as declined, never as consented.
    return "essential";
  }
}

export function setConsent(value: Exclude<Consent, "unset">): void {
  try {
    localStorage.setItem(KEY, value);
  } catch {
    /* storage blocked — the banner will simply ask again next visit */
  }
  // Same-tab listeners (the tracker) get no native storage event.
  window.dispatchEvent(new CustomEvent("facescan:consent", { detail: value }));
}
