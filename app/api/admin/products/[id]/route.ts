import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/admin";
import { products } from "@/lib/products/store";
import { validateProduct } from "@/lib/products/types";

export const runtime = "nodejs";

/** Next 15 hands route params in as a promise. */
type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: Request, ctx: Ctx) {
  if (!(await currentAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  // A full replace, validated exactly as a create is. Accepting a partial
  // patch would mean a form that forgot a field could silently blank it while
  // still passing "required" checks the payload never carried.
  const result = validateProduct(body);
  if (!result.ok || !result.value) {
    return NextResponse.json({ error: "invalid", details: result.errors }, { status: 400 });
  }

  const updated = await products.update(id, result.value);
  if (!updated) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ product: updated });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  if (!(await currentAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const removed = await products.remove(id);
  if (!removed) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
