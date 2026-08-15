// The report as a file the customer keeps.
//
// A SELF-CONTAINED HTML DOCUMENT, built in the browser. Three reasons it is
// not a server-rendered PDF:
//
//   1. Everything it contains is already on the device. Posting the scan to
//      a server to have it typeset and sent back would put the whole reading
//      on the wire for no gain — the same architecture argument that keeps
//      the product ranking client-side.
//   2. A PDF needs a rendering dependency in the bundle or on the server.
//      This needs none: it is a string.
//   3. The file opens in anything, and Ctrl+P inside it gives a PDF with the
//      print stylesheet already applied. The customer gets both formats from
//      one download.
//
// EVERYTHING IS ESCAPED. The strings come from the dictionaries and from the
// scan, which are trusted today — but this function builds markup, and a
// document generator that trusts its inputs is one content change away from
// producing a broken file. Escaping costs nothing and removes the class.

import type { Dict } from "./i18n/types";
import type { QuizAnswers, ScanMetrics } from "./store";
import type { BandId } from "./metrics";
import { buildPlan } from "./plan";
import { bandFor } from "./tiers";
import { analysisRows, scanRef, strengthsOf } from "./report-model";
import { potentialFor } from "./potential";

const esc = (v: unknown): string =>
  String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** A bar drawn with a div, so it survives a printer with images off. */
function bar(value: number): string {
  const pct = Math.max(0, Math.min(100, value * 10));
  return `<div class="track"><div class="fill" style="width:${pct}%"></div></div>`;
}

export interface ExportOptions {
  /** Include the four-week programme — blueprint only. */
  monthly: boolean;
}

