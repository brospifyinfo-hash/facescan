import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { products, productBacking, isReadOnlyBacking } from "@/lib/products/store";
import { SHEET_COLUMNS } from "@/lib/products/sheet-csv";
import { blobConfigured } from "@/lib/blob";
import { validateProduct } from "@/lib/products/types";

export const runtime = "nodejs";

// The catalogue editor's API.
//
// EVERY handler re-checks isAdmin(). The admin page also checks, but that
// only decides whether a form is drawn; these are the routes anyone can POST
// to with curl, so this is the check that actually matters.
//
// 401 for "not an admin": the caller has no valid admin cookie, which is
// fixed by entering the code. Nothing here reveals anything about the code.

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // The admin list includes inactive products; the public one does not.
  //
  // A Sheets backend that is misconfigured or slow throws, and the admin is
  // the one person who can fix it — so the reason is passed through rather
  // than collapsing into an empty list that looks like "no products yet".
  try {
    const backing = productBacking();
    return NextResponse.json({
      products: await products.list(),
      backing,
      readOnly: isReadOnlyBacking(backing),
      // Decides whether the image field is a file picker or a URL box.
      uploads: blobConfigured(),
      // Only meaningful in the read-only mode, where the admin has to go to
      // the spreadsheet to change anything.
      sheetUrl: process.env.SHEETS_ID
        ? `https://docs.google.com/spreadsheets/d/${process.env.SHEETS_ID}/edit`
        : null,
      columns: SHEET_COLUMNS,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "backend_unavailable",
        backing: productBacking(),
        details: [err instanceof Error ? err.message : "unknown error"],
      },
      { status: 502 },
    );
  }
}

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const result = validateProduct(body);
  if (!result.ok || !result.value) {
    return NextResponse.json({ error: "invalid", details: result.errors }, { status: 400 });
  }

  return NextResponse.json({ product: await products.create(result.value) }, { status: 201 });
}
