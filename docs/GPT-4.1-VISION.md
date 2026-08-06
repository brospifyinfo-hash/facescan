# GPT-4.1 Vision als Rating-Engine

Vollständige Dokumentation der Umstellung. Die Analysestruktur des Projekts
wurde **nicht** verändert — GPT-4.1 füllt exakt die Felder, die es schon
gibt.

---

## 1. Das Feldinventar, das gefunden wurde

Der Prompt und das JSON-Schema werden **generiert**, nicht getippt. Quelle
ist jeweils die bestehende Datei. Stand heute:

| Was | Anzahl | Quelle im Repo |
|---|---|---|
| Messwerte (`MeasurementId`) | **25** | `lib/analysis/norms.ts` → `NORMS` |
| Response-Module (`ModulePayload`) | **9** | `lib/analysis/response.ts` |
| Interne Module (`ModuleId`) | 9 | `lib/analysis/modules.ts` |
| Dashboard-Metriken (`MetricId`) | **15** | `lib/metrics.ts`, `lib/specs.ts` |
| Gesichtsformen (`FaceShape`) | 6 | `lib/analysis/geometry.ts` |
| Quality-Issues (`QualityIssue`) | 9 | `lib/analysis/types.ts` |
| Quality-Skalare + Pose | 9 + 3 | `lib/analysis/types.ts` |
| Empfehlungs-Keys | 6 | `lib/analysis/recommendations.ts` → `ACTIONABLE` |
| Tier-Bänder (`BandId`) | 7 | `lib/metrics.ts`, `lib/tiers.ts` |

Die 25 Messwerte: `canthalTilt, esr, eyeAspect, eyeSpacing,
symmetryDeviation, browPosition, gonialAngle, jawWidth, chinRatio, thirds,
fifths, fwhr, facialIndex, goldenRatio, faceLength, bizygomaticRatio,
bigonialRatio, lowerThird, midface, noseWidth, noseLength, mouthNose,
lipRatio, philtrumRatio, chinProjection`.

Die 9 Module: `symmetry, proportions, jaw, eyes, nose, lips, skin, hair,
faceShape`.

**Wird eine Messgröße zu `norms.ts` hinzugefügt, erscheint sie automatisch
im Schema, im Prompt und im Validator.** `assertContract()` und
`scripts/test-vision.mts` schlagen fehl, wenn eine der drei Stellen
zurückbleibt.

---

## 2. Arbeitsteilung: was GPT entscheidet, was das Repo ableitet

Die zentrale Designentscheidung. GPT liefert jedes **Urteil**; das Repo
berechnet jede Größe, die eine reine Funktion dieser Urteile plus der
bereits vorhandenen Tabellen ist.

**GPT-4.1 liefert:**

- die 25 Messwerte (in den exakten Definitionen aus `geometry.ts`)
- welche Messwerte nicht messbar waren (`unmeasurable`)
- 9 Modul-Scores (0–100) + je eine Confidence (0–1)
- **den Attraktivitätsscore 1.0–10.0** — nichts stromabwärts rechnet ihn nach
- `confidence` (0–1) der gesamten Lesung
- `faceShape`, `skin.toneUniformity`, `skin.textureEnergy`
- 9 Quality-Skalare + Pose (yaw/pitch/roll) + Issues
- `strengths` / `weaknesses` (Messwert-IDs) und `recommendations`
- `notes` (Einschränkungen dieser Lesung)

**Das Repo leitet ab** (`lib/vision/adapt.ts`):

| Feld | Formel | Woher |
|---|---|---|
| `z` | `(value − reference) / sd` | `modules.ts` / `norms.ts` |
| `measurements[].score` | `100·exp(−½(z/κ)²)` | `modules.ts` |
| `grade` | `NORMS[id].grade` | `norms.ts` |
| `weight` | `DEFAULT_WEIGHTS.modules[id]` | `weights.ts` |
| `harmony` (Composite) | `Σ(w·c·s) / Σ(w·c)` | `engine.ts`, identisch zu `WeightedScorer` |
| `changeable` | `id in ACTIONABLE` | `recommendations.ts` |
| `magnitude` | `|z|` des Quell-Messwerts | `recommendations.ts` |
| `percentile` | Ankertabelle | `lib/vision/rubric.ts` |
| 15 Dial-Metriken | `makeMetric(id, value)` | `lib/specs.ts` (unverändert) |
| `weakest` | 3 niedrigste Dial-Scores | wie bisher |
| `midfaceScore` | `(nose + lips) / 2` | `lib/measure.ts` (gleiche Faltung) |

