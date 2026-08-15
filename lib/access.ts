// One place that answers "may this address use this feature?"
//
// WHY IT IS SHARED
// ----------------
// Three endpoints spend real money per call — the deep-dive report, the style
// advice and the image render — and each was reaching for the session, the
// entitlement store and the capability table on its own. Copies of an
// authorisation check drift, and the drift is silent: the endpoint that
// forgot a condition does not fail, it just lets people in.
//
// WHAT IT DOES NOT DO
// -------------------
// It does not ration. Quotas belong to the caller because they differ per
// feature — nine images is a spending limit, ten scans is a product limit,
// and the report has neither. See lib/style/quota.ts and lib/history/quota.ts
// for why those two are deliberately not the same shape.
//
// THE ENFORCEMENT IS CONDITIONAL, AND ON PURPOSE. When purchases cannot be
// granted at all — no Stripe key, no webhook secret, or a store that loses
// data — refusing on a missing entitlement would refuse everybody, including
// customers who paid. entitlementsEnforceable() carries that judgement and
// the reasoning behind it; this file just obeys it and reports which way it
// went, so a caller can log the fact rather than the hole being invisible.

import { currentSession } from "./auth/session";
import { entitlements, entitlementsEnforceable } from "./stripe/entitlements";
import { can, type Capability } from "./pricing";

export type AccessResult =
  | {
      ok: true;
      email: string;
      /** False when the entitlement check was skipped. Worth logging. */
      enforced: boolean;
    }
  | { ok: false; status: 401; error: "unauthorized" }
  | { ok: false; status: 403; error: "not_entitled" };

/**
 * A session is always required; the entitlement only when one could exist.
 *
 * The address comes from the signed cookie and never from the body — a
 * feature billed and stored against an account must not let the caller name
 * the account.
 */
export async function requireCapability(capability: Capability): Promise<AccessResult> {
  const session = await currentSession();
  if (!session) return { ok: false, status: 401, error: "unauthorized" };

  const enforced = entitlementsEnforceable();
  if (enforced) {
    const ent = await entitlements.get(session.email);
    if (!ent || !can(ent.plan, capability)) {
      return { ok: false, status: 403, error: "not_entitled" };
    }
  }

  return { ok: true, email: session.email, enforced };
}
