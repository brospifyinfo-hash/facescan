// Scan history, stored in the same spreadsheet as the catalogue.
//
// A second tab on the same document and the same Apps Script deployment, so
// there is one credential and one thing to keep alive rather than two.
//
// WHAT GOES IN, AND WHAT DOES NOT. The reading — headline, band, the five
// composites — and the address it belongs to. Never a photograph: the
// analyser still runs entirely in the browser and no image is transmitted, so
// the promise on the landing page is untouched by this.
//
// ⚠️ It does mean customer email addresses sit in a Google Sheet alongside a
// facial score. That is personal data under the GDPR: it needs to be named in
// the privacy policy, and a deletion request has to be answerable by removing
// the rows. Worth deciding deliberately rather than discovering later.

import type { HistoryEntry, HistoryInput, HistoryStore } from "./store";

export const historySheetConfigured = (): boolean =>
  Boolean(process.env.SHEETS_URL && process.env.SHEETS_TOKEN);

function config(): { url: string; token: string } {
  const url = process.env.SHEETS_URL;
  const token = process.env.SHEETS_TOKEN;
  if (!url || !token) throw new Error("SHEETS_URL or SHEETS_TOKEN is missing.");
  return { url, token };
}

const TIMEOUT_MS = 10_000;

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...init,
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

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);

function revive(raw: unknown): HistoryEntry | null {
  const e = raw as Partial<HistoryEntry> | null;
  if (!e || typeof e.id !== "string" || e.id.length === 0) return null;
  return {
    id: e.id,
    at: num(e.at),
    overall: num(e.overall),
    band: typeof e.band === "string" ? e.band : "",
    symmetry: num(e.symmetry),
    eyesScore: num(e.eyesScore),
    jawScore: num(e.jawScore),
    proportionsScore: num(e.proportionsScore),
    midfaceScore: num(e.midfaceScore),
    source: e.source === "vision" ? "vision" : "geometry",
    potential: typeof e.potential === "number" && Number.isFinite(e.potential) ? e.potential : null,
  };
}

export class SheetsHistoryStore implements HistoryStore {
  async list(email: string): Promise<HistoryEntry[]> {
    const { url, token } = config();
    const data = await call<{ scans?: unknown[] }>(
      `${url}?token=${encodeURIComponent(token)}&action=scans&email=${encodeURIComponent(email)}`,
    );
    // THE RESPONSE MUST CARRY A `scans` FIELD. An out-of-date Apps Script
    // answers a GET with its DEFAULT branch — the product catalogue — which
    // parses fine and would read here as an empty history. Same guard, same
    // reason as skGet() in lib/sheets-kv.ts.
    if (!("scans" in data)) {
      throw new Error(
        "Sheets backend: action=scans is unsupported — the deployed Apps Script is out of date.",
      );
    }
    return (data.scans ?? [])
      .map(revive)
      .filter((e): e is HistoryEntry => e !== null)
      .sort((a, b) => b.at - a.at);
  }

  async add(email: string, input: HistoryInput): Promise<HistoryEntry> {
    const { url, token } = config();
    const entry: HistoryEntry = { ...input, id: crypto.randomUUID(), at: Date.now() };
    await call(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // The numbers are written as numbers; only the two free-text fields get
      // the apostrophe that stops Sheets reinterpreting them. See the note in
      // lib/products/sheets.ts for why that guard exists at all.
      body: JSON.stringify({
        token,
        action: "scan-add",
        email: `'${email}`,
        entry: { ...entry, id: `'${entry.id}`, band: `'${entry.band}` },
      }),
    });
    return entry;
  }
}
