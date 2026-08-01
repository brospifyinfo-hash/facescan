// Throwaway calibration check — simulates the score distribution across
// synthetic faces to confirm the 0–10 scale is actually used.
const clamp = (v, l, h) => Math.max(l, Math.min(h, v));

function scoreBand(value, [lo, hi], tol) {
  if (value >= lo && value <= hi) {
    const mid = (lo + hi) / 2;
    const hw = (hi - lo) / 2 || 1e-6;
    return Math.round(100 - Math.min(1, Math.abs(value - mid) / hw) * 14);
  }
  const d = value < lo ? lo - value : value - hi;
  return Math.round(clamp(86 - (d / tol) * 74, 12, 86));
}

const toOverall = (h) => Number(clamp(((h - 55) / 40) * 6 + 3.5, 1, 10).toFixed(1));

// The 16 real bands, with their tolerances.
const bands = [
  [3, 8, 9], [0.43, 0.47, 0.08], [0.92, 1.08, 0.3], [0.28, 0.38, 0.16],
  [1.4, 2.4, 1.2], [118, 130, 22], [0.74, 0.84, 0.16], [1.8, 2.4, 0.9],
  [0, 6, 18], [4.6, 5.4, 1.2], [1.75, 2.05, 0.45], [1.28, 1.45, 0.28],
  [1.4, 1.65, 0.4], [0.23, 0.28, 0.08], [1.3, 1.9, 0.9], [0.95, 1.12, 0.28],
];

// Box-Muller: real faces cluster around the canon rather than scattering
// uniformly. SPREAD is how many band-widths one standard deviation covers.
const SPREAD = Number(process.argv[2] ?? 1.0);
function gauss() {
  const u = Math.random() || 1e-9;
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random());
}

const out = [];
let inRangeTotal = 0;
for (let n = 0; n < 20000; n++) {
  let sum = 0;
  for (const [lo, hi, tol] of bands) {
    const w = hi - lo;
    const v = (lo + hi) / 2 + gauss() * w * SPREAD;
    if (v >= lo && v <= hi) inRangeTotal++;
    sum += scoreBand(v, [lo, hi], tol);
  }
  const cat = sum / bands.length;
  const sym = 60 + Math.random() * 38;
  const harmony = Math.round(clamp(0.26 * sym + 0.74 * cat, 30, 99));
  out.push(toOverall(harmony));
}

out.sort((a, b) => a - b);
const q = (p) => out[Math.floor(p * out.length)];
console.log("percentiles", JSON.stringify({
  min: out[0], p10: q(0.1), p25: q(0.25), median: q(0.5),
  p75: q(0.75), p90: q(0.9), max: out[out.length - 1],
}));
console.log("avg in-range", (inRangeTotal / 20000).toFixed(1), "/ 16");

const bandOf = (s) =>
  s >= 8.6 ? "Exceptional" : s >= 7.6 ? "Strong" : s >= 6.6 ? "Solid" : s >= 5.4 ? "Reference Range" : "Developing";
const counts = {};
for (const s of out) counts[bandOf(s)] = (counts[bandOf(s)] || 0) + 1;
console.log("band mix", JSON.stringify(
  Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, ((v / out.length) * 100).toFixed(1) + "%"])),
));
