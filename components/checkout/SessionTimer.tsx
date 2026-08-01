"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TimerReset } from "lucide-react";
import { useFunnel } from "@/lib/store";

/**
 * Honest privacy countdown. The photos and scan results exist only in
 * browser memory; when this timer hits zero the store really purges them
 * (see lib/store.ts). Real urgency — not a fake discount clock.
 */
export function SessionTimer() {
  const expiresAt = useFunnel((s) => s.expiresAt);
  const unlocked = useFunnel((s) => s.unlocked);
  const purge = useFunnel((s) => s.purge);
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (expiresAt && !unlocked && now >= expiresAt) {
      purge();
      router.replace("/");
    }
  }, [now, expiresAt, unlocked, purge, router]);

  if (!expiresAt || unlocked) return null;

  const remaining = Math.max(0, expiresAt - now);
  const mm = String(Math.floor(remaining / 60000)).padStart(2, "0");
  const ss = String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0");
  const urgent = remaining < 3 * 60 * 1000;

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium ${
        urgent
          ? "border-red-500/30 bg-red-500/10 text-red-300"
          : "border-white/10 bg-white/5 text-zinc-400"
      }`}
    >
      <TimerReset className="h-3.5 w-3.5" aria-hidden />
      <span>
        Private session — your photos & scan are held in this browser only and
        will be discarded in{" "}
        <span className="font-mono-terminal tabular-nums text-zinc-200">
          {mm}:{ss}
        </span>
      </span>
    </div>
  );
}
