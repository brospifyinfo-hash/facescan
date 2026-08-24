// Persistence for the partner programme.
//
// THREE BACKINGS, CHOSEN BY THE ENVIRONMENT — the same arrangement as
// lib/stripe/entitlements.ts, and for the same reason: Upstash first when it
// is configured, the spreadsheet when it is not, a process-local Map as the
// last resort. The Map is correct for local development and for the tests,
// and WRONG in production: a cold start would wipe every commission ever
// booked, and a partner whose earnings vanished has no way to prove they
// existed. `affiliatePersistent()` is what the UI asks before it promises
// anybody money.
//
// KEY LAYOUT (docs/AFFILIATE-PROMPT.md section 3, unchanged)
//   affcfg                        the single configuration record
//   aff:<email>                   one partner
//   affcode:<CODE>                index CODE -> partner e-mail
//   affinv:<CODE>                 invite/access code
//   affbind:<customerEmail>       customer -> partner, permanent
//   affcom:<affEmail>:<piId>      one commission line, immutable once booked
//   affsum:<affEmail>             denormalised counters
//   affpay:<payoutId>             one payout request
//   affclick:<CODE>:<yyyy-mm-dd>  daily click counter, 120-day TTL
//
// Note that "aff:" is not a prefix of "affcode:", "affcom:", "affsum:" and
// friends — the colon sits in a different place — so a scan for "aff:"
// returns partners and nothing else. That is deliberate; renaming any key so
// that one prefix swallows another would quietly turn the partner list into a
// list of everything.
//
// NOTHING HERE ANSWERS "EMPTY" WHEN IT MEANS "I DON'T KNOW". Both a failed
// read and a failed write throw, because in this store every empty answer is
// also a plausible true answer: no commissions, no partner record, no open
// payout, no binding. A dashboard that renders zero because the spreadsheet
// timed out tells a partner they earned nothing, and `recomputeSummary` would
// then write that zero back as the truth. An error is worse than a fast answer
// and far better than a confident wrong one.
//
// Two reads are exempt because an approximation there is genuinely better than
// a failure: the configuration (the defaults are a documented, sane programme)
// and the click counter (a chart). Neither decides what anybody is owed. See
// `read` versus `readSoft` in SheetsAffiliateStore.

import { kv, kvConfigured } from "@/lib/kv";
import {
  skDel,
  skGetJson,
  skScan,
  skSetJson,
  skBump,
  sheetsKvConfigured,
  sheetsKvHealthy,
} from "@/lib/sheets-kv";
import { normalizeEmail } from "@/lib/auth/store";
import { normalizeConfig } from "@/lib/affiliate/config";
import { normalizeCode, randomCode } from "@/lib/affiliate/codes";
import {
  EMPTY_SUMMARY,
  type Affiliate,
  type AffiliateConfig,
  type AffiliateSummary,
  type Binding,
  type Commission,
  type InviteCode,
  type Payout,
} from "@/lib/affiliate/model";

export interface AffiliateStore {
  getConfig(): Promise<AffiliateConfig>;
  setConfig(cfg: AffiliateConfig): Promise<void>;
  getAffiliate(email: string): Promise<Affiliate | null>;
  putAffiliate(aff: Affiliate): Promise<void>;
  listAffiliates(): Promise<Affiliate[]>;
  affiliateByCode(code: string): Promise<Affiliate | null>;
  getBinding(customerEmail: string): Promise<Binding | null>;
  putBinding(b: Binding): Promise<void>;
  deleteBinding(customerEmail: string): Promise<void>;
  listBindings(): Promise<Binding[]>;
  getSummary(email: string): Promise<AffiliateSummary>;
  putSummary(email: string, s: AffiliateSummary): Promise<void>;
  bumpSummary(email: string, patch: Partial<Record<keyof AffiliateSummary, number>>): Promise<void>;
  getCommission(affEmail: string, id: string): Promise<Commission | null>;
  /** False when the line already existed — the idempotency brake for Stripe replays. */
  putCommissionIfAbsent(c: Commission): Promise<boolean>;
  /** Status update on an existing line. Never used to create one. */
  putCommission(c: Commission): Promise<void>;
  listCommissions(affEmail: string): Promise<Commission[]>;
  listAllCommissions(): Promise<Commission[]>;
  /** Which partner a PaymentIntent belongs to — so a refund never has to scan. */
  rememberCommissionOwner(paymentIntentId: string, affEmail: string): Promise<void>;
  commissionOwner(paymentIntentId: string): Promise<string | null>;
  getInvite(code: string): Promise<InviteCode | null>;
  putInvite(c: InviteCode): Promise<void>;
  listInvites(): Promise<InviteCode[]>;
  deleteInvite(code: string): Promise<void>;
  getPayout(id: string): Promise<Payout | null>;
  putPayout(p: Payout): Promise<void>;
  listPayouts(): Promise<Payout[]>;
  listPayoutsFor(email: string): Promise<Payout[]>;
  bumpClick(code: string): Promise<void>;
  clicksFor(code: string): Promise<number>;
}

