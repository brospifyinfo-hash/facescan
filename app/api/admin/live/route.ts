import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { skGetJson, skScan } from "@/lib/sheets-kv";
import { dayKey, type LiveSession } from "@/lib/analytics";

export const runtime = "nodejs";

// The live view's data: who is on the site RIGHT NOW (presence records the
// beacon refreshes, expiring at 90 s), plus today's and yesterday's counters.
// Admin-only — this is the one endpoint that shows IPs.

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const today = dayKey();
    const yesterday = dayKey(Date.now() - 24 * 60 * 60 * 1000);

    const [liveRecords, pvToday, geoToday, pvYesterday, geoYesterday] = await Promise.all([
      skScan("live:"),
      skGetJson<Record<string, number>>(`pv:${today}`),
      skGetJson<Record<string, number>>(`geo:${today}`),
      skGetJson<Record<string, number>>(`pv:${yesterday}`),
      skGetJson<Record<string, number>>(`geo:${yesterday}`),
    ]);

    const sessions = liveRecords
      .map((r) => {
        try {
          const s = JSON.parse(r.value) as LiveSession;
          return s && typeof s.path === "string" ? { sid: r.key.slice(5), ...s } : null;
        } catch {
          return null;
        }
      })
      .filter((s): s is LiveSession & { sid: string } => s !== null)
      .sort((a, b) => b.lastAt - a.lastAt);

    return NextResponse.json({
      now: Date.now(),
      sessions,
      today: { views: pvToday ?? {}, countries: geoToday ?? {} },
      yesterday: { views: pvYesterday ?? {}, countries: geoYesterday ?? {} },
    });
  } catch (err) {
    // The most likely cause is an Apps Script that predates kv-scan — say
    // so, because "empty" and "unsupported" demand different fixes.
    return NextResponse.json(
      { error: "script_outdated", detail: err instanceof Error ? err.message : String(err) },
      { status: 503 },
    );
  }
}
