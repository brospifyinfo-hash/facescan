// The product catalogue.
//
// TWO BACKINGS, CHOSEN BY THE ENVIRONMENT — the same arrangement as the OTP
// and entitlement stores, for the same reason: an app that is half-configured
// is worse than one that is not configured at all. `kvConfigured()` is the
// only switch.
//
// The memory backing is fine here in a way it is NOT for entitlements. A lost
// entitlement means a customer paid and got nothing; a lost product means the
// catalogue is empty until it is re-entered, which is visible immediately and
// costs nobody money. It still means: without Upstash, anything added in the
// admin UI disappears on the next cold start. The admin page says so rather
// than letting someone type in forty products and lose them.
//
// KEY LAYOUT
//   product:<id>     JSON Product, no TTL
//   products:index   SET of ids, so listing does not need SCAN
//
// The index and the records can in principle disagree — a crash between the
// two writes leaves an id in the index with no record behind it. list()
// therefore drops ids that resolve to nothing instead of trusting the index,
// and remove() deletes the record first so the reverse can never happen.

import { randomUUID } from "crypto";
import { kv, kvPipeline, kvConfigured } from "@/lib/kv";
import type { Product, ProductInput } from "./types";
import { isProblemTag } from "./types";
import { SheetsProductStore, sheetsConfigured } from "./sheets";

export interface ProductStore {
  list(): Promise<Product[]>;
  get(id: string): Promise<Product | null>;
  create(input: ProductInput): Promise<Product>;
  update(id: string, input: ProductInput): Promise<Product | null>;
  remove(id: string): Promise<boolean>;
}

const INDEX = "products:index";
const key = (id: string) => `product:${id}`;

/** Newest first, and stable: two products created in the same millisecond
 *  still get a deterministic order rather than whatever the store returns. */
const byNewest = (a: Product, b: Product) =>
  b.createdAt - a.createdAt || a.id.localeCompare(b.id);

/**
 * A record read back from storage is untrusted input — it may predate a
 * change to the tag vocabulary, or have been written by an older deploy.
 * Anything that does not parse into the current shape is dropped rather than
 * handed to the UI to crash on.
 */
function reviveProduct(raw: unknown): Product | null {
  if (typeof raw !== "string") return null;
  try {
    const p = JSON.parse(raw) as Partial<Product>;
    if (typeof p.id !== "string" || typeof p.title !== "string") return null;
    return {
      id: p.id,
      title: p.title,
      description: typeof p.description === "string" ? p.description : "",
      price: typeof p.price === "string" ? p.price : "",
      imageUrl: typeof p.imageUrl === "string" ? p.imageUrl : "",
      affiliateLink: typeof p.affiliateLink === "string" ? p.affiliateLink : "",
      // Tags retired from the vocabulary are dropped, not kept as dead
      // strings that can never match anything.
      tags: Array.isArray(p.tags) ? p.tags.filter(isProblemTag) : [],
      active: p.active !== false,
      createdAt: typeof p.createdAt === "number" ? p.createdAt : 0,
      updatedAt: typeof p.updatedAt === "number" ? p.updatedAt : 0,
    };
  } catch {
    return null;
  }
}

class MemoryProductStore implements ProductStore {
  private items = new Map<string, Product>();

  async list() {
    return [...this.items.values()].sort(byNewest);
  }
  async get(id: string) {
    return this.items.get(id) ?? null;
  }
  async create(input: ProductInput) {
    const now = Date.now();
    const product: Product = { ...input, id: randomUUID(), createdAt: now, updatedAt: now };
    this.items.set(product.id, product);
    return product;
  }
  async update(id: string, input: ProductInput) {
    const existing = this.items.get(id);
    if (!existing) return null;
    const next: Product = { ...existing, ...input, updatedAt: Date.now() };
    this.items.set(id, next);
    return next;
  }
  async remove(id: string) {
    return this.items.delete(id);
  }
}

class RedisProductStore implements ProductStore {
  async list() {
    const ids = await kv("SMEMBERS", INDEX);
    if (!Array.isArray(ids) || ids.length === 0) return [];
    const rows = await kvPipeline(...ids.map((id) => ["GET", key(String(id))]));
    return rows
      .map(reviveProduct)
      .filter((p): p is Product => p !== null)
      .sort(byNewest);
  }

  async get(id: string) {
    return reviveProduct(await kv("GET", key(id)));
  }

  async create(input: ProductInput) {
    const now = Date.now();
    const product: Product = { ...input, id: randomUUID(), createdAt: now, updatedAt: now };
    // Record before index: an index entry with no record behind it is the
    // failure list() has to defend against, so do not create one.
    await kv("SET", key(product.id), JSON.stringify(product));
    await kv("SADD", INDEX, product.id);
    return product;
  }

  async update(id: string, input: ProductInput) {
    const existing = await this.get(id);
    if (!existing) return null;
    const next: Product = { ...existing, ...input, updatedAt: Date.now() };
    await kv("SET", key(id), JSON.stringify(next));
    return next;
  }

  async remove(id: string) {
    const existed = (await kv("EXISTS", key(id))) === 1;
    // Record first, then the index — the opposite order would leave an
    // orphaned record that nothing lists and nothing can delete.
    await kv("DEL", key(id));
    await kv("SREM", INDEX, id);
    return existed;
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __facescanProducts: ProductStore | undefined;
}

export type ProductBacking = "sheets" | "redis" | "memory";

/**
 * Which backing is live.
 *
 * Sheets wins when configured, because it is the one an owner picked
 * deliberately — Redis is the general-purpose store the rest of the app
 * uses, and memory is the "nothing is set up" case. Order is preference,
 * not fallback: a configured Sheets backend that is failing throws rather
 * than quietly serving an empty catalogue from somewhere else.
 */
export const productBacking = (): ProductBacking =>
  sheetsConfigured() ? "sheets" : kvConfigured() ? "redis" : "memory";

function makeStore(): ProductStore {
  switch (productBacking()) {
    case "sheets":
      return new SheetsProductStore();
    case "redis":
      return new RedisProductStore();
    default:
      return new MemoryProductStore();
  }
}

export const products: ProductStore =
  globalThis.__facescanProducts ?? (globalThis.__facescanProducts = makeStore());
