// The catalogue, stored in a Google Sheet.
//
// Reads and writes both go through the Apps Script deployed on the
// spreadsheet (scripts/sheets-backend.gs). The obvious alternative for reads
// is the public CSV export, which is faster and needs no credential — but it
// is served from Google's cache, so an admin who adds a product and reloads
// can be shown the old list. One path, one consistency story.
//
// WHAT A SPREADSHEET IS AND IS NOT
// --------------------------------
// It is a database you can open on your phone and edit by hand, which is
// exactly why it was chosen here. It is not fast (a warm Apps Script call is
// a few hundred milliseconds, a cold one seconds) and it has no transactions.
// Both are survivable for this: the public catalogue is cached at the edge,
// the admin list is a handful of rows, and the script takes a lock so two
// tabs saving at once cannot overwrite each other.
//
// A request that fails must not silently produce an empty catalogue — the
// recommendation block would just vanish from a paid report with nothing
// logged. Reads therefore throw, and the caller decides.

import { randomUUID } from "crypto";
import type { Product, ProductInput } from "./types";
import { isProblemTag } from "./types";
import type { ProductStore } from "./store";

export const sheetsConfigured = (): boolean =>
  Boolean(process.env.SHEETS_URL && process.env.SHEETS_TOKEN);

function config(): { url: string; token: string } {
  const url = process.env.SHEETS_URL;
  const token = process.env.SHEETS_TOKEN;
  if (!url || !token) throw new Error("SHEETS_URL or SHEETS_TOKEN is missing.");
  return { url, token };
}

/** Apps Script is slow enough to need a real timeout, and slow enough that
 *  10s is not paranoid — a cold start genuinely takes seconds. */
const TIMEOUT_MS = 10_000;

async function call<T>(init: RequestInit & { query?: string }): Promise<T> {
  const { url, token } = config();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${url}${init.query ?? ""}`, {
      ...init,
      // A web app deployed for "Anyone" answers with a 302 to a
      // googleusercontent URL; without following it every call returns the
      // redirect page instead of the payload.
      redirect: "follow",
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Sheets backend returned ${res.status}.`);
    const data = (await res.json()) as T & { error?: string };
    if (data?.error) throw new Error(`Sheets backend: ${data.error}`);
    return data;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Sheets backend timed out.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * A row is hand-editable, so it is untrusted input in a way a row this app
 * wrote itself is not. Anything unparseable is normalised rather than
 * allowed to reach the UI as undefined.
 */
function reviveProduct(raw: unknown): Product | null {
  const p = raw as Partial<Product> | null;
  if (!p || typeof p.id !== "string" || p.id.length === 0) return null;
  if (typeof p.title !== "string" || p.title.trim().length === 0) return null;
  return {
    id: p.id,
    title: p.title,
    description: typeof p.description === "string" ? p.description : "",
    imageUrl: typeof p.imageUrl === "string" ? p.imageUrl : "",
    affiliateLink: typeof p.affiliateLink === "string" ? p.affiliateLink : "",
    // A tag typed into the sheet that is not in the vocabulary is dropped —
    // it can never match anything, and keeping it would make the admin UI
    // show a checkbox state the matcher does not agree with.
    tags: Array.isArray(p.tags) ? p.tags.filter(isProblemTag) : [],
    active: p.active !== false,
    createdAt: typeof p.createdAt === "number" ? p.createdAt : 0,
    updatedAt: typeof p.updatedAt === "number" ? p.updatedAt : 0,
  };
}

const byNewest = (a: Product, b: Product) =>
  b.createdAt - a.createdAt || a.id.localeCompare(b.id);

/**
 * Force a value into the sheet as literal text.
 *
 * Sheets parses what it is given, and it is good at it: a title of "1,5" in
 * a German-locale sheet is stored as the NUMBER 1.5, and a description
 * beginning with "=" is stored as a formula. Neither survives the round trip
 * as typed.
 *
 * A leading apostrophe is the spreadsheet convention for "this is text". It
 * is a formatting directive, not part of the value, so it does not come back
 * on read — verified against the live sheet, where "'24,90 €" round-trips
 * intact and the bare form does not.
 *
 * Applied to every string field rather than just the price: a title like
 * "1,5" or a description starting with "=" has the same problem, and the
 * guard costs nothing where it is not needed.
 */
const asText = (v: string): string => (v.length > 0 ? `'${v}` : v);

function toSheetProduct(p: Product) {
  return {
    ...p,
    id: asText(p.id),
    title: asText(p.title),
    description: asText(p.description),
    imageUrl: asText(p.imageUrl),
    affiliateLink: asText(p.affiliateLink),
  };
}

export class SheetsProductStore implements ProductStore {
  async list(): Promise<Product[]> {
    const { token } = config();
    const data = await call<{ products: unknown[] }>({
      method: "GET",
      query: `?token=${encodeURIComponent(token)}&action=list`,
    });
    return (data.products ?? [])
      .map(reviveProduct)
      .filter((p): p is Product => p !== null)
      .sort(byNewest);
  }

  async get(id: string): Promise<Product | null> {
    // No per-row endpoint: the sheet is small and one round trip beats
    // teaching the script a second lookup that would read the same range.
    return (await this.list()).find((p) => p.id === id) ?? null;
  }

  async create(input: ProductInput): Promise<Product> {
    const { token } = config();
    const now = Date.now();
    const product: Product = { ...input, id: randomUUID(), createdAt: now, updatedAt: now };
    await call({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, action: "create", product: toSheetProduct(product) }),
    });
    return product;
  }

  async update(id: string, input: ProductInput): Promise<Product | null> {
    const { token } = config();
    const existing = await this.get(id);
    if (!existing) return null;
    const next: Product = { ...existing, ...input, updatedAt: Date.now() };
    await call({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, action: "update", product: toSheetProduct(next) }),
    });
    return next;
  }

  async remove(id: string): Promise<boolean> {
    const { token } = config();
    try {
      await call({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action: "delete", id }),
      });
      return true;
    } catch (err) {
      // The script answers not_found for an id that is not in the sheet.
      // That is a 404 for the caller, not a failure of the backend.
      if (err instanceof Error && err.message.includes("not_found")) return false;
      throw err;
    }
  }
}
