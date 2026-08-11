import { NextResponse } from "next/server";
import { products } from "@/lib/products/store";

export const runtime = "nodejs";

/**
 * The active catalogue.
 *
 * THIS ENDPOINT SERVES PRODUCTS, IT DOES NOT PERFORM THE MATCH — and that is
 * a privacy decision, not a shortcut.
 *
 * Matching needs the user's problems: their weak measurements and their quiz
 * answers. Sending those here to have the server rank products would mean the
 * scan leaves the browser, which is the one thing this product promises it
 * never does on the free path and has built its whole architecture around.
 * The catalogue is public marketing data and the ranking is a pure function,
 * so the honest split is: the server ships the catalogue, the browser ranks
 * it against a scan that never moves. See lib/products/match.ts.
 *
 * It is deliberately NOT gated on the entitlement. A product list with public
 * affiliate URLs in it is not the paid artefact — the personalised ranking
 * is, and that is computed from data only the buyer's own browser holds.
 * Gating it would add a session round trip to protect nothing, and would
 * break the owner's access-code preview of the paid view.
 */
export async function GET() {
  const all = await products.list();
  return NextResponse.json(
    { products: all.filter((p) => p.active) },
    {
      headers: {
        // Short, because an admin who adds a product expects to see it. Long
        // enough that the report page does not hit the store on every load.
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600",
      },
    },
  );
}
