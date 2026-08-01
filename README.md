# FaceScan — Aesthetic Analysis Funnel

Landing → Quiz (6 steps) → Upload → **Scan (10s)** → **Preview Dashboard (blurred)** → **Paywall modal** → **Unlocked Dashboard**.

Deep dark (zinc-950), frosted glass, accent `#95BF47`, monospace figures,
radial gauges + radar chart, Framer Motion, Lucide, Zustand.

## Architecture

Everything after the scan lives on **one route** (`/results`) with a locked
and an unlocked state — no navigation between preview and paid view, so the
unlock feels instant.

| Element | Implementation |
|---|---|
| Free scan | **Real** on-device analysis — MediaPipe FaceLandmarker, 478 landmarks. Symmetry, canthal tilt (degrees), jaw-contour angle, fWHR. Photos never leave the browser. |
| Scan screen | 10s loading theater **over real computation**. Every terminal line names a step that actually executes in `lib/analysis.ts`. |
| Face mesh | SVG overlay built from the **real** landmark tesselation + contours + points, in normalized image space so it lands pixel-for-pixel on the face. |
| Preview dashboard | Overall score (x/10) and band are **visible**; Detailed Biometrics and the Glow-Up Plan render fully, then get `blur(9px)` + `inert`. The curiosity gap is honest — real numbers sit behind the blur. |
| Paywall | Modal, 4.99 € one-time. |
| Unlocked | Same page, blur removed, plan becomes interactive, AI report section mounts. |

## The measurements

16 measurements computed from the landmark mesh, grouped into four
categories, each scored against a published reference band:

| 👁️ Eye Region | 🗿 Jaw & Chin | 📐 Proportions | 👃 Nose & Mouth |
|---|---|---|---|
| Canthal tilt | Gonial angle | Facial thirds | Mouth-to-nose width |
| Eye separation ratio | Jaw-to-cheek width | Facial fifths | Nose width |
| Eye spacing | Chin-to-philtrum | fWHR | Lip ratio |
| Eye aperture | | Facial index | Midface ratio |
| Brow position | | | |

Plus ⚖️ Symmetry as its own composite.

Each one renders as a **270° radial dial** carrying four things at once: the
full measurement scale (track), the population reference band (accent arc),
where this face falls (marker + filled arc), and the raw figure at the
centre. A value in context beats a bare percentage.

## Languages

The page follows `navigator.languages` automatically and remembers a manual
override in localStorage. **EN, DE, ES, FR** ship complete.

Adding one is a single file: write it against the `Dict` type in
`lib/i18n/types.ts`, register it in `lib/i18n/index.ts`, add the tag to
`LOCALES`. The type checker then lists every string the new file still owes.

All prose lives in the dictionaries — metrics, plan entries and score bands
carry stable IDs and look their copy up at render time. Quiz answers are
stored as stable keys too, so translating a visible option label can never
change the plan logic.

**Skin and hair are deliberately absent from the measurements.** Neither is
derivable from landmark geometry. They're assessed from the photo by the
vision model in the paid report, and the UI says exactly that.

### Score calibration

`scoreBand()` in `lib/metrics.ts` scores 100 at band centre, tapering to 86
at the edges, then decaying steeply outside. `toOverall()` spreads the
realistic composite window [55, 95] across [3.5, 9.5] — a straight
`harmony / 10` would put every user between 5.5 and 9.5 and waste the bottom
half of the scale.

This matters beyond aesthetics: an earlier revision handed out 9.0/10
"Exceptional" with only 9 of 16 measurements in range. A dashboard that
flatters everyone is both useless as feedback and a quiet sales tactic.

```bash
node scripts/calibration-check.mjs 1.0   # simulates the distribution
```

The argument is how many band-widths one standard deviation covers. At 1.0
the mix is ~50% Reference Range, 30% Solid, 13% Developing, 6% Strong,
0.1% Exceptional. **The absolute calibration is unvalidated** — pinning it
down needs real photos with known reference measurements.

## Determinism

**No `Math.random()` anywhere.** Scores are deterministic by construction:
the same photo yields the same 478 landmarks, hence the same numbers on
every render and every reload. Verified across four independent runs of the
same input — identical `7.1` each time.

The only hashed values are in `demoMetrics()` (dev-only `/scan?demo=1`),
which is FNV-1a seeded so the demo is stable too.

## Setup

```bash
npm install
npm run dev
```

For the paid AI report, create `.env.local`:

```
ANTHROPIC_API_KEY=sk-ant-...
```

`/scan?demo=1` (development only) runs the flow with seeded demo metrics so
`/results` can be tested without a face photo.

## Deliberate deviations from the brief

- **No filename-hash scores.** Real measurement is already deterministic;
  hashing would have replaced real data with fake data.
- **Neutral score bands** (`Exceptional / Strong / Solid / Reference Range /
  Developing`) instead of the looksmaxxing tier ladder. Same signal, without
  vocabulary tied to a community with documented self-harm links.
- **No "Trusted by 250k+ users"** — invented figures are illegal in the EU
  (UWG Anhang Nr. 23b/23c, Omnibus). `lib/reviews.ts` ships empty and the
  section renders nothing until real reviews exist.
- **No Stripe logo** until Stripe is actually integrated — a payment
  provider's mark as a trust signal is a false claim otherwise.
- **Skin Quality** is not a landmark-derived number (it can't be). It's
  labelled as assessed by the vision model in the AI report.

## Before launch

1. **Payments** — `CheckoutModal.submit()` is a mock; no card data is
   collected. Wire Stripe Checkout, unlock only on webhook confirmation, and
   gate `/api/report` on server-verified payment (`app/api/report/route.ts`).
2. **Auth** — no accounts yet; the modal only captures a receipt email.
3. **Legal pages** — Impressum + privacy policy. Facial images are sensitive
   under GDPR; the on-device architecture is your strongest argument.
4. **Reviews** — populate `lib/reviews.ts` when you have real ones.

## Known environment notes

- `next/font/google` can't fetch Inter behind a TLS-intercepting proxy and
  silently falls back to a system font. Resolves on any normal network
  (including Vercel builds).
- **Never run `npm run build` while `next dev` is running** — they share
  `.next` and the dev server dies with
  `__webpack_modules__[moduleId] is not a function`. Stop dev, delete
  `.next`, restart.
- **Don't hand-write `-webkit-backdrop-filter`.** Lightning CSS collapses a
  hand-written prefix pair into the prefixed form alone, which current Chrome
  rejects — the glass blur then works in dev and silently disappears in
  production. Write the unprefixed property only and let the build prefix it.