/**
 * What the module needs beyond the public contract.
 *
 * `codeTaken` asks the INDEX, not `affiliateByCode` — a dangling affcode row
 * whose partner was removed by hand still owns that code as far as every
 * incoming link is concerned, so handing it to a second partner would send
 * one partner's clicks to the other.
 */
interface InternalStore extends AffiliateStore {
  codeTaken(code: string): Promise<boolean>;
}

const CFG_KEY = "affcfg";
const affKey = (email: string) => `aff:${normalizeEmail(email)}`;
const codeKey = (code: string) => `affcode:${normalizeCode(code)}`;
const inviteKey = (code: string) => `affinv:${normalizeCode(code)}`;
const bindKey = (email: string) => `affbind:${normalizeEmail(email)}`;
const comPrefix = (email: string) => `affcom:${normalizeEmail(email)}:`;
const comKey = (email: string, id: string) => `${comPrefix(email)}${id}`;
const sumKey = (email: string) => `affsum:${normalizeEmail(email)}`;
const payKey = (id: string) => `affpay:${id}`;
/** PaymentIntent -> partner. Lets a refund find its line without a scan. */
const ownerKey = (paymentIntentId: string) => `affcomidx:${paymentIntentId}`;
const clickPrefix = (code: string) => `affclick:${normalizeCode(code)}:`;

/** Clicks are a chart, not an accounting record; four months is plenty of chart. */
const CLICK_TTL_MS = 120 * 24 * 60 * 60 * 1000;

/** UTC, so a partner's day does not shift with the server's region. */
const today = () => new Date().toISOString().slice(0, 10);

/**
 * The configuration is read on nearly every request — every page of the
 * partner area, every checkout that looks for a binding, and the webhook —
 * and it changes a few times a year. Thirty seconds of process-local cache
 * removes that round trip without making the admin wait noticeably: the
 * instance that saved sees its own change at once (setConfig refreshes the
 * cache), every other instance within half a minute.
 */
const CONFIG_CACHE_MS = 30_000;
let configCache: { cfg: AffiliateConfig; at: number } | null = null;

function cachedConfig(): AffiliateConfig | null {
  if (!configCache) return null;
  return Date.now() - configCache.at < CONFIG_CACHE_MS ? configCache.cfg : null;
}

function rememberConfig(cfg: AffiliateConfig): AffiliateConfig {
  configCache = { cfg, at: Date.now() };
  return cfg;
}

/** Counters only. `updatedAt` is a timestamp and is stamped, never added to. */
function summaryDeltas(
  patch: Partial<Record<keyof AffiliateSummary, number>>,
): Array<[keyof AffiliateSummary, number]> {
  const out: Array<[keyof AffiliateSummary, number]> = [];
  for (const [field, by] of Object.entries(patch)) {
    if (field === "updatedAt") continue;
    if (typeof by !== "number" || !Number.isFinite(by) || by === 0) continue;
    out.push([field as keyof AffiliateSummary, by]);
  }
  return out;
}

function applyDeltas(
  base: AffiliateSummary,
  patch: Partial<Record<keyof AffiliateSummary, number>>,
): AffiliateSummary {
  const next: AffiliateSummary = { ...base };
  for (const [field, by] of summaryDeltas(patch)) {
    next[field] = (Number(next[field]) || 0) + by;
  }
  next.updatedAt = Date.now();
  return next;
}

function coerceSummary(raw: unknown): AffiliateSummary {
  const src = (raw ?? {}) as Partial<Record<keyof AffiliateSummary, unknown>>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  return {
    clicks: num(src.clicks),
    signups: num(src.signups),
    payingCustomers: num(src.payingCustomers),
    revenueCents: num(src.revenueCents),
    earnedCents: num(src.earnedCents),
    paidCents: num(src.paidCents),
    updatedAt: num(src.updatedAt),
  };
}

