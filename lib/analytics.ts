// Shared bits of the visit-statistics pipeline (see app/api/track/route.ts
// for the write side and app/api/admin/live for the read side).

/** Today in the owner's timezone — sv-SE formats as YYYY-MM-DD. */
export function dayKey(ts = Date.now()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date(ts));
}

/** A live-presence record, as /api/track writes it under `live:<sid>`. */
export interface LiveSession {
  path: string;
  country: string;
  city: string;
  ip: string;
  ua: string;
  startedAt: number;
  lastAt: number;
  pages: Record<string, number>;
}
