import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { normalizeCode } from "@/lib/affiliate/codes";
import { affiliateStore, newInviteCode } from "@/lib/affiliate/store";
import type { InviteCode } from "@/lib/affiliate/model";

export const runtime = "nodejs";

// Invite codes: the entry permits for joinMode "code".
//
// GENERATED SERVER-SIDE, NEVER CHOSEN. newInviteCode() draws from
// crypto.randomInt and checks the result against the store, so two campaigns
// cannot be handed the same code and nobody can guess a neighbour's. An
// admin-chosen code ("INSTAGRAM") would be typed into the form by everybody
// who ever saw it once.
//
// DISABLING IS NOT DELETING. A disabled code keeps its usage history, which is
// what an operator needs when a campaign is over but the question "who came in
// through this" is still open. Delete is for the ones that were never used.

/** One click may not spawn an unbounded batch, and 100 fits on a screen. */
const MAX_BATCH = 100;
/** A code that lets a thousand people in is a link, not an invitation. */
const MAX_USES = 1000;
const MAX_NOTE = 120;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function intIn(value: unknown, min: number, max: number, fallback: number): number | null {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  if (value < min || value > max) return null;
  return value;
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const codes = await affiliateStore.listInvites();
    return NextResponse.json({
      codes: codes.sort((a, b) => b.createdAt - a.createdAt),
    });
  } catch (err) {
    console.error("[affiliate] admin code list failed:", err);
    return NextResponse.json({ error: "store_unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!isRecord(body)) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const count = intIn(body.count, 1, MAX_BATCH, 1);
  if (count === null) {
    return NextResponse.json({ error: "invalid_count" }, { status: 400 });
  }

  const maxUses = intIn(body.maxUses, 1, MAX_USES, 1);
  if (maxUses === null) {
    return NextResponse.json({ error: "invalid_max_uses" }, { status: 400 });
  }

  let expiresAt: number | null = null;
  if (body.expiresAt !== undefined && body.expiresAt !== null) {
    const raw = body.expiresAt;
    // Refused when it is already in the past — which is also what catches the
    // classic mistake of sending seconds where the store keeps milliseconds.
    if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= Date.now()) {
      return NextResponse.json({ error: "invalid_expiry" }, { status: 400 });
    }
    expiresAt = Math.round(raw);
  }

  const note = typeof body.note === "string" ? body.note.trim().slice(0, MAX_NOTE) : "";

  const created: InviteCode[] = [];
  try {
    for (let i = 0; i < count; i += 1) {
      const invite: InviteCode = {
        code: await newInviteCode(),
        createdAt: Date.now(),
        expiresAt,
        maxUses,
        uses: 0,
        usedBy: [],
        note,
        disabled: false,
      };
      await affiliateStore.putInvite(invite);
      created.push(invite);
    }
    return NextResponse.json({ ok: true, created }, { status: 201 });
  } catch (err) {
    console.error("[affiliate] generating invite codes failed:", err);
    // Codes written before the failure exist in the store and would otherwise
    // be stranded — invisible to the operator, but valid for anyone who has
    // them. So they are handed back, flagged as an incomplete batch.
    if (created.length > 0) {
      return NextResponse.json({ ok: true, created, incomplete: true });
    }
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
  if (!isRecord(body) || typeof body.disabled !== "boolean") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const code = normalizeCode(String(body.code ?? ""));
  if (!code) return NextResponse.json({ error: "code_required" }, { status: 400 });

  try {
    const invite = await affiliateStore.getInvite(code);
    if (!invite) return NextResponse.json({ error: "not_found" }, { status: 404 });
    await affiliateStore.putInvite({ ...invite, disabled: body.disabled });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[affiliate] disabling an invite code failed:", err);
    return NextResponse.json({ error: "store_unavailable" }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const code = normalizeCode(new URL(request.url).searchParams.get("code") ?? "");
  if (!code) return NextResponse.json({ error: "code_required" }, { status: 400 });

  try {
    const invite = await affiliateStore.getInvite(code);
    // A 404 rather than a silent success: the list the operator clicked in was
    // stale, and reloading it is the useful next step.
    if (!invite) return NextResponse.json({ error: "not_found" }, { status: 404 });
    await affiliateStore.deleteInvite(code);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[affiliate] deleting an invite code failed:", err);
    return NextResponse.json({ error: "store_unavailable" }, { status: 503 });
  }
}