/* ------------------------------------------------------------------ memory */

/**
 * Correct for tests and local development, unusable in production: nothing
 * here survives a cold start and two serverless instances do not share it.
 * Every consumer asks `affiliatePersistent()` before it shows a partner a
 * balance, precisely so nobody is told they earned money that is about to
 * disappear.
 */
class MemoryAffiliateStore implements InternalStore {
  private cfg: AffiliateConfig | null = null;
  private affiliates = new Map<string, Affiliate>();
  private codes = new Map<string, string>();
  private invites = new Map<string, InviteCode>();
  private bindings = new Map<string, Binding>();
  private commissions = new Map<string, Commission>();
  private owners = new Map<string, string>();
  private summaries = new Map<string, AffiliateSummary>();
  private payouts = new Map<string, Payout>();
  private clicks = new Map<string, number>();

  async getConfig() {
    // Through normalizeConfig even here, so a caller that mutates what it
    // gets back cannot reach into the defaults every other store shares.
    return normalizeConfig(this.cfg);
  }
  async setConfig(cfg: AffiliateConfig) {
    this.cfg = cfg;
  }

  async getAffiliate(email: string) {
    return this.affiliates.get(affKey(email)) ?? null;
  }
  async putAffiliate(aff: Affiliate) {
    this.affiliates.set(affKey(aff.email), aff);
    this.codes.set(codeKey(aff.code), normalizeEmail(aff.email));
  }
  async listAffiliates() {
    return [...this.affiliates.values()];
  }
  async codeTaken(code: string) {
    return this.codes.has(codeKey(code));
  }
  async affiliateByCode(code: string) {
    const email = this.codes.get(codeKey(code));
    return email ? this.getAffiliate(email) : null;
  }

  async getBinding(customerEmail: string) {
    return this.bindings.get(bindKey(customerEmail)) ?? null;
  }
  async putBinding(b: Binding) {
    this.bindings.set(bindKey(b.customerEmail), b);
  }
  async deleteBinding(customerEmail: string) {
    this.bindings.delete(bindKey(customerEmail));
  }
  async listBindings() {
    return [...this.bindings.values()];
  }

  async getSummary(email: string) {
    return { ...(this.summaries.get(sumKey(email)) ?? EMPTY_SUMMARY) };
  }
  async putSummary(email: string, s: AffiliateSummary) {
    this.summaries.set(sumKey(email), { ...s });
  }
  async bumpSummary(email: string, patch: Partial<Record<keyof AffiliateSummary, number>>) {
    const base = this.summaries.get(sumKey(email)) ?? EMPTY_SUMMARY;
    this.summaries.set(sumKey(email), applyDeltas(base, patch));
  }

  async getCommission(affEmail: string, id: string) {
    return this.commissions.get(comKey(affEmail, id)) ?? null;
  }
  async putCommissionIfAbsent(c: Commission) {
    const key = comKey(c.affiliateEmail, c.id);
    if (this.commissions.has(key)) return false;
    this.commissions.set(key, c);
    return true;
  }
  async putCommission(c: Commission) {
    this.commissions.set(comKey(c.affiliateEmail, c.id), c);
  }
  async listCommissions(affEmail: string) {
    const prefix = comPrefix(affEmail);
    return [...this.commissions.entries()]
      .filter(([k]) => k.startsWith(prefix))
      .map(([, c]) => c);
  }
  async listAllCommissions() {
    return [...this.commissions.values()];
  }
  async rememberCommissionOwner(paymentIntentId: string, affEmail: string) {
    this.owners.set(paymentIntentId, normalizeEmail(affEmail));
  }
  async commissionOwner(paymentIntentId: string) {
    return this.owners.get(paymentIntentId) ?? null;
  }

  async getInvite(code: string) {
    return this.invites.get(inviteKey(code)) ?? null;
  }
  async putInvite(c: InviteCode) {
    this.invites.set(inviteKey(c.code), c);
  }
  async listInvites() {
    return [...this.invites.values()];
  }
  async deleteInvite(code: string) {
    this.invites.delete(inviteKey(code));
  }

