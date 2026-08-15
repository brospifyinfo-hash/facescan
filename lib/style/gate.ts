// Who is allowed into the style studio.
//
// Shared by both routes so the two cannot drift apart — an advice endpoint
// that is stricter than the render endpoint is a bug you find in the logs
// six weeks later.
//
// THREE CONDITIONS, AND THE MIDDLE ONE IS CONDITIONAL ON REALITY
//
//   1. A session. The pictures are billed and stored against an address, so
//      there has to be one, and it comes from the signed cookie rather than
//      the body.
//
//   2. A blueprint entitlement — WHEN THE STORE CAN HOLD ONE. Stripe is not
//      configured in production today, so the entitlement store is
//      memory-backed and permanently empty; requiring an entitlement there
//      would ship a feature nobody can open, which is exactly how every
//      history write ended up being refused in silence. So: if the store is
//      real, the entitlement is required and a lower tier is turned away. If
//      it is not real, the check is skipped and the fact is logged and
//      returned, so this is visible rather than a quiet hole.
//
//   3. Quota. Unconditional, and the reason 2 can be relaxed at all — see
//      ./quota.ts.
//
// When Stripe and Upstash are configured, 2 becomes load-bearing on its own
// and nothing here needs changing.

import { currentSession } from "../auth/session";
import { entitlements, entitlementsEnforceable } from "../stripe/entitlements";
import { can } from "../pricing";
import { quotaFor, type QuotaState } from "./quota";

export type GateFailure =
  | { ok: false; status: 401; error: "unauthorized" }
  | { ok: false; status: 403; error: "not_entitled" }
  | { ok: false; status: 429; error: "quota_exhausted"; quota: QuotaState };

export type GateResult =
  | {
      ok: true;
      email: string;
      quota: QuotaState;
      /** True when condition 2 was skipped because the store cannot hold one. */
      entitlementUnenforced: boolean;
    }
  | GateFailure;

export async function gateStyle(): Promise<GateResult> {
  const session = await currentSession();
  if (!session) return { ok: false, status: 401, error: "unauthorized" };

  const enforceable = entitlementsEnforceable();
  if (enforceable) {
    const ent = await entitlements.get(session.email);
    if (!ent || !can(ent.plan, "hairstyle")) {
      return { ok: false, status: 403, error: "not_entitled" };
    }
  }

  const quota = await quotaFor(session.email);
  if (quota.remaining <= 0) {
    return { ok: false, status: 429, error: "quota_exhausted", quota };
  }

  return {
    ok: true,
    email: session.email,
    quota,
    entitlementUnenforced: !enforceable,
  };
}
