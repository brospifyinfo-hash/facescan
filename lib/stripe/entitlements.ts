// What a given address has paid for.
//
// TWO BACKINGS, CHOSEN BY THE ENVIRONMENT — same arrangement as the OTP
// store, and here the memory one is worse: a cold start wipes it and two
// serverless instances do not share it, so a customer pays and then finds
// the purchase gone. Stripe has their money and the app has no record.
//
// Entitlements have NO expiry. A purchase is permanent, so unlike an OTP
// nothing here is written with a TTL — except the processed-event set,
// which only needs to outlive Stripe's retry schedule.
//
// The webhook is the ONLY writer. The client never grants itself anything.

import type { PlanId } from "@/lib/pricing";
import { kv, kvConfigured } from "@/lib/kv";

export interface Entitlement {
  plan: PlanId;
  paymentIntentId: string;
  grantedAt: number;
}

/**
 * One line of the customer's receipt list.
 *
 * Kept separately from the Entitlement because they answer different
 * questions. The entitlement is "what does this address own NOW", and an
 * upgrade overwrites it; the payments are "what was actually charged", and
 * nothing may ever overwrite those — an upgrade adds a second line.
 */
export interface Payment {
  plan: PlanId;
  paymentIntentId: string;
  /** Minor units, as Stripe reports it. Null when the event did not carry it. */
  amount: number | null;
  currency: string | null;
  at: number;
}

export interface EntitlementStore {
  grant(email: string, ent: Entitlement): Promise<void>;
  get(email: string): Promise<Entitlement | null>;
  /** Append-only. The customer's receipts, newest first. */
  recordPayment(email: string, payment: Payment): Promise<void>;
  payments(email: string): Promise<Payment[]>;
  /** Idempotency: Stripe retries webhooks, so replays must be no-ops. */
  hasProcessed(eventId: string): Promise<boolean>;
  markProcessed(eventId: string): Promise<void>;
}

/** Plenty for a one-off purchase product, and bounds the key. */
const MAX_PAYMENTS = 50;

/** Higher tiers win, so an upgrade never downgrades what was already bought. */
const RANK: Record<PlanId, number> = { raw: 1, pro: 2, blueprint: 3 };

class MemoryEntitlementStore implements EntitlementStore {
  private byEmail = new Map<string, Entitlement>();
  private paid = new Map<string, Payment[]>();
  private events = new Set<string>();

  async grant(email: string, ent: Entitlement) {
    const existing = this.byEmail.get(email);
    if (existing && RANK[existing.plan] >= RANK[ent.plan]) return;
    this.byEmail.set(email, ent);
  }
  async get(email: string) {
    return this.byEmail.get(email) ?? null;
  }
  async recordPayment(email: string, payment: Payment) {
    const list = this.paid.get(email) ?? [];
    if (list.some((p) => p.paymentIntentId === payment.paymentIntentId)) return;
    this.paid.set(email, [payment, ...list].slice(0, MAX_PAYMENTS));
  }
  async payments(email: string) {
    return this.paid.get(email) ?? [];
  }
  async hasProcessed(eventId: string) {
    return this.events.has(eventId);
  }
  async markProcessed(eventId: string) {
    this.events.add(eventId);
  }
}

/**
 * Redis-backed store. A purchase written here survives the deploy, the cold
 * start and the instance that handled the webhook.
 *
 * KEY LAYOUT
 *   ent:<email>        JSON Entitlement, no TTL — a purchase is permanent
 *   stripeevt:<id>     idempotency marker, 30-day TTL
 *
 * Thirty days on the marker because that is comfortably past Stripe's
 * retry schedule (roughly three days). Keeping them forever would grow
 * without bound to defend against a replay that can no longer happen.
 */
class RedisEntitlementStore implements EntitlementStore {
  private key = (email: string) => `ent:${email}`;
  private payKey = (email: string) => `pay:${email}`;
  private eventKey = (id: string) => `stripeevt:${id}`;

  async grant(email: string, ent: Entitlement) {
    // Read-then-write, deliberately not atomic. The only writer is the
    // Stripe webhook, and the rank guard below makes a concurrent replay
    // of the SAME event idempotent anyway. Two genuinely different
    // purchases arriving in the same millisecond would be a race — and the
    // higher tier winning is the outcome we want in either interleaving.
    const existing = await this.get(email);
    if (existing && RANK[existing.plan] >= RANK[ent.plan]) return;
    await kv("SET", this.key(email), JSON.stringify(ent));
  }

  async get(email: string) {
    const raw = await kv("GET", this.key(email));
    if (typeof raw !== "string") return null;
    try {
      const parsed = JSON.parse(raw) as Entitlement;
      // A record that does not name a known plan cannot be honoured, and
      // guessing one would hand out access nobody paid for.
      return parsed && parsed.plan in RANK ? parsed : null;
    } catch {
      return null;
    }
  }

  /**
   * Append-only, and deduplicated by payment intent.
   *
   * The event id already makes the webhook idempotent, but that marker has a
   * 30-day TTL while a receipt does not — so a Stripe replay after the marker
   * expired would otherwise add the same charge to the list a second time.
   */
  async recordPayment(email: string, payment: Payment) {
    const existing = await this.payments(email);
    if (existing.some((p) => p.paymentIntentId === payment.paymentIntentId)) return;
    await kv("LPUSH", this.payKey(email), JSON.stringify(payment));
    await kv("LTRIM", this.payKey(email), "0", String(MAX_PAYMENTS - 1));
  }

  async payments(email: string) {
    const rows = await kv("LRANGE", this.payKey(email), "0", String(MAX_PAYMENTS - 1));
    if (!Array.isArray(rows)) return [];
    return rows
      .map((r) => {
        try {
          return JSON.parse(String(r)) as Payment;
        } catch {
          return null;
        }
      })
      .filter((p): p is Payment => p !== null && p.plan in RANK);
  }

  async hasProcessed(eventId: string) {
    return (await kv("EXISTS", this.eventKey(eventId))) === 1;
  }

  async markProcessed(eventId: string) {
    await kv("SET", this.eventKey(eventId), "1", "EX", String(30 * 24 * 60 * 60));
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __facescanEntitlements: EntitlementStore | undefined;
}

export const entitlements: EntitlementStore =
  globalThis.__facescanEntitlements ??
  (globalThis.__facescanEntitlements = kvConfigured()
    ? new RedisEntitlementStore()
    : new MemoryEntitlementStore());

/** Which backing is live. Surfaced by the health check, never to a user. */
export const entitlementBacking = (): "redis" | "memory" =>
  kvConfigured() ? "redis" : "memory";
