// What a given address has paid for.
//
// ⚠️ PROTOTYPE BACKING: a globalThis Map, same caveat as the OTP store —
// a cold start wipes it and two serverless instances do not share it, so a
// customer can pay and then find the purchase gone. Everything the app needs
// is the `EntitlementStore` interface; swapping in Postgres or Redis means
// one more implementation and changing the export at the bottom.
//
// The webhook is the ONLY writer. The client never grants itself anything.

import type { PlanId } from "@/lib/pricing";

export interface Entitlement {
  plan: PlanId;
  paymentIntentId: string;
  grantedAt: number;
}

export interface EntitlementStore {
  grant(email: string, ent: Entitlement): Promise<void>;
  get(email: string): Promise<Entitlement | null>;
  /** Idempotency: Stripe retries webhooks, so replays must be no-ops. */
  hasProcessed(eventId: string): Promise<boolean>;
  markProcessed(eventId: string): Promise<void>;
}

/** Higher tiers win, so an upgrade never downgrades what was already bought. */
const RANK: Record<PlanId, number> = { raw: 1, pro: 2, blueprint: 3 };

class MemoryEntitlementStore implements EntitlementStore {
  private byEmail = new Map<string, Entitlement>();
  private events = new Set<string>();

  async grant(email: string, ent: Entitlement) {
    const existing = this.byEmail.get(email);
    if (existing && RANK[existing.plan] >= RANK[ent.plan]) return;
    this.byEmail.set(email, ent);
  }
  async get(email: string) {
    return this.byEmail.get(email) ?? null;
  }
  async hasProcessed(eventId: string) {
    return this.events.has(eventId);
  }
  async markProcessed(eventId: string) {
    this.events.add(eventId);
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __facescanEntitlements: EntitlementStore | undefined;
}

export const entitlements: EntitlementStore =
  globalThis.__facescanEntitlements ??
  (globalThis.__facescanEntitlements = new MemoryEntitlementStore());
