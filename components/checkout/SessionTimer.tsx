"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TimerReset } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useFunnel } from "@/lib/store";

/**
 * Honest privacy countdown. The photos and scan results exist only in
 * browser memory; when this timer hits zero the store really purges them
 * (see lib/store.ts). Real urgency — not a fake discount clock.
 */
export function SessionTimer() {
  const expiresAt = useFunnel((s) => s.expiresAt);
  const unlocked = useFunnel((s) => s.unlocked);
  const paying = useFunnel((s) => s.paying);
  const purge = useFunnel((s) => s.purge);
  const router = useRouter();
  const t = useT();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    // NOT WHILE A PAYMENT IS RUNNING. `unlocked` turns true only once the
    // entitlement is granted, which is seconds after the card is charged and
    // can be minutes for a delayed method — so between those two moments this
    // timer used to delete the very scan the customer was paying for and send
    // them back to the home page. They would be charged, on the front page,
    // with nothing to show for it.
    if (expiresAt && !unlocked && !paying && now >= expiresAt) {
      purge();
      router.replace("/");
    }
  }, [now, expiresAt, unlocked, paying, purge, router]);

  // The countdown also stops being SHOWN during payment: a clock running out
  // while somebody is entering their card is pressure the product does not
  // mean to apply, and it is no longer telling the truth anyway.
  if (!expiresAt || unlocked || paying) return null;

  const remaining = Math.max(0, expiresAt - now);
  const mm = String(Math.floor(remaining / 60000)).padStart(2, "0");
  const ss = String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0");
  const urgent = remaining < 3 * 60 * 1000;

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[11px] font-medium ${
        urgent
          ? "border border-red-500/25 bg-red-500/10 text-red-300"
          : "material-nav text-[var(--color-ink-secondary)]"
      }`}
    >
      <TimerReset className="h-3.5 w-3.5" aria-hidden />
      <span>
        {t.session.notice}{" "}
        <span className="font-mono-terminal tabular-nums text-[var(--color-ink)]">
          {mm}:{ss}
        </span>
      </span>
    </div>
  );
}