  async getPayout(id: string) {
    return this.payouts.get(payKey(id)) ?? null;
  }
  async putPayout(p: Payout) {
    this.payouts.set(payKey(p.id), p);
  }
  async listPayouts() {
    return [...this.payouts.values()];
  }
  async listPayoutsFor(email: string) {
    const wanted = normalizeEmail(email);
    return [...this.payouts.values()].filter((p) => normalizeEmail(p.affiliateEmail) === wanted);
  }

  async bumpClick(code: string) {
    const key = `${clickPrefix(code)}${today()}`;
    this.clicks.set(key, (this.clicks.get(key) ?? 0) + 1);
    const email = this.codes.get(codeKey(code));
    if (email) await this.bumpSummary(email, { clicks: 1 });
  }
  async clicksFor(code: string) {
    const prefix = clickPrefix(code);
    let sum = 0;
    for (const [k, n] of this.clicks) if (k.startsWith(prefix)) sum += n;
    return sum;
  }
}

/* ------------------------------------------------------------------- redis */

/**
 * Upstash-backed. Not configured today, kept exact so that setting two env
 * vars is the whole migration.
 *
 * Two things differ from the spreadsheet path. Listing uses SCAN with a
 * cursor loop and never KEYS — KEYS blocks the server for the length of the
 * keyspace, and the admin partner list would be the thing that stalls
 * everybody's checkout. And the summary is a HASH rather than a JSON blob, so
 * a counter moves with HINCRBY: two commissions booked in the same second
 * would lose one another under read-modify-write, and the lost one is money.
 */
