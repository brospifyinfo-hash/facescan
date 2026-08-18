import { isPlanId } from "./server";
import type { PlanId } from "@/lib/pricing";

// May this session be granted from this payment?
//
// Extracted from the route so the answer can be tested exhaustively. The
// route itself needs a request context — cookies, a Stripe round trip — and
// the part that actually matters is none of that: it is the decision, and a
// decision worth making is worth pinning down.
//
// THE THIRD CHECK IS THE SECURITY ONE. Without it, /api/stripe/confirm would
// grant access to whoever can guess a payment intent id, which is a worse bug
// than the missing webhook it exists to work around.

export type ClaimVerdict =
  | { ok: true; plan: PlanId }
  | { ok: false; reason: "not_paid" | "unusable_intent" | "not_yours" };

export function mayClaim(
  intent: {
    status?: string | null;
    metadata?: { plan?: string | null; email?: string | null } | null;
  },
  sessionEmail: string,
): ClaimVerdict {
  if (intent.status !== "succeeded") return { ok: false, reason: "not_paid" };

  const plan = intent.metadata?.plan;
  const email = intent.metadata?.email;
  if (!isPlanId(plan) || !email) return { ok: false, reason: "unusable_intent" };

  // Case- and whitespace-insensitive: the address is stored normalised, and
  // Stripe hands back whatever string was written into the metadata.
  const norm = (v: string) => v.trim().toLowerCase();
  if (norm(email) !== norm(sessionEmail)) return { ok: false, reason: "not_yours" };

  return { ok: true, plan };
}
