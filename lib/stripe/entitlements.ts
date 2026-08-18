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
import { skGet, skGetJson, skSet, skSetJson, sheetsKvConfigured, sheetsKvHealthy } from "@/lib/sheets-kv";

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

/**
 * Spreadsheet-backed store — what production actually runs on.
 *
 * A purchase written here survives everything a purchase has to survive, and
 * it has one property Redis does not: the owner can open the tab and see who
 * bought what. For a product selling a handful of one-off unlocks a day, that
 * is worth more than the milliseconds.
 *
 * The payment list is held as one JSON array per address rather than as a
 * Redis list, because the backend has get and set and does not have LPUSH.
 * Same cap, same newest-first order, same dedupe by payment intent.
 */
class SheetsEntitlementStore implements EntitlementStore {
  private key = (email: string) => `ent:${email}`;
  private payKey = (email: string) => `pay:${email}`;
  private eventKey = (id: string) => `stripeevt:${id}`;

  /** The old behaviour, kept as a floor. See SheetsOtpStore for why. */
  private fallback = new MemoryEntitlementStore();

  /**
   * Positive reads, remembered per instance.
   *
   * Two jobs. FRESH (under a minute) it answers without a round trip — one
   * style-studio run gates four requests in quick succession, and four
   * spreadsheet reads for one unchanged answer is how Apps-Script timeouts
   * get provoked. STALE it is the answer of last resort when the backend
   * errors: a purchase is permanent, so a positive read CANNOT go wrong by
   * being old — while falling through to the empty memory floor turns one
   * slow spreadsheet call into a 403 for somebody who paid.
   *
   * Only ever positive. A null is never cached, so a fresh purchase shows up
   * on the next read rather than after a minute.
   */
  // Twenty seconds, not sixty: the burst this exists for — one advice call
  // and three renders gating within a couple of seconds — fits easily, while
  // the window in which an UPGRADE (pro → blueprint) can be answered with
  // the old tier stays short. Stale-on-error has no such bound on purpose.
  private seen = new Map<string, { ent: Entitlement; at: number }>();
  private static FRESH_MS = 20_000;

  private async via<T>(remote: () => Promise<T>, local: () => Promise<T>): Promise<T> {
    if (!sheetsKvHealthy()) return local();
    try {
      return await remote();
    } catch {
      return local();
    }
  }

  async grant(email: string, ent: Entitlement) {
    return this.via(
      async () => {
        const existing = await this.get(email);
        if (existing && RANK[existing.plan] >= RANK[ent.plan]) return;
        // No TTL. A purchase is permanent, and an entitlement that quietly
        // expired would take a customer access with it.
        await skSetJson(this.key(email), ent);
        this.seen.set(email, { ent, at: Date.now() });
      },
      () => this.fallback.grant(email, ent),
    );
  }

  async get(email: string) {
    const hit = this.seen.get(email);
    if (hit && Date.now() - hit.at < SheetsEntitlementStore.FRESH_MS) return hit.ent;

    return this.via(
      async () => {
        const parsed = await skGetJson<Entitlement>(this.key(email));
        // A record naming an unknown plan cannot be honoured, and guessing
        // one would hand out access nobody paid for.
        const ent = parsed && parsed.plan in RANK ? parsed : null;
        if (ent) this.seen.set(email, { ent, at: Date.now() });
        // The backend answered: its word beats any cache. (Entitlements are
        // never revoked, so a null here after a positive would mean the row
        // was removed by hand — honour that too.)
        else this.seen.delete(email);
        return ent;
      },
      () => {
        // Backend error. A stale positive is still true — see above.
        if (hit) return Promise.resolve(hit.ent);
        return this.fallback.get(email);
      },
    );
  }

  async recordPayment(email: string, payment: Payment) {
    return this.via(
      async () => {
        const existing = await this.payments(email);
        if (existing.some((p) => p.paymentIntentId === payment.paymentIntentId)) return;
        await skSetJson(this.payKey(email), [payment, ...existing].slice(0, MAX_PAYMENTS));
      },
      () => this.fallback.recordPayment(email, payment),
    );
  }

  async payments(email: string) {
    return this.via(
      async () => {
        const rows = await skGetJson<Payment[]>(this.payKey(email));
        if (!Array.isArray(rows)) return [];
        return rows.filter((p): p is Payment => Boolean(p) && p.plan in RANK);
      },
      () => this.fallback.payments(email),
    );
  }

  async hasProcessed(eventId: string) {
    return this.via(
      async () => (await skGet(this.eventKey(eventId))) !== null,
      () => this.fallback.hasProcessed(eventId),
    );
  }

  async markProcessed(eventId: string) {
    return this.via(
      () => skSet(this.eventKey(eventId), "1", 30 * 24 * 60 * 60 * 1000),
      () => this.fallback.markProcessed(eventId),
    );
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
    : sheetsKvConfigured()
      ? new SheetsEntitlementStore()
      : new MemoryEntitlementStore());

/** Which backing is live. Surfaced by the health check, never to a user. */
export const entitlementBacking = (): "redis" | "sheets" | "memory" =>
  kvConfigured() ? "redis" : sheetsKvConfigured() ? "sheets" : "memory";

/**
 * May a feature be refused on the grounds that no entitlement exists?
 *
 * ONLY WHEN AN ENTITLEMENT COULD EXIST. Three things have to hold, and the
 * store being persistent is just one of them:
 *
 *   1. the store survives a cold start — otherwise a purchase made a minute
 *      ago may already be gone, and refusing on its absence punishes someone
 *      who paid
 *   2. Stripe has a secret key — otherwise checkout cannot run at all
 *   3. the webhook secret is set — and this is the one that is easy to miss:
 *      the webhook is the ONLY writer of entitlements. Without it, checkout
 *      can take money and nothing is ever granted, so every gate would be
 *      shut against every customer including the paying ones.
 *
 * Switching the OTP and entitlement stores onto the spreadsheet made (1) true
 * for the first time, which would have silently armed every entitlement gate
 * in the app while (2) and (3) were still false — turning "everyone gets in"
 * into "nobody gets in" as a side effect of fixing storage. Hence one shared
 * predicate rather than each caller testing the backing itself.
 */
export const entitlementsEnforceable = (): boolean =>
  entitlementBacking() !== "memory" &&
  // A spreadsheet backend that has failed is a memory store wearing its
  // name; enforcing against it would refuse customers whose purchase is
  // sitting in a Map on another instance.
  (kvConfigured() || sheetsKvHealthy()) &&
  Boolean(process.env.STRIPE_SECRET_KEY) &&
  Boolean(process.env.STRIPE_WEBHOOK_SECRET);
