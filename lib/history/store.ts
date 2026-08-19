// The customer's scan history.
//
// WHAT IS STORED, AND WHAT IS DELIBERATELY NOT
// --------------------------------------------
// The landing page makes a specific promise: photos are never uploaded, the
// scan runs in the browser, the session clears itself. That promise is about
// PHOTOS and it stays true — nothing here ever touches an image, and the
// analyser still runs entirely on the device.
//
// What is stored is the RESULT: the headline, the category scores, the
// measurement values. That is the thing a paying customer bought and has an
// obvious right to see again next month, and it is the only way a history
// can exist at all once the browser session is gone.
//
// So the rule is: a scan is written only for a SIGNED-IN address. Creating an
// account and proving an inbox is the consent; a visitor who never signs in
// never has a row here, which keeps the free scan exactly as private as it is
// advertised to be. Requiring a purchase on top of that was the earlier rule,
// and it meant nothing was ever stored at all while Stripe was unconfigured.
//
// KEY LAYOUT
//   scans:<email>   LIST of JSON HistoryEntry, newest first, capped

import { randomUUID } from "crypto";
import { kv, kvConfigured } from "@/lib/kv";
import { SheetsHistoryStore, historySheetConfigured } from "./sheets";

/** A summary, not the full report. No photos, ever. */
export interface HistoryEntry {
  id: string;
  at: number;
  /** 0–10 headline. */
  overall: number;
  /** Band id, so the label can be translated at read time. */
  band: string;
  symmetry: number;
  eyesScore: number;
  jawScore: number;
  proportionsScore: number;
  midfaceScore: number;
  /** Which engine produced it — the two are on different scales. */
  source: "geometry" | "vision";
  /**
   * The derived potential, 0–10, when it could be computed.
   *
   * OPTIONAL ON PURPOSE. It arrived after the scans tab already existed, so a
   * spreadsheet whose Apps Script predates the column simply drops it and
   * every older row has none. The home page shows the stat only when there is
   * something to show, which is the same rule the rest of this product
   * follows: an unknown number is left out rather than guessed at.
   */
  potential?: number | null;
  /**
   * The full measurement set — every dial the scan produced, so an old scan
   * can be opened again in the account with all of its readings, not just
   * the headline. Same optionality story as `potential`: rows written before
   * the column existed (or through an older Apps Script) simply have none,
   * and the account renders the summary alone for those.
   *
   * NO PHOTOS AND NO RAW GEOMETRY — ids, scores and the display strings, the
   * same numbers the customer already saw on screen.
   */
  detail?: ScanDetailPoint[] | null;
}

export interface ScanDetailPoint {
  id: string;
  /** 0–100, as on the dial. */
  score: number;
  /** The rendered value ("1.92", "+3.4°") — locale-independent. */
  display: string;
}

export type HistoryInput = Omit<HistoryEntry, "id" | "at">;

export interface HistoryStore {
  list(email: string): Promise<HistoryEntry[]>;
  add(email: string, entry: HistoryInput): Promise<HistoryEntry>;
}

const MAX = 60;
const key = (email: string) => `scans:${email}`;

function revive(raw: unknown): HistoryEntry | null {
  try {
    const e = JSON.parse(String(raw)) as HistoryEntry;
    return typeof e?.id === "string" && typeof e.overall === "number" ? e : null;
  } catch {
    return null;
  }
}

class MemoryHistoryStore implements HistoryStore {
  private byEmail = new Map<string, HistoryEntry[]>();

  async list(email: string) {
    return this.byEmail.get(email) ?? [];
  }
  async add(email: string, input: HistoryInput) {
    const entry: HistoryEntry = { ...input, id: randomUUID(), at: Date.now() };
    const list = this.byEmail.get(email) ?? [];
    this.byEmail.set(email, [entry, ...list].slice(0, MAX));
    return entry;
  }
}

class RedisHistoryStore implements HistoryStore {
  async list(email: string) {
    const rows = await kv("LRANGE", key(email), "0", String(MAX - 1));
    if (!Array.isArray(rows)) return [];
    return rows.map(revive).filter((e): e is HistoryEntry => e !== null);
  }

  async add(email: string, input: HistoryInput) {
    const entry: HistoryEntry = { ...input, id: randomUUID(), at: Date.now() };
    await kv("LPUSH", key(email), JSON.stringify(entry));
    await kv("LTRIM", key(email), "0", String(MAX - 1));
    return entry;
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __facescanHistory: HistoryStore | undefined;
}

/**
 * Same preference order as the product store: the spreadsheet when it is
 * configured, then Redis, then memory. One place to look when a history is
 * empty and nobody knows where it should have gone.
 */
export const historyBacking = (): "sheets" | "redis" | "memory" =>
  historySheetConfigured() ? "sheets" : kvConfigured() ? "redis" : "memory";

function makeHistoryStore(): HistoryStore {
  switch (historyBacking()) {
    case "sheets":
      return new SheetsHistoryStore();
    case "redis":
      return new RedisHistoryStore();
    default:
      return new MemoryHistoryStore();
  }
}

export const history: HistoryStore =
  globalThis.__facescanHistory ?? (globalThis.__facescanHistory = makeHistoryStore());