**Warum:** Jede dieser Größen ist bereits Code. GPT danach zu fragen hieße,
es um eine zweite, schlechtere Implementierung zu bitten — und jede wäre
eine Stelle, an der GPTs Antwort seinen eigenen Zahlen widersprechen kann.
Der Percentile ist das schärfste Beispiel: er wird **immer** aus der
Ankertabelle abgeleitet, nie von GPT übernommen, damit Headline und Badge
nie zwei verschiedene Geschichten erzählen.

---

## 3. Der Score: streng, 1.0–10.0, konsistent

`lib/vision/rubric.ts` hält die Ankertabelle. Sie wird **wörtlich in den
Prompt gerendert** und gleichzeitig im Code zur Percentile-Umrechnung
benutzt — eine Rubrik, die nur im Prompt existiert, ist eine Rubrik, die das
Produkt nicht prüfen kann.

Die Anker sind vom bestehenden Tier-Ladder (`lib/tiers.ts`) abgelesen, nicht
frei gewählt: sonst hätten die Bandnamen etwas anderes bedeutet als die
Leiter behauptet.

```
 1.0 → 0.00    5.0 → 44.0     8.0 → 94.5   (Top 5.5%)
 2.0 → 2.00    5.5 → 56.0     8.5 → 97.2   (Top 2.8%, "elite")
 3.0 → 8.00    6.0 → 67.0     9.0 → 98.8   (Top 1.2%)
 4.0 → 22.0    6.5 → 76.0     9.5 → 99.7   (Top 0.3%)
 4.5 → 32.0    7.0 → 84.0    10.0 → 99.99  (< 1 : 10 000)
```

Median **5.35** — ein gewöhnliches Gesicht ist eine 5, keine 7.

**Drei Mechanismen für Konsistenz:**

1. **Feste Reihenfolge im Prompt.** Erst messen, dann bewerten. Nie
   umgekehrt, nie eine Zahl "aus dem Bauch" und danach begründet.
2. **Anker in Häufigkeit statt in Adjektiven.** "Top 5%" interpretiert das
   Modell bei jedem Aufruf gleich; "attraktiv" nicht.
3. **`temperature: 0`, `top_p: 1`.** Plus eine explizite Verbotsliste: Foto-
   qualität, Beleuchtung, Ausdruck, Kleidung, Hintergrund, Ethnie, Alter
   und Geschlecht dürfen den Score **nicht um ein Zehntel** bewegen. Der
   Prompt verlangt ausdrücklich: zwei Fotos derselben Person müssen
   innerhalb von 0.3 landen.

Das Repo hält Punkt 3 nach: `scripts/test-vision.mts` prüft, dass eine
Antwort mit ruinierter Bildqualität dieselbe Headline erzeugt und nur die
Confidence senkt.

---

## 4. Neue Dateien

```
lib/vision/
  contract.ts    Feldinventar + VisionAnalysis + MEASUREMENT_DEFS
                 (operative Definition jedes Messwerts, 1:1 aus geometry.ts)
  rubric.ts      Ankertabelle, percentileOfVisionScore(), rubricText()
  prompt.ts      System-Prompt — generiert aus NORMS + MODULE_MEASUREMENTS
  schema.ts      Strict JSON Schema — generiert aus dem Contract
  openai.ts      Responses-API-Transport: Retry, Timeout, Rate-Limits
  image.ts       Server: Data-URL-Parsing, Format- und Größenprüfung
  compress.ts    Browser: Canvas-Downscale + JPEG-Reencode
  cache.ts       SHA-256-Key, TTL + LRU
  validate.ts    Parsen, Prüfen, Reparieren der Modellantwort
  adapt.ts       VisionAnalysis → AnalysisResponse + ScanMetrics-Felder
  log.ts         Strukturiertes Logging mit Redaction
  client.ts      Browser-Seite des Scans

app/api/vision-scan/route.ts   Der Endpunkt
scripts/test-vision.mts        56 Checks, kein Netzwerk
docs/GPT-4.1-VISION.md         Dieses Dokument
```

## 5. Geänderte Dateien

