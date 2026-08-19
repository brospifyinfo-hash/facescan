import { NextResponse } from "next/server";
import { currentSession } from "@/lib/auth/session";
import { clearPassword, hasPassword, passwordValid, setPassword } from "@/lib/auth/password";

export const runtime = "nodejs";

// Managing the account password. EVERY verb requires a live session: the
// password is a convenience credential layered over the OTP-proved address,
// so only somebody already inside the account may set, change or remove it.
// There is deliberately no reset flow — the email code IS the reset flow.

/** Does the signed-in account have a password? */
export async function GET() {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ set: await hasPassword(session.email) });
}

/** Set or replace the password. */
export async function POST(req: Request) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if (!passwordValid(body.password)) {
    return NextResponse.json({ error: "weak_password" }, { status: 400 });
  }

  await setPassword(session.email, body.password);
  return NextResponse.json({ ok: true });
}

/** Remove the password — the account falls back to code-only sign-in. */
export async function DELETE() {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await clearPassword(session.email);
  return NextResponse.json({ ok: true });
}
