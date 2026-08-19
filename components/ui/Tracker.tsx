"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { getConsent } from "@/lib/consent";

// The visit beacon — CONSENT-GATED. It does not exist until the visitor
// chose "accept all" on the banner; "essential only" means this component
// renders nothing forever, so declining costs no functionality.
//
// WHAT IT SENDS: a random session id (sessionStorage — dies with the tab),
// the current path, and the seconds spent per path, accumulated HERE so the
// server stores one small record per session instead of reconstructing
// durations from event streams. Country/city/IP are attached server-side
// from the request headers; nothing about the visitor's device is collected
// beyond what every request carries anyway.
//
// CADENCE: one "view" per navigation, one heartbeat every 25 s while the
// tab is visible, one final beacon on pagehide. The heartbeat is what keeps
// the live view honest (presence expires server-side at 90 s), and it
// PAUSES when the tab is hidden — a background tab is not a visit.

const HEARTBEAT_MS = 25_000;

function sid(): string {
  try {
    let v = sessionStorage.getItem("facescan.sid");
    if (!v || !/^[a-z0-9]{16}$/.test(v)) {
      v = Array.from(crypto.getRandomValues(new Uint8Array(8)))
        .map((b) => (b % 36).toString(36))
        .join("")
        .padEnd(16, "0")
        .slice(0, 16);
      sessionStorage.setItem("facescan.sid", v);
      sessionStorage.setItem("facescan.sid.t", String(Date.now()));
    }
    return v;
  } catch {
    return "anonymous0000000";
  }
}

function startedAt(): number {
  try {
    const v = Number(sessionStorage.getItem("facescan.sid.t"));
    return Number.isFinite(v) && v > 0 ? v : Date.now();
  } catch {
    return Date.now();
  }
}

export function Tracker() {
  const pathname = usePathname();
  const pages = useRef<Record<string, number>>({});
  const lastTick = useRef(Date.now());
  const consented = useRef(false);

  useEffect(() => {
    consented.current = getConsent() === "all";
    const onConsent = (e: Event) => {
      consented.current = (e as CustomEvent).detail === "all";
    };
    window.addEventListener("facescan:consent", onConsent);
    return () => window.removeEventListener("facescan:consent", onConsent);
  }, []);

  useEffect(() => {
    if (!pathname) return;

    const send = (event: "view" | "beat", useBeacon = false) => {
      if (!consented.current) return;
      // Accrue the seconds since the last tick onto the current path.
      const now = Date.now();
      if (document.visibilityState === "visible") {
        pages.current[pathname] =
          (pages.current[pathname] ?? 0) + Math.min(60, (now - lastTick.current) / 1000);
      }
      lastTick.current = now;

      const body = JSON.stringify({
        sid: sid(),
        startedAt: startedAt(),
        path: pathname,
        event,
        pages: pages.current,
      });
      if (useBeacon && navigator.sendBeacon) {
        navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
      } else {
        void fetch("/api/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        }).catch(() => {});
      }
    };

    lastTick.current = Date.now();
    send("view");

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") send("beat");
    }, HEARTBEAT_MS);
    const onHide = () => send("beat", true);
    window.addEventListener("pagehide", onHide);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("pagehide", onHide);
    };
  }, [pathname]);

  return null;
}