class RedisAffiliateStore implements InternalStore {
  private async json<T>(key: string): Promise<T | null> {
    const raw = await kv("GET", key);
    if (typeof raw !== "string") return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      // A row nobody can parse is a row nobody can act on; treating it as
      // absent keeps one corrupt record from breaking a whole listing.
      return null;
    }
  }

  private async setJson(key: string, value: unknown, ttlMs?: number): Promise<void> {
    if (ttlMs && ttlMs > 0) {
      await kv("SET", key, JSON.stringify(value), "PX", String(Math.round(ttlMs)));
    } else {
      await kv("SET", key, JSON.stringify(value));
    }
  }

  /** Cursor loop, bounded: a runaway keyspace must not turn into an endless request. */
  private async keys(pattern: string): Promise<string[]> {
    const out: string[] = [];
    let cursor = "0";
    for (let round = 0; round < 200; round++) {
      const res = (await kv("SCAN", cursor, "MATCH", pattern, "COUNT", 500)) as
        | [string, string[]]
        | null;
      if (!Array.isArray(res)) break;
      cursor = String(res[0] ?? "0");
      if (Array.isArray(res[1])) out.push(...res[1].map(String));
      if (cursor === "0") break;
    }
    return out;
  }

  /** MGET in chunks so one listing cannot exceed the request size limit. */
  private async manyJson<T>(keys: string[]): Promise<T[]> {
    const out: T[] = [];
    for (let i = 0; i < keys.length; i += 100) {
      const slice = keys.slice(i, i + 100);
      const rows = (await kv("MGET", ...slice)) as unknown[];
      if (!Array.isArray(rows)) continue;
      for (const raw of rows) {
        if (typeof raw !== "string") continue;
        try {
          out.push(JSON.parse(raw) as T);
        } catch {
          /* see json(): one corrupt row must not lose the other nine hundred */
        }
      }
    }
    return out;
  }

  async getConfig() {
    const cached = cachedConfig();
    if (cached) return cached;
    return rememberConfig(normalizeConfig(await this.json<unknown>(CFG_KEY)));
  }
  async setConfig(cfg: AffiliateConfig) {
    await this.setJson(CFG_KEY, cfg);
    rememberConfig(cfg);
  }

  async getAffiliate(email: string) {
    return this.json<Affiliate>(affKey(email));
  }
  async putAffiliate(aff: Affiliate) {
    await this.setJson(affKey(aff.email), aff);
    // The index second: a partner without an index is invisible to links, a
    // link pointing at a partner who is not there yet is a redirect to a
    // ghost. The first failure is the recoverable one.
    await kv("SET", codeKey(aff.code), normalizeEmail(aff.email));
  }
  async listAffiliates() {
    return this.manyJson<Affiliate>(await this.keys("aff:*"));
  }
  async codeTaken(code: string) {
    return (await kv("EXISTS", codeKey(code))) === 1;
  }
  async affiliateByCode(code: string) {
    const email = await kv("GET", codeKey(code));
    return typeof email === "string" ? this.getAffiliate(email) : null;
  }

  async getBinding(customerEmail: string) {
    return this.json<Binding>(bindKey(customerEmail));
  }
  async putBinding(b: Binding) {
    await this.setJson(bindKey(b.customerEmail), b);
  }
  async deleteBinding(customerEmail: string) {
    await kv("DEL", bindKey(customerEmail));
  }
  async listBindings() {
    return this.manyJson<Binding>(await this.keys("affbind:*"));
  }

  async getSummary(email: string) {
    const rows = (await kv("HGETALL", sumKey(email))) as unknown[];
    if (!Array.isArray(rows) || rows.length === 0) return { ...EMPTY_SUMMARY };
    const flat: Record<string, number> = {};
    for (let i = 0; i + 1 < rows.length; i += 2) flat[String(rows[i])] = Number(rows[i + 1]);
    return coerceSummary(flat);
  }
  async putSummary(email: string, s: AffiliateSummary) {
    const key = sumKey(email);
    await kv(
      "HSET",
      key,
      "clicks", String(s.clicks),
      "signups", String(s.signups),
      "payingCustomers", String(s.payingCustomers),
      "revenueCents", String(s.revenueCents),
      "earnedCents", String(s.earnedCents),
      "paidCents", String(s.paidCents),
      "updatedAt", String(s.updatedAt),
    );
  }
  async bumpSummary(email: string, patch: Partial<Record<keyof AffiliateSummary, number>>) {
    const key = sumKey(email);
    for (const [field, by] of summaryDeltas(patch)) {
      await kv("HINCRBY", key, field, String(Math.round(by)));
    }
    // A single field of a hash, so this cannot undo a concurrent HINCRBY.
    await kv("HSET", key, "updatedAt", String(Date.now()));
  }

  async getCommission(affEmail: string, id: string) {
    return this.json<Commission>(comKey(affEmail, id));
  }
  async putCommissionIfAbsent(c: Commission) {
    // SET NX is the whole point: Stripe retries the same event, and two
    // deliveries landing on two instances at once must still book once.
    const res = await kv("SET", comKey(c.affiliateEmail, c.id), JSON.stringify(c), "NX");
    return res !== null;
  }
  async putCommission(c: Commission) {
    await this.setJson(comKey(c.affiliateEmail, c.id), c);
  }
  async listCommissions(affEmail: string) {
    return this.manyJson<Commission>(await this.keys(`${comPrefix(affEmail)}*`));
  }
  async listAllCommissions() {
    return this.manyJson<Commission>(await this.keys("affcom:*"));
  }
  async rememberCommissionOwner(paymentIntentId: string, affEmail: string) {
    await kv("SET", ownerKey(paymentIntentId), normalizeEmail(affEmail));
  }
  async commissionOwner(paymentIntentId: string) {
    const raw = await kv("GET", ownerKey(paymentIntentId));
    return typeof raw === "string" && raw ? raw : null;
  }

  async getInvite(code: string) {
    return this.json<InviteCode>(inviteKey(code));
  }
  async putInvite(c: InviteCode) {
    await this.setJson(inviteKey(c.code), c);
  }
  async listInvites() {
    return this.manyJson<InviteCode>(await this.keys("affinv:*"));
  }
  async deleteInvite(code: string) {
    await kv("DEL", inviteKey(code));
  }

  async getPayout(id: string) {
    return this.json<Payout>(payKey(id));
  }
  async putPayout(p: Payout) {
    await this.setJson(payKey(p.id), p);
  }
  async listPayouts() {
    return this.manyJson<Payout>(await this.keys("affpay:*"));
  }
  async listPayoutsFor(email: string) {
    const wanted = normalizeEmail(email);
    return (await this.listPayouts()).filter((p) => normalizeEmail(p.affiliateEmail) === wanted);
  }

  async bumpClick(code: string) {
    try {
      const key = `${clickPrefix(code)}${today()}`;
      await kv("INCR", key);
      await kv("PEXPIRE", key, String(CLICK_TTL_MS));
      const email = await kv("GET", codeKey(code));
      if (typeof email === "string") await this.bumpSummary(email, { clicks: 1 });
    } catch (err) {
      console.error("[affiliate] click counter failed", err);
    }
  }
  async clicksFor(code: string) {
    const keys = await this.keys(`${clickPrefix(code)}*`);
    let sum = 0;
    for (let i = 0; i < keys.length; i += 100) {
      const rows = (await kv("MGET", ...keys.slice(i, i + 100))) as unknown[];
      if (!Array.isArray(rows)) continue;
      for (const raw of rows) sum += Number(raw) || 0;
    }
    return sum;
  }
}