| Datei | Änderung | Warum |
|---|---|---|
| `lib/store.ts` | `ScanMetrics.scoreSource?: "geometry" \| "vision"` | Die beiden Headlines liegen auf verschiedenen Skalen; `percentileFor()` muss wissen, welche. Fehlt = `"geometry"`, der Demo-Pfad bleibt unberührt. |
| `lib/percentile.ts` | `percentileFor(overall, source?)`, `topPercentFor(overall, source?)` | Vision-Scores gehen durch die Ankertabelle statt durch `COMPOSITE_CDF`. Default unverändert, alle bestehenden Aufrufe verhalten sich gleich. |
| `lib/analysis.ts` | neu: `detectFrontOverlay()` | Liefert Mesh, Aspect, Landmark-Zahl und IPD **ohne** die Stufen 4–8 zu rechnen. Der Vision-Pfad braucht von MediaPipe nur die Darstellung. |
| `lib/analysis/recommendations.ts` | `ACTIONABLE` exportiert | Der Validator prüft damit, dass GPTs Empfehlung wirklich der Hebel dieses Messwerts ist. Sonst keine Änderung. |
| `components/dashboard/PercentileBadge.tsx` | optionales `source`-Prop | Default `"geometry"`. |
| `app/results/page.tsx` | reicht `metrics.scoreSource` durch | Eine Zeile. |
| `app/scan/page.tsx` | `USE_VISION`-Weiche + `runVisionScan()` + Fehlerdetail | Die Geometrie-Verzweigung bleibt Wort für Wort erhalten. |
| `package.json` | `test` ruft zusätzlich `test-vision.mts` | |
| `.env.example` | Vision-Block | |

**Nicht geändert:** `norms.ts`, `modules.ts`, `weights.ts`, `engine.ts`,
`geometry.ts`, `response.ts`, `specs.ts`, `metrics.ts`, `tiers.ts`,
`quality.ts`, `skin.ts`, `analyzer.ts`, `measure.ts`, `plan.ts`, sämtliche
Dashboard-Komponenten außer `PercentileBadge`, alle i18n-Dateien.

---

## 6. Was implementiert wurde

**OpenAI Responses API** — `POST https://api.openai.com/v1/responses` per
`fetch`, ohne neue Abhängigkeit. `store: false`, damit die Fotos nicht auf
OpenAIs Seite liegen bleiben. Structured Output über
`text.format = { type: "json_schema", strict: true }`.

**Retry-Logik** — wiederholt wird 408/409/429/5xx sowie Netz- und
Abort-Fehler. **Nicht** wiederholt: 400 (das Schema wäre beim zweiten Mal
dasselbe), 401/403 (Key-Problem), 404 (Modellname), Refusals und
abgeschnittene Antworten. Backoff exponentiell mit **vollem Jitter** — fester
Backoff synchronisiert alle Clients, die gleichzeitig gescheitert sind, auf
denselben Retry-Zeitpunkt.

**Timeout-Handling** — `AbortController` pro Versuch, 45 s (konfigurierbar).
Drei Versuche passen in `maxDuration = 60`.

**Rate-Limit-Handling** — zwei Seiten. Nach oben: `retry-after` wird
respektiert, ersatzweise `x-ratelimit-reset-*`; erst wenn beide fehlen, wird
geraten. Nach unten: eine Bremse von 6 Aufrufen pro IP und Minute. Sie ist
prozesslokal und deshalb eine Bremse, keine Autorisierung — so steht es auch
im Code.

**Bildkomprimierung** — im Browser, per Canvas: längste Kante 1024 px, JPEG
q 0.85, Qualität stuft ab bis ≤ 1.4 MB. Ein Handyfoto als Data-URL hat
3–8 MB; Vercels Body-Limit liegt bei 4.5 MB, der unkomprimierte Pfad
scheitert also an einer guten Kamera. q 0.85 statt 0.6, weil die Messwerte
Sub-Pixel-Verhältnisse kleiner Merkmale sind und Chroma-Matsch am Lidrand
genau dort landen würde.

**SHA-256-Caching** — Key ist `sha256(front) + sha256(side) +
PROMPT_VERSION + Modell`. Die Prompt-Version ist dabei, damit eine
Prompt-Änderung keine Antworten aus dem alten Wortlaut ausliefert. TTL 1 h,
LRU-Deckel 200 Einträge, **in-process** — bewusst keine Persistenz: ein
geteilter Cache hieße, Gesichtsanalysen in einen Speicher zu schreiben, von
dem dem Nutzer nichts gesagt wurde.

**Logging** — strukturiert, eine Regel: **keine Bilddaten, keine Data-URL,
kein Base64, keine E-Mail, keine Messwerte** in einer Logzeile. Geloggt wird
Stage, Dauer, Tokens, Fehlerklasse und ein 8-Zeichen-Präfix des Bild-Hashes
zum Korrelieren. Auch der Fehler-Body von OpenAI wird gelesen, aber nie
geloggt — er kann den Request spiegeln, und der Request enthält ein Foto.

