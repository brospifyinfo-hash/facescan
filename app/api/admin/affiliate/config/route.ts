import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { validateConfig } from "@/lib/affiliate/config";
import { affiliateStore } from "@/lib/affiliate/store";

export const runtime = "nodejs";

// The settings form behind /admin/affiliate/einstellungen.
//
// ALL OR NOTHING. validateConfig either returns a whole config or a list of
// reasons; there is no field-by-field save. A half-applied money rule — new
// thresholds with the old percentages, say — would pay an amount nobody chose,
// and it would do it silently until somebody added up a payout by hand.
//
// The error texts come out of validateConfig in German because they are
// rendered straight into the admin form, like everything else in this area.

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    // Always through the store, which normalises a stored row against the
    // defaults — a config written before a field existed still opens the form.
    return NextResponse.json({ config: await affiliateStore.getConfig() });
  } catch (err) {
    console.error("[affiliate] admin config read failed:", err);
    return NextResponse.json({ error: "store_unavailable" }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const input =
    typeof body === "object" && body !== null && "config" in body
      ? (body as { config: unknown }).config
      : body;

  const result = validateConfig(input);
  if (!result.ok) {
    return NextResponse.json({ errors: result.errors }, { status: 400 });
  }

  try {
    await affiliateStore.setConfig(result.config);
    // The saved object goes back, not the submitted one: updatedAt and the
    // rounded percentages are set by the validator, and the form has to show
    // what is actually stored.
    return NextResponse.json({ ok: true, config: result.config });
  } catch (err) {
    console.error("[affiliate] admin config write failed:", err);
    return NextResponse.json({ error: "store_unavailable" }, { status: 503 });
  }
}