/* ------------------------------------------------------------------ sheets */

/**
 * Spreadsheet-backed — what production actually runs on.
 *
 * Reads go through `read()`, which mirrors the entitlement store: when the
 * backend is out of date or unreachable, answer from the memory floor rather
 * than throwing a dashboard away.
 *
 * Writes go through `write()`, which deliberately does NOT do that. The floor
 * is invisible to the next instance, so "saved" would be a lie — and the lie
 * is expensive here in a way it is not for a cached read: a commission that
 * was never stored looks exactly like a customer who never bought, and no
 * partner can notice money that never appeared. So a failed write throws and
 * the caller decides (the webhook logs and lets the sale through; a form
 * tells the human it did not save).
 */
class SheetsAffiliateStore implements InternalStore {
  private floor = new MemoryAffiliateStore();

  /**
   * A READ THAT FAILS THROWS. It does not answer "nothing".
   *
   * This was the opposite once, on the pattern lib/stripe/entitlements.ts uses:
   * fall back to an in-process floor so a spreadsheet hiccup cannot take the
   * site down. For affiliate data that trade is wrong, and in four different
   * ways that all look the same from outside:
   *
   *   - a partner's commissions read as an empty list  → "you earned nothing",
   *     and `recomputeSummary` would WRITE that emptiness back as the truth
   *   - their record reads as absent                   → the dashboard offers
   *     them the application form they already filled in
   *   - the open-payout list reads as empty            → a second payout for
   *     a balance that is already claimed
   *   - a binding reads as absent                      → the same customer
   *     counted twice towards the level ladder
   *
   * Every one of those is indistinguishable from the truth by anybody looking
   * at the screen, and two of them cost real money. An error is worse than a
   * fast answer and better than a confident wrong one, so the caller is told.
   */
  private async read<T>(remote: () => Promise<T>): Promise<T> {
    if (!sheetsKvHealthy()) {
      throw new Error("[affiliate] the spreadsheet backend is unavailable — cannot read.");
    }
    return await remote();
  }

  /**
   * For the two reads where an approximate answer is genuinely better than an
   * error: the configuration (the defaults are a documented, sane programme)
   * and the click counter (a decoration on a dashboard). Nothing that decides
   * what somebody is owed may use this.
   */
  private async readSoft<T>(remote: () => Promise<T>, local: () => Promise<T>): Promise<T> {
    if (!sheetsKvHealthy()) return local();
    try {
      return await remote();
    } catch {
      return local();
    }
  }

  private async write(remote: () => Promise<void>): Promise<void> {
    if (!sheetsKvHealthy()) {
      throw new Error(
        "[affiliate] the spreadsheet backend is unavailable — nothing was saved.",
      );
    }
    await remote();
  }

  async getConfig() {
    const cached = cachedConfig();
    if (cached) return cached;
    return this.readSoft(
      async () => rememberConfig(normalizeConfig(await skGetJson<unknown>(CFG_KEY))),
      // Not cached: the floor's answer is a guess about a value the backend
      () => this.floor.getConfig(),
    );
  }
  async setConfig(cfg: AffiliateConfig) {
    await this.write(() => skSetJson(CFG_KEY, cfg));
    await this.floor.setConfig(cfg);
    rememberConfig(cfg);
  }

  async getAffiliate(email: string) {
    return this.read(
      () => skGetJson<Affiliate>(affKey(email)),
    );
  }
  async putAffiliate(aff: Affiliate) {
    await this.write(async () => {
      await skSetJson(affKey(aff.email), aff);
      await skSetJson(codeKey(aff.code), normalizeEmail(aff.email));
    });
    await this.floor.putAffiliate(aff);
  }
  async listAffiliates() {
    return this.read(
      async () => parseRows<Affiliate>(await skScan("aff:")),
    );
  }
  async codeTaken(code: string) {
    // A read that decides whether a code may be handed out. If the backend
    // cannot answer, "not taken" is the dangerous guess — so let this one
    // throw and let newAffiliateCode() refuse rather than collide.
    return (await skGetJson<string>(codeKey(code))) !== null;
  }
  async affiliateByCode(code: string) {
    return this.read(
      async () => {
        const email = await skGetJson<string>(codeKey(code));
        return typeof email === "string" ? skGetJson<Affiliate>(affKey(email)) : null;
      },
    );
  }

