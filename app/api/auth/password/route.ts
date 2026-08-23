import { NextResponse } from "next/server";
import { currentSession, setSessionCookie } from "@/lib/auth/session";
import { clearTicketCookie, currentTicket } from "@/lib/auth/ticket";
import { clearPassword, hasPassword, passwordValid, setPassword } from "@/lib/auth/password";
import { bindReferralIfAny } from "@/lib/affiliate/track";

export const runtime = "nodejs";

// Managing the account password.
//
// TWO WAYS TO BE ALLOWED IN HERE, and they are the whole flow:
//
//   a live SESSION — someone already signed in changing their password
//   a live TICKET  — someone who just proved their inbox with a code, at
//                    registration or after forgetting it. Writing the
//                    password is what mints their session; the ticket is
//                    spent in the same breath.
//
// There is no reset endpoint beyond this: "forgot password" is a code, and
// a code lands here.

/** Does the signed-in account have a password? */
export async function GET() {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ set: await hasPassword(session.email) });
}

/** Set or replace the password. */
export async function POST(req: Request) {
  const session = await currentSession();
  const ticket = session ? null : await currentTicket();
  const email = session?.email ?? ticket;
  if (!email) {
    return NextResponse.json({ error: "no_ticket" }, { status: 401 });
  }

  let body: { password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if (!passwordValid(body.password)) {
    return NextResponse.json({ error: "weak_password" }, { status: 400 });
  }

  await setPassword(email, body.password);

  // The ticket path ends in a session: the customer set a password and is,
  // by that act, signed in. The cookie is spent either way.
  if (!session) {
    await setSessionCookie(email);
    await clearTicketCookie();
    // This branch, not the whole handler: the referral is bound the moment a
    // session comes into existence, and only registration mints one here —
    // an already signed-in customer changing their password was bound (or
    // deliberately not bound) long ago. It is also why /api/auth/verify-code
    // carries no such call: it hands out a ticket, and a ticket is not yet
    // an account.
    await bindReferralIfAny(email);
  }

  return NextResponse.json({ ok: true, email });
}

/** Remove the password — signed-in only, and only as a deliberate act. */
export async function DELETE() {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await clearPassword(session.email);
  return NextResponse.json({ ok: true });
}
