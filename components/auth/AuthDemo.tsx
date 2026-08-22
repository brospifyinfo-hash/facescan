"use client";

import { useState } from "react";
import { AuthModal } from "./AuthModal";
import { OrbitCode } from "./OrbitCode";
import { PaidBurst } from "@/components/checkout/PaidBurst";

/** Dev-only harness — see app/admin/auth-demo/page.tsx. */
export function AuthDemo({
  start,
  what,
}: {
  start: "login" | "register";
  what: string;
}) {
  const [code, setCode] = useState("482913");

  if (what === "paid") {
    return (
      <main className="flex min-h-dvh items-center justify-center p-6">
        <div className="relative h-[420px] w-full max-w-sm rounded-[28px] border border-white/10">
          <PaidBurst plan="blueprint" onDone={() => {}} />
        </div>
      </main>
    );
  }

  if (what === "orbit") {
    return (
      <main className="auth-scope mx-auto flex min-h-dvh w-full max-w-3xl flex-col items-center justify-center gap-14 px-4">
        {(["idle", "ok", "bad"] as const).map((state) => (
          <div key={state} className="auth-sheet w-full max-w-sm rounded-[28px] p-7">
            <p className="auth-quiet mb-4 text-center text-[11px] uppercase tracking-[0.1em]">
              {state}
            </p>
            <OrbitCode
              value={state === "idle" ? "4829" : code}
              onChange={setCode}
              verdict={state === "idle" ? null : state}
            />
          </div>
        ))}
      </main>
    );
  }

  return (
    <main className="min-h-dvh">
      <AuthModal open onClose={() => {}} onSignedIn={() => {}} start={start} />
    </main>
  );
}