  async getBinding(customerEmail: string) {
    return this.read(
      () => skGetJson<Binding>(bindKey(customerEmail)),
    );
  }
  async putBinding(b: Binding) {
    await this.write(() => skSetJson(bindKey(b.customerEmail), b));
    await this.floor.putBinding(b);
  }
  async deleteBinding(customerEmail: string) {
    await this.write(() => skDel(bindKey(customerEmail)));
    await this.floor.deleteBinding(customerEmail);
  }
  async listBindings() {
    return this.read(
      async () => parseRows<Binding>(await skScan("affbind:")),
    );
  }

  async getSummary(email: string) {
    return this.read(
      async () => coerceSummary(await skGetJson<unknown>(sumKey(email))),
    );
  }
  async putSummary(email: string, s: AffiliateSummary) {
    await this.write(() => skSetJson(sumKey(email), s));
    await this.floor.putSummary(email, s);
  }
  async bumpSummary(email: string, patch: Partial<Record<keyof AffiliateSummary, number>>) {
    const deltas = summaryDeltas(patch);
    if (deltas.length === 0) return;
    await this.write(async () => {
      const key = sumKey(email);
      for (const [field, by] of deltas) {
        // skBump is the only atomic operation the backend has: read and
        // write are one step under the script lock. Read-modify-write from
        // here would drop one of two commissions booked in the same second.
        const value = await skBump(key, field, by);
        if (value !== null) continue;
        // Null means the row does not exist yet. Materialise it with the
        // whole patch applied and stop — the remaining fields are in it.
        await skSetJson(key, applyDeltas(EMPTY_SUMMARY, patch));
        return;
      }
      // `updatedAt` is left where the last full write put it. Stamping it
      // would need a read-modify-write of the whole record, which is exactly
      // the lost-update the bumps above exist to avoid — and a stale
      // timestamp costs nothing, while a dropped counter costs a partner.
    });
    await this.floor.bumpSummary(email, patch);
  }

  async getCommission(affEmail: string, id: string) {
    return this.read(
      () => skGetJson<Commission>(comKey(affEmail, id)),
    );
  }
  async putCommissionIfAbsent(c: Commission) {
    const key = comKey(c.affiliateEmail, c.id);
    // Read-then-write, and NOT through read(): if the existence check cannot
    // be answered it must fail loudly. Answering "absent" from an empty
    // memory floor is how the same payment gets paid out twice.
    const existing = await skGetJson<Commission>(key);
    if (existing) return false;
    await this.write(() => skSetJson(key, c));
    await this.floor.putCommissionIfAbsent(c);
    return true;
  }
  async putCommission(c: Commission) {
    await this.write(() => skSetJson(comKey(c.affiliateEmail, c.id), c));
    await this.floor.putCommission(c);
  }
  async listCommissions(affEmail: string) {
    return this.read(
      async () => parseRows<Commission>(await skScan(comPrefix(affEmail))),
    );
  }
  async listAllCommissions() {
    return this.read(
      async () => parseRows<Commission>(await skScan("affcom:")),
    );
  }
  async rememberCommissionOwner(paymentIntentId: string, affEmail: string) {
    await this.write(() => skSetJson(ownerKey(paymentIntentId), normalizeEmail(affEmail)));
    await this.floor.rememberCommissionOwner(paymentIntentId, affEmail);
  }
  async commissionOwner(paymentIntentId: string) {
    return this.read(async () => (await skGetJson<string>(ownerKey(paymentIntentId))) ?? null);
  }

  async getInvite(code: string) {
    return this.read(
      () => skGetJson<InviteCode>(inviteKey(code)),
    );
  }
  async putInvite(c: InviteCode) {
    await this.write(() => skSetJson(inviteKey(c.code), c));
    await this.floor.putInvite(c);
  }
  async listInvites() {
    return this.read(
      async () => parseRows<InviteCode>(await skScan("affinv:")),
    );
  }
  async deleteInvite(code: string) {
    await this.write(() => skDel(inviteKey(code)));
    await this.floor.deleteInvite(code);
  }

