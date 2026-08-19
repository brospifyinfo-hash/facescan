import { NextResponse } from "next/server";
import { currentSession } from "@/lib/auth/session";
import { history, type HistoryInput } from "@/lib/history/store";
import { scanQuota } from "@/lib/history/quota";

export const runtime = "nodejs";

/** The signed-in customer's scans, and how many they have left. */
export async function GET() {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // A store that cannot answer is an outage, not an empty history — the two
  // must be distinguishable, or a backend failure reads as "no scans yet".
  try {
    const scans = await history.list(session.email);
    return NextResponse.json({
      scans,
      quota: await scanQuota(session.email, scans),
    });
  } catch (err) {
    console.error("[history] list failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "history_unavailable" }, { status: 503 });
  }
}

/**
 * Store one scan result under the customer's address.
 *
 * THE SESSION IS THE GATE, and it decides WHOSE history this is: the address
 * comes from the signed cookie and never from the body, or anyone could write
 * into anyone's history.
 *
 * It used to also require an entitlement, which is why nothing was ever
 * stored — Stripe is not configured in production, so no entitlement can
 * exist, so every save was refused with a 403 that nothing surfaced. Signing
 * in is the meaningful consent here: somebody who created an account and
 * proved an inbox is asking for their results to be kept. A scan by a visitor
 * who never signed in is still never stored, which is the promise that
 * actually matters.
 *
 * The numbers are re-clamped here rather than trusted. They arrive from the
 * client because that is where the analyser runs, so a hand-written request
 * could otherwise put a 9.9 into someone's history.
 */
export async function POST(request: Request) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // The scan allowance, finally enforced where lib/pricing.ts always said it
  // was. Counted from the stored history rather than from a counter, so it
  // cannot drift away from what the customer can actually see in /konto.
  let quota;
  try {
    const existing = await history.list(session.email);
    quota = await scanQuota(session.email, existing);
  } catch (err) {
    console.error("[history] quota read failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "history_unavailable" }, { status: 503 });
  }
  if (quota.remaining <= 0) {
    return NextResponse.json({ error: "quota_exhausted", quota }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const num = (v: unknown, max: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(0, v)) : 0;

  // The full measurement set, re-clamped like every other client number.
  const detail = (Array.isArray(body.detail) ? body.detail : [])
    .map((d) => {
      const p = d as { id?: unknown; score?: unknown; display?: unknown };
      return typeof p?.id === "string" && p.id.length > 0
        ? {
            id: p.id.slice(0, 40),
            score: num(p.score, 100),
            display: typeof p.display === "string" ? p.display.slice(0, 24) : "",
          }
        : null;
    })
    .filter((d): d is NonNullable<typeof d> => d !== null)
    .slice(0, 25);

  const entry: HistoryInput = {
    detail: detail.length > 0 ? detail : null,
    overall: num(body.overall, 10),
    band: typeof body.band === "string" ? body.band.slice(0, 32) : "",
    symmetry: num(body.symmetry, 100),
    eyesScore: num(body.eyesScore, 100),
    jawScore: num(body.jawScore, 100),
    proportionsScore: num(body.proportionsScore, 100),
    midfaceScore: num(body.midfaceScore, 100),
    source: body.source === "vision" ? "vision" : "geometry",
    // Same clamp as the rest: it arrives from the client because that is
    // where the analyser runs.
    potential:
      typeof body.potential === "number" && Number.isFinite(body.potential)
        ? Math.min(10, Math.max(0, body.potential))
        : null,
  };

  try {
    const scan = await history.add(session.email, entry);
    return NextResponse.json(
      { scan, quota: { ...quota, used: quota.used + 1, remaining: quota.remaining - 1 } },
      { status: 201 },
    );
  } catch (err) {
    console.error("[history] add failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "history_unavailable" }, { status: 503 });
  }
}
