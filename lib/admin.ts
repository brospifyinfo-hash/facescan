// Who is allowed to edit the catalogue.
//
// It reuses the existing email session rather than introducing a second
// credential. That session is already an HMAC-signed cookie whose subject
// proved control of an inbox via a one-time code, which is a stronger claim
// than a shared admin password pasted into an env var — and there is nothing
// extra to rotate, leak or forget.
//
// Admin-ness is therefore: a valid session, whose address is on a list that
// only exists server-side.
//
//   ADMIN_EMAILS="you@example.com, someone@else.com"
//
// FAILS CLOSED. An unset or empty list means NOBODY is an admin, including in
// development. The tempting alternative — "no list configured, so let anyone
// in locally" — is how an unconfigured production deploy ends up with an open
// catalogue editor, because the same code path decides both.
//
// This module is server-only. It must never be imported from a client
// component: the list would be inlined into the bundle, and hiding a button
// is not access control anyway. Every mutation re-checks on the server.

import { currentSession } from "@/lib/auth/session";

function adminList(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
}

export const adminConfigured = (): boolean => adminList().length > 0;

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = adminList();
  if (list.length === 0) return false;
  return list.includes(email.trim().toLowerCase());
}

/**
 * The address of the signed-in admin, or null.
 *
 * Returns the email rather than a boolean so a route can log WHICH admin
 * changed the catalogue without reading the cookie a second time.
 */
export async function currentAdmin(): Promise<string | null> {
  const session = await currentSession();
  if (!session || !isAdminEmail(session.email)) return null;
  return session.email;
}