  async getPayout(id: string) {
    return this.read(
      () => skGetJson<Payout>(payKey(id)),
    );
  }
  async putPayout(p: Payout) {
    await this.write(() => skSetJson(payKey(p.id), p));
    await this.floor.putPayout(p);
  }
  async listPayouts() {
    return this.read(
      async () => parseRows<Payout>(await skScan("affpay:")),
    );
  }
  async listPayoutsFor(email: string) {
    const wanted = normalizeEmail(email);
    return (await this.listPayouts()).filter((p) => normalizeEmail(p.affiliateEmail) === wanted);
  }

  async bumpClick(code: string) {
    // THE ONE WRITE THAT SWALLOWS ITS ERRORS. This runs inside the /r
    // redirect: a partner's link must still open when the spreadsheet is
    // slow, and the number it failed to increment is a statistic nobody
    // is owed. Everything that touches money throws instead.
    try {
      const key = `${clickPrefix(code)}${today()}`;
      const value = await skBump(key, "n", 1);
      if (value === null) await skSetJson(key, { n: 1 }, CLICK_TTL_MS);
      const email = await skGetJson<string>(codeKey(code));
      if (typeof email === "string") {
        // Straight to skBump: bumpSummary() throws by design, and this path
        // must not.
        const bumped = await skBump(sumKey(email), "clicks", 1);
        if (bumped === null) await skSetJson(sumKey(email), applyDeltas(EMPTY_SUMMARY, { clicks: 1 }));
      }
    } catch (err) {
      console.error("[affiliate] click counter failed", err);
    }
    await this.floor.bumpClick(code);
  }
  async clicksFor(code: string) {
    return this.readSoft(
      async () => {
        const rows = await skScan(clickPrefix(code));
        let sum = 0;
        for (const row of rows) {
          try {
            sum += Number((JSON.parse(row.value) as { n?: unknown }).n) || 0;
          } catch {
            /* a corrupt day is a missing day, not a broken chart */
          }
        }
        return sum;
      },
      () => this.floor.clicksFor(code),
    );
  }
}

/** skScan hands back raw rows; one unparsable row must not lose the rest. */
function parseRows<T>(rows: Array<{ key: string; value: string }>): T[] {
  const out: T[] = [];
  for (const row of rows) {
    try {
      out.push(JSON.parse(row.value) as T);
    } catch {
      /* ignore */
    }
  }
  return out;
}

/* ------------------------------------------------------------- the instance */

declare global {
  // eslint-disable-next-line no-var
  var __facescanAffiliateStore: InternalStore | undefined;
}

const store: InternalStore =
  globalThis.__facescanAffiliateStore ??
  (globalThis.__facescanAffiliateStore = kvConfigured()
    ? new RedisAffiliateStore()
    : sheetsKvConfigured()
      ? new SheetsAffiliateStore()
      : new MemoryAffiliateStore());

export const affiliateStore: AffiliateStore = store;

/** Which backing is live. Shown to the admin, never used to gate a customer. */
export const affiliateBacking = (): "redis" | "sheets" | "memory" =>
  kvConfigured() ? "redis" : sheetsKvConfigured() ? "sheets" : "memory";

/**
 * May the programme promise anybody money?
 *
 * Only when the record of it outlives the process. On the memory floor a
 * partner would watch their earnings reset at every deploy, so the partner
 * page says so plainly instead of showing a balance it cannot keep.
 */
export const affiliatePersistent = (): boolean => affiliateBacking() !== "memory";

/** Enough entropy at 32 symbols: 6 chars is a billion, 8 is a trillion. */
const CODE_ATTEMPTS = 5;

async function uniqueCode(
  length: number,
  taken: (code: string) => Promise<boolean>,
  what: string,
): Promise<string> {
  for (let i = 0; i < CODE_ATTEMPTS; i++) {
    const code = randomCode(length);
    // A code that already belongs to someone would send their clicks to the
    // wrong partner, so a store that cannot answer must stop the sign-up
    // rather than guess — `taken` is allowed to throw and we let it.
    if (!(await taken(code))) return code;
  }
  throw new Error(`Could not find a free ${what} in ${CODE_ATTEMPTS} attempts.`);
}

/** Six characters: short enough to read off a poster, a billion combinations deep. */
export async function newAffiliateCode(): Promise<string> {
  return uniqueCode(6, (code) => store.codeTaken(code), "affiliate code");
}

/** Eight, because invite codes are pasted, not spoken, and are handed out in bulk. */
export async function newInviteCode(): Promise<string> {
  return uniqueCode(8, async (code) => (await store.getInvite(code)) !== null, "invite code");
}