export function buildReportHtml(
  t: Dict,
  quiz: QuizAnswers,
  metrics: ScanMetrics,
  locale: string,
  options: ExportOptions,
): string {
  const band = bandFor(metrics.overall);
  const bandCopy = t.bands[band.id as BandId];
  const potential = potentialFor(metrics);
  const rows = analysisRows(metrics);
  const strengths = strengthsOf(metrics);
  const plan = buildPlan(quiz, metrics);
  const date = new Date().toLocaleDateString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const modules = rows
    .map(
      (r) => `<tr>
        <td>${esc(t.results.modules[r.id].replace(/­/g, ""))}</td>
        <td class="num">${r.score === null ? esc(t.results.notMeasured) : `${r.score.toFixed(1)} / 10`}</td>
        <td class="barcell">${r.score === null ? "" : bar(r.score)}</td>
      </tr>`,
    )
    .join("");

  const steps = plan
    .map(
      (e, i) => `<li>
        <div class="step-head">
          <span class="step-n">${i + 1}</span>
          <strong>${esc(t.plan[e.id].title)}</strong>
          <span class="cadence">${esc(t.plan[e.id].cadence)}</span>
        </div>
        <p>${esc(t.plan[e.id].detail)}</p>
      </li>`,
    )
    .join("");

  // Same split the on-screen programme uses: the strongest levers first, the
  // rest introduced in pairs. Duplicated deliberately rather than imported —
  // MonthlyProgram is a client component and this is a pure string builder.
  const weeks: (typeof plan)[] = [[], [], [], []];
  plan.forEach((entry, i) => {
    weeks[i < 3 ? 0 : i < 5 ? 1 : i < 7 ? 2 : 3].push(entry);
  });

  const monthly = options.monthly
    ? `<h2>${esc(t.monthly.title)}</h2>
       <p class="sub">${esc(t.monthly.sub)}</p>
       ${weeks
         .map(
           (w, i) => `<div class="week">
             <h3>${esc(t.monthly.weekLabel)} ${i + 1}</h3>
             <ul class="plain">${
               // Everything started earlier keeps running — that is what
               // makes it a programme rather than four separate weeks.
               weeks
                 .slice(0, i + 1)
                 .flat()
                 .map((e) => `<li>${esc(t.plan[e.id].short)}</li>`)
                 .join("")
             }</ul>
           </div>`,
         )
         .join("")}`
    : "";

  return `<!doctype html>
<html lang="${esc(locale)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>FaceScan — ${esc(date)}</title>
<style>
  :root { --ink:#111417; --soft:#5b636b; --faint:#9aa4ae; --line:#e3e7ea; --accent:#1f9d55; }
  * { box-sizing:border-box; }
  body { margin:0; padding:32px 24px 56px; background:#fff; color:var(--ink);
         font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
         max-width:760px; margin-inline:auto; }
  header { display:flex; justify-content:space-between; align-items:baseline;
           border-bottom:2px solid var(--ink); padding-bottom:10px; }
  .brand { font-weight:700; letter-spacing:.14em; font-size:13px; }
  .meta { font-size:11px; color:var(--faint); }
  h1 { font-size:34px; margin:28px 0 2px; letter-spacing:-.02em; }
  h2 { font-size:15px; text-transform:uppercase; letter-spacing:.09em;
       margin:32px 0 10px; padding-bottom:6px; border-bottom:1px solid var(--line); }
  h3 { font-size:13px; margin:16px 0 6px; }
  p { margin:0 0 10px; }
  .sub { color:var(--soft); font-size:13px; }
  .score { font-size:52px; font-weight:700; letter-spacing:-.03em; line-height:1; }
  .score span { font-size:16px; font-weight:400; color:var(--faint); }
  .band { display:inline-block; margin-top:8px; padding:3px 10px; border:1px solid var(--line);
          border-radius:999px; font-size:11px; text-transform:uppercase; letter-spacing:.07em; }
  .two { display:flex; gap:36px; flex-wrap:wrap; }
  table { width:100%; border-collapse:collapse; font-size:13px; }
  td { padding:7px 0; border-bottom:1px solid var(--line); vertical-align:middle; }
  td.num { width:88px; text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
  td.barcell { width:120px; padding-left:14px; }
  .track { height:5px; background:var(--line); border-radius:999px; overflow:hidden; }
  .fill { height:100%; background:var(--accent); border-radius:999px; }
  ol.steps { list-style:none; padding:0; margin:0; counter-reset:s; }
  ol.steps li { padding:12px 0; border-bottom:1px solid var(--line); }
  .step-head { display:flex; align-items:baseline; gap:8px; flex-wrap:wrap; }
  .step-n { width:20px; height:20px; border-radius:999px; background:var(--ink); color:#fff;
            font-size:11px; display:inline-flex; align-items:center; justify-content:center; }
  .cadence { margin-left:auto; font-size:11px; color:var(--faint); }
  ol.steps p { margin:6px 0 0 28px; font-size:12.5px; color:var(--soft); }
  ul.plain { margin:0; padding-left:18px; font-size:12.5px; color:var(--soft); }
  ul.check { list-style:none; padding:0; margin:0; font-size:13px; }
  ul.check li::before { content:"✓"; color:var(--accent); margin-right:8px; }
  .week { break-inside:avoid; margin-bottom:12px; }
  footer { margin-top:36px; padding-top:12px; border-top:1px solid var(--line);
           font-size:10.5px; color:var(--faint); }
  @media print {
    body { padding:0; }
    h2 { break-after:avoid; }
    ol.steps li { break-inside:avoid; }
  }
</style>
</head>
<body>
<header>
  <span class="brand">FACE SCANNER AI</span>
  <span class="meta">${esc(t.results.scanId)} ${esc(scanRef(metrics))} · ${esc(date)}</span>
</header>

<h1>${metrics.overall.toFixed(1)} <span>${esc(t.results.outOf)}</span></h1>
<span class="band">${esc(bandCopy.label)}</span>
<p class="sub" style="margin-top:10px">${esc(bandCopy.blurb)}</p>
${
  potential && potential.lift > 0
    ? `<p class="sub"><strong>${esc(t.results.potential)}:</strong> ${potential.score.toFixed(1)} ${esc(t.results.outOf)} — ${esc(t.results.potentialBody)}</p>`
    : ""
}

<h2>${esc(t.results.detailed)}</h2>
<table>${modules}</table>

<div class="two">
  <div style="flex:1;min-width:200px">
    <h2>${esc(t.results.strengthsTitle)}</h2>
    <ul class="check">${strengths.map((s) => `<li>${esc(t.metrics[s.id].label)}</li>`).join("")}</ul>
  </div>
</div>

<h2>${esc(t.results.planTitle)}</h2>
<p class="sub">${esc(t.results.planSub)}</p>
<ol class="steps">${steps}</ol>

${monthly}

<footer>${esc(t.results.disclaimer)}</footer>
</body>
</html>`;
}

/** Trigger the download. Revokes the object URL — a leak here is a whole
 *  document held in memory for the life of the tab. */
export function downloadReport(html: string, filename: string): void {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
