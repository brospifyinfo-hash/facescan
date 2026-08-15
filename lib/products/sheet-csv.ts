// Reading the catalogue straight out of a shared Google Sheet.
//
// NO CREDENTIALS AT ALL. A spreadsheet shared as "anyone with the link can
// view" exposes a CSV export, and that is the entire mechanism here. It means
// the catalogue works the moment the sheet has rows in it — no Cloud project,
// no service account, no script to deploy, nothing to paste into Vercel
// except the document id, which is not a secret.
//
// The trade is that it is READ ONLY. Google offers no unauthenticated write,
// for the obvious reason. So in this mode products are added by typing a row
// into the sheet, and the admin page becomes a viewer that says so.
// Configuring the Apps Script backend (lib/products/sheets.ts) upgrades the
// same page back into an editor.
//
// The export is served from Google's cache, so an edit can take a moment to
// appear. That is acceptable when the person editing is looking at the
// spreadsheet — it is exactly the reason the writable backend does NOT use
// this path, where the same lag would look like a failed save.

import type { Product } from "./types";
import { isProblemTag } from "./types";

export const sheetIdConfigured = (): boolean =>
  typeof process.env.SHEETS_ID === "string" && process.env.SHEETS_ID.length > 0;

/**
 * Canonical column order, used when the sheet carries no header row.
 *
 * "price" is still listed although no product carries one any more. The
 * column exists in sheets that were created earlier, and dropping it here
 * would shift every field after it by one for anyone reading such a sheet
 * positionally. It is parsed and discarded.
 */
export const SHEET_COLUMNS = [
  "id",
  "title",
  "description",
  "price",
  "imageUrl",
  "affiliateLink",
  "tags",
  "active",
] as const;

/**
 * A real CSV reader, not `split(",")`.
 *
 * Every field this sheet holds can legitimately contain a comma — a product
 * description, a price like "1.299,00 €", an affiliate URL with query
 * parameters, and the tag list by definition. Splitting on commas would
 * silently shred exactly the rows a catalogue is made of.
 */
export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  // Normalise line endings first so a CRLF file does not leave \r on values.
  const text = input.replace(/\r\n?/g, "\n");

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (quoted) {
      if (c === '"') {
        // A doubled quote inside a quoted field is a literal quote.
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }

  // Whatever is left after the last newline is a row too, unless it is empty.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim().length > 0));
}

/** Map a header row to column indices, tolerating case and spacing. */
function headerIndex(header: string[]): Record<string, number> | null {
  const norm = header.map((h) => h.trim().toLowerCase().replace(/[\s_-]/g, ""));
  const wanted = SHEET_COLUMNS.map((c) => c.toLowerCase());
  // A header row is one that names at least the two fields without which a
  // product is not a product.
  if (!norm.includes("title") || !norm.includes("affiliatelink")) return null;

  const out: Record<string, number> = {};
  for (const col of wanted) {
    const at = norm.indexOf(col);
    if (at >= 0) out[col] = at;
  }
  return out;
}

const truthy = (v: string) => {
  const s = v.trim().toLowerCase();
  return !(s === "false" || s === "nein" || s === "no" || s === "0");
};

/**
 * Rows → products.
 *
 * Anything unusable is skipped rather than repaired into a half-product: a
 * row with no title or no link cannot be shown or clicked, and inventing a
 * placeholder would put a broken card in a paid report.
 */
export function productsFromRows(rows: string[][]): Product[] {
  if (rows.length === 0) return [];

  const idx = headerIndex(rows[0]);
  const body = idx ? rows.slice(1) : rows;
  const at = (row: string[], col: (typeof SHEET_COLUMNS)[number]) => {
    const i = idx ? idx[col.toLowerCase()] : SHEET_COLUMNS.indexOf(col);
    return i === undefined || i < 0 ? "" : (row[i] ?? "").trim();
  };

  const out: Product[] = [];
  body.forEach((row, n) => {
    const title = at(row, "title");
    const affiliateLink = at(row, "affiliateLink");
    if (!title || !affiliateLink) return;

    const tags = at(row, "tags")
      .split(/[,;|]/)
      .map((t) => t.trim())
      .filter(isProblemTag);
    // No usable tag means it can never match a scan, so it would sit in the
    // sheet looking configured while never appearing anywhere.
    if (tags.length === 0) return;

    // The id column is optional — a hand-kept sheet should not force anyone
    // to invent UUIDs. Falling back to the row position keeps it stable for
    // as long as the row stays put, which is all React needs for a key.
    const id = at(row, "id") || `row-${n + 1}`;

    out.push({
      id,
      title,
      description: at(row, "description"),
      imageUrl: at(row, "imageUrl"),
      affiliateLink,
      tags,
      active: truthy(at(row, "active") || "true"),
      // Sheet order is the owner's order; there are no timestamps to sort by.
      createdAt: n,
      updatedAt: n,
    });
  });

  return out;
}

/** Fetch and parse the shared sheet. Throws — an empty catalogue must not be
 *  indistinguishable from a network failure. */
export async function fetchSheetProducts(): Promise<Product[]> {
  const id = process.env.SHEETS_ID;
  if (!id) throw new Error("SHEETS_ID is not set.");

  const url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(id)}/export?format=csv`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      // Google caches this anyway; the edge cache on /api/products is what
      // actually keeps the load off it.
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(
        res.status === 404
          ? "Sheet not found, or not shared as 'anyone with the link can view'."
          : `Google returned ${res.status}.`,
      );
    }
    const text = await res.text();
    // A sheet that is not shared publicly answers with a sign-in page.
    if (text.trimStart().toLowerCase().startsWith("<!doctype html")) {
      throw new Error("Sheet is not publicly readable — share it as 'anyone with the link'.");
    }
    return productsFromRows(parseCsv(text));
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Google Sheets timed out.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
