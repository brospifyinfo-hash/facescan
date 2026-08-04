import { NextResponse } from "next/server";
import { clearSessionCookie, currentSession } from "@/lib/auth/session";

export const runtime = "nodejs";

/** Who is signed in, if anyone. */
export async function GET() {
  const session = await currentSession();
  return NextResponse.json({ email: session?.email ?? null });
}

/** Sign out. */
export async function DELETE() {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
