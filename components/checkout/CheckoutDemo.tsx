"use client";

import { CheckoutModal } from "./CheckoutModal";
import type { PlanId } from "@/lib/pricing";

// DEVELOPMENT ONLY. The plan sheet on a page of its own, because reaching it
// through the funnel means a scan, a sign-in and a live Stripe key — three
// things that have nothing to do with looking at the layout. Same
// arrangement as components/auth/AuthDemo.tsx.
export function CheckoutDemo({ start }: { start: PlanId }) {
  return (
    <main className="min-h-dvh">
      <CheckoutModal
        open
        initialPlan={start}
        onClose={() => {}}
        onSuccess={() => {}}
      />
    </main>
  );
}
