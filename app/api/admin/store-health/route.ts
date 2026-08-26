import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// What the SERVER sees when it calls the spreadsheet — not what a laptop sees.
//
// /api/health can only answer yes or no: `probeSheetsKv` catches everything and
// returns false, so "unreachable" covers a 404, a timeout, an out-of-date
// script and a redirect that went nowhere. Those need very different fixes, and
// guessing between them costs hours. This route makes the same call by hand and
// reports the status, the elapsed time and the first bytes of the answer.
//
// It never returns the token or the full URL. The deployment id is fingerprinted
// so two deployments can be told apart — enough to answer "does this instance
// even have the URL I just configured?", which is the question that matters
// after an environment change.

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = process.env.SHEETS_URL ?? "";
  const token = process.env.SHEETS_TOKEN ?? "";
  const deploymentId = url.match(/\/macros\/s\/([^/]+)\//)?.[1] ?? "";

  const base = {
    configured: Boolean(url && token),
    // First and last six characters: recognisable, not reusable.
    deployment: deploymentId
      ? `${deploymentId.slice(0, 6)}…${deploymentId.slice(-6)} (${deploymentId.length})`
      : null,
    region: process.env.VERCEL_REGION ?? null,
  };

  if (!url || !token) {
    return NextResponse.json({ ...base, ok: false, problem: "unconfigured" });
  }

  const started = Date.now();
  try {
    const controller = new AbortController();
    // Deliberately longer than the 10 s the store itself allows: the point is
    // to find out whether the call is slow or broken, and a diagnostic that
    // times out at the same moment cannot tell those apart.
    const timer = setTimeout(() => controller.abort(), 25_000);
    const res = await fetch(
      `${url}?action=kv-get&token=${encodeURIComponent(token)}&key=probe:health`,
      { redirect: "follow", signal: controller.signal, cache: "no-store" },
    );
    clearTimeout(timer);

    const body = (await res.text()).slice(0, 200);
    const elapsed = Date.now() - started;
    const json = (() => {
      try {
        return JSON.parse(body) as Record<string, unknown>;
      } catch {
        return null;
      }
    })();

    return NextResponse.json({
      ...base,
      ok: res.ok && json !== null && "record" in json,
      status: res.status,
      elapsedMs: elapsed,
      // Over the store's own 10 s limit the call succeeds here and fails there,
      // which is exactly the shape of "works on my machine".
      overStoreTimeout: elapsed > 10_000,
      bodyPreview: body.replace(/\s+/g, " ").slice(0, 160),
      problem:
        res.status === 404
          ? "deployment_gone"
          : !res.ok
            ? `http_${res.status}`
            : json === null
              ? "not_json"
              : !("record" in json)
                ? "old_script"
                : null,
    });
  } catch (err) {
    const elapsed = Date.now() - started;
    return NextResponse.json({
      ...base,
      ok: false,
      elapsedMs: elapsed,
      problem: err instanceof Error && err.name === "AbortError" ? "timeout" : "threw",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}
