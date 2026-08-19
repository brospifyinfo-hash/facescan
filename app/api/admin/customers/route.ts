import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { skScan } from "@/lib/sheets-kv";
import type { Entitlement, Payment } from "@/lib/stripe/entitlements";

export const runtime = "nodejs";

// The customer list: every address that ever saved a scan (aggregated by
// the Apps Script over the scans tab), merged with what they own (ent:*)
// and what they paid (pay:*). Admin-only, obviously.

const TIMEOUT_MS = 15_000;

interface CustomerRow {
  email: string;
  scans: number;
  firstAt: number;
  lastAt: number;
  best: number;
}

async function fetchCustomers(): Promise<CustomerRow[]> {
  const url = process.env.SHEETS_URL;
  const token = process.env.SHEETS_TOKEN;
  if (!url || !token) throw new Error("SHEETS_URL or SHEETS_TOKEN is missing.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${url}?token=${encodeURIComponent(token)}&action=customers`, {
      redirect: "follow",
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Sheets backend returned ${res.status}.`);
    const data = (await res.json()) as { customers?: CustomerRow[]; error?: string };
    if (data.error) throw new Error(`Sheets backend: ${data.error}`);
    // Same out-of-date guard as everywhere: the default doGet branch
    // answers with the catalogue, which must not read as "no customers".
    if (!("customers" in data)) throw new Error("action=customers unsupported — redeploy the script");
    return data.customers ?? [];
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const [customers, entRecords, payRecords] = await Promise.all([
      fetchCustomers(),
      skScan("ent:"),
      skScan("pay:"),
    ]);

    const plans = new Map<string, Entitlement>();
    for (const r of entRecords) {
      try {
        plans.set(r.key.slice(4), JSON.parse(r.value) as Entitlement);
      } catch {
        /* a corrupt row is not a customer's problem */
      }
    }
    const paid = new Map<string, number>();
    for (const r of payRecords) {
      try {
        const rows = JSON.parse(r.value) as Payment[];
        const cents = rows.reduce((sum, p) => sum + (p.amount ?? 0), 0);
        paid.set(r.key.slice(4), cents);
      } catch {
        /* dito */
      }
    }

    // Buyers who never saved a scan still belong on the list.
    const byEmail = new Map<string, CustomerRow>(customers.map((c) => [c.email, c]));
    for (const email of plans.keys()) {
      if (!byEmail.has(email)) {
        byEmail.set(email, { email, scans: 0, firstAt: 0, lastAt: 0, best: 0 });
      }
    }

    const rows = [...byEmail.values()]
      .map((c) => ({
        ...c,
        plan: plans.get(c.email)?.plan ?? null,
        grantedAt: plans.get(c.email)?.grantedAt ?? null,
        paidCents: paid.get(c.email) ?? 0,
      }))
      .sort((a, b) => b.lastAt - a.lastAt);

    return NextResponse.json({ customers: rows });
  } catch (err) {
    return NextResponse.json(
      { error: "script_outdated", detail: err instanceof Error ? err.message : String(err) },
      { status: 503 },
    );
  }
}
