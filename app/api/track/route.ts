import { NextResponse } from "next/server";
import { skBump, skSetJson, sheetsKvConfigured, sheetsKvHealthy } from "@/lib/sheets-kv";
import { dayKey } from "@/lib/analytics";

export const runtime = "nodejs";

// The visit beacon's server half.
//
// WHAT IT STORES
//   live:<sid>   one small record per active session, TTL 90 s — presence.
//                Refreshed by every beat; the admin live view scans these.
//   pv:<date>    page views per path, one JSON record per day (kv-bump).
//   geo:<date>   page views per country, same shape.
//
// GEO AND IP COME FROM THE REQUEST, NOT FROM THE CLIENT: Vercel stamps
// x-vercel-ip-country / -city on every request, and the IP is the first
// hop of x-forwarded-for. The client only ever reports what page it is on
// and for how long — it could lie about those, and the worst the lie does
// is draw a wrong bar in the owner's chart.
//
// THIS ENDPOINT NEVER FAILS LOUDLY. It answers 200 whatever happens: a
// broken statistics pipeline must not spam every visitor's console, and a
// beacon is fire-and-forget by definition. It is also the app's most
// frequently-called write path, so it does exactly one presence write per
// beat and two counter bumps per real page view, nothing more.

const LIVE_TTL_MS = 90_000;
/** Daily counter rows expire on their own — the kv tab is not an archive. */
const DAY_TTL_MS = 40 * 24 * 60 * 60 * 1000;

async function bumpField(key: string, field: string): Promise<void> {
  const n = await skBump(key, field, 1);
  if (n === null) {
    // First hit of the day for this record — create it. Two first hits
    // racing lose one count; a statistic can afford that, a login limit
    // could not (that one runs the same helper the other way round).
    await skSetJson(key, { [field]: 1 }, DAY_TTL_MS);
  }
}

export async function POST(req: Request) {
  // Statistics need a store; without one there is nothing to write and
  // the honest answer is still 200 — see the header.
  if (!sheetsKvConfigured() || !sheetsKvHealthy()) {
    return NextResponse.json({ ok: true });
  }

  let body: {
    sid?: unknown;
    startedAt?: unknown;
    path?: unknown;
    event?: unknown;
    pages?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const sid = typeof body.sid === "string" && /^[a-z0-9]{8,32}$/.test(body.sid) ? body.sid : null;
  const rawPath = typeof body.path === "string" ? body.path.split("?")[0] : "";
  const path = rawPath.startsWith("/") && rawPath.length <= 80 ? rawPath : null;
  const event = body.event === "view" ? "view" : "beat";
  if (!sid || !path) return NextResponse.json({ ok: true });

  const startedAt =
    typeof body.startedAt === "number" && Number.isFinite(body.startedAt) && body.startedAt > 0
      ? Math.min(body.startedAt, Date.now())
      : Date.now();

  // Per-path seconds, as the client accumulated them. Clamped hard: 20
  // paths, 6 h per path — a lying client draws a wrong bar, nothing else.
  const pages: Record<string, number> = {};
  if (body.pages && typeof body.pages === "object") {
    for (const [k, v] of Object.entries(body.pages as Record<string, unknown>).slice(0, 20)) {
      const key = k.split("?")[0];
      if (!key.startsWith("/") || key.length > 80) continue;
      const secs = Number(v);
      if (Number.isFinite(secs) && secs > 0) pages[key] = Math.min(21_600, Math.round(secs));
    }
  }

  const country = req.headers.get("x-vercel-ip-country") ?? "??";
  let city = "";
  try {
    city = decodeURIComponent(req.headers.get("x-vercel-ip-city") ?? "");
  } catch {
    city = req.headers.get("x-vercel-ip-city") ?? "";
  }
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  const ua = (req.headers.get("user-agent") ?? "").slice(0, 120);

  try {
    await skSetJson(
      `live:${sid}`,
      { path, country, city, ip, ua, startedAt, lastAt: Date.now(), pages },
      LIVE_TTL_MS,
    );
    if (event === "view") {
      await bumpField(`pv:${dayKey()}`, path);
      await bumpField(`geo:${dayKey()}`, country);
    }
  } catch {
    // The statistics pipeline failing is the owner's problem, not the
    // visitor's — swallow it.
  }

  return NextResponse.json({ ok: true });
}
