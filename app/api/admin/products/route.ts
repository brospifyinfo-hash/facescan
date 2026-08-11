import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { products, productBacking } from "@/lib/products/store";
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
  return NextResponse.json({
    products: await products.list(),
    backing: productBacking(),
  });
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