**Fehlerbehandlung** — `VisionError` mit stabiler `kind`, gemappt auf
501/504/429/502/422/400/500. Refusals gehen im Wortlaut durch, alles andere
wird durch eine Meldung ersetzt, die sagt, was der Nutzer tun kann.

---

## 7. Der Validator: reparieren statt vertrauen

Strict Structured Output garantiert die **Form** (jedes Feld da, jedes Enum
gültig). Es kann den **Wert** nicht garantieren, weil OpenAIs Strict-Subset
kein `minimum`/`maximum` kennt. Deshalb `validate.ts`:

- Score außerhalb 1.0–10.0 → geklemmt
- Modul-Score außerhalb 0–100, Confidence außerhalb 0–1 → geklemmt
- `faceShape` mit Score → gestrippt (weight 0, wird nie bewertet)
- Score `null` bei Confidence > 0 → Widerspruch, Confidence auf 0
- `goldenRatio ≠ facialIndex` → gleichgesetzt (dieselbe Größe in `geometry.ts`)
- negative Beträge (`symmetryDeviation`, `thirds`) → als Betrag genommen
- fehlender/nicht-numerischer Messwert → als **unmessbar** markiert
- Messwert außerhalb `plausible` → **verworfen, nicht bewertet** (dieselbe
  Regel wie in `geometry.ts`: ein Ausreißer heißt "Landmarke gescheitert",
  nicht "außergewöhnliches Gesicht")
- Empfehlung, deren Key nicht der `ACTIONABLE`-Hebel dieses Messwerts ist →
  verworfen (Ratschläge zu Knochen sind die eine Regel, um die
  `recommendations.ts` gebaut ist)
- doppelte Empfehlungs-Keys → zusammengefasst
- JSON-Array als Payload → abgelehnt (`typeof [] === "object"`)

**Was er nicht tut:** eine plausibel aussehende Zahl einsetzen, wo das
Modell keine liefern konnte. Jede Reparatur wird gezählt, geloggt und als
Caveat in `report.meta.caveats` sichtbar gemacht.

---

## 8. Aktivierung

```bash
# .env.local
OPENAI_API_KEY=sk-...
NEXT_PUBLIC_SCORE_ENGINE=vision
```

Ohne `NEXT_PUBLIC_SCORE_ENGINE=vision` läuft alles unverändert auf der
On-Device-Pipeline. Ohne `OPENAI_API_KEY` antwortet die Route mit 501 statt
so zu tun, als sei sie konfiguriert.

```bash
npm test
```

---

## 9. Offene Punkte

1. **Kein Entitlement-Check.** `/api/vision-scan` gibt Geld aus und prüft
   die Berechtigung nicht — dasselbe TODO, das schon über `/api/report`
   steht. Die IP-Bremse begrenzt den Schaden, sie autorisiert nicht.
2. **Das Datenschutz-Versprechen ändert sich.** Die Landing-Page sagt, Fotos
   verließen den Browser nie. Im Vision-Modus stimmt das nicht mehr: sie
   gehen an OpenAI. `store: false` hält sie dort nicht vor, aber der Satz
   auf der Seite und die Consent-Führung müssen vor einem Launch angepasst
   werden — im Free-Scan wird derzeit **nicht** um Zustimmung gefragt
   (anders als bei `FullReport`, wo es eine Checkbox gibt).
3. **`hair` ist jetzt gefüllt.** `RESERVED_MODULES.hair` sagt "kein
   On-Device-Segmentierungsmodell" — das gilt für die lokale Pipeline und
   hört im Vision-Pfad auf zu gelten. Das Modul trägt Score und Confidence,
   aber weiterhin **Gewicht 0**, weil `weights.ts` keins definiert. Soll
   Haar in den Composite eingehen, ist das eine bewusste Entscheidung in
   `weights.ts` — die Modulgewichte müssen dann wieder auf 1.0 summieren.
4. **`/api/report` blieb auf Claude.** Das ist der bezahlte
   Markdown-Fließtext, nicht das Rating; er wurde nicht angefasst. Falls er
   ebenfalls auf GPT-4.1 soll, ist das eine separate, kleine Umstellung.
5. **Die Rubrik ist nicht validiert.** Sie ist eine konstruierte
   Verteilung, abgelesen vom Tier-Ladder, nicht an bewerteten Gesichtern
   gemessen. `/calibrate` sammelt genau solche Daten — mit einem
   ausreichenden Satz könnten die Anker durch gemessene Perzentile ersetzt
   werden.
