import { NextResponse } from "next/server";
import { checkAdminCode, setAdminCookie, clearAdminCookie, adminConfigured } from "@/lib/admin";

export const runtime = "nodejs";

/**
 * Exchange the admin code for a signed cookie.
 *
 * The code is compared here and never leaves the server — the client only
 * ever learns "yes" or "no". A wrong code costs a fixed delay so this cannot
 * be hammered at full speed; it is a short numeric secret, and without that
 * an attacker gets as many guesses per second as the network allows.
 */
export async function POST(request: Request) {
  if (!adminConfigured()) {
    return NextResponse.json({ error: "unconfigured" }, { status: 501 });
  }

  let code = "";
  try {
    const body = (await request.json()) as { code?: unknown };
    code = typeof body.code === "string" ? body.code : "";
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  if (!checkAdminCode(code)) {
    await new Promise((r) => setTimeout(r, 700));
    return NextResponse.json({ error: "wrong_code" }, { status: 401 });
  }

  await setAdminCookie();
  return NextResponse.json({ ok: true });
}

/** Sign out. */
export async function DELETE() {
  await clearAdminCookie();
  return NextResponse.json({ ok: true });
}
