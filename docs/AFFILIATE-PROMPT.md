# IMPLEMENTIERUNGS-PROMPT: Affiliate-/Partnerprogramm für FaceScan

> Diesen Text vollständig als ersten Prompt an den Coding-Agenten geben.
> Er ist auf das Repo `C:\Users\Win11 Pro\facescan` zugeschnitten (Next.js 15 App Router,
> TypeScript, Tailwind v4, Stripe, Resend, Sheets-KV). Nichts daraus ist optional,
> außer wo ausdrücklich „optional" steht.

---

## 0. AUFTRAG IN EINEM SATZ

Baue ein vollständiges, produktionsreifes Affiliate-System: jeder Kunde kann Partner werden,
bekommt einen eigenen Empfehlungslink, verdient eine im Admin einstellbare Provision auf
Käufe geworbener Kunden, steigt über 5 Level auf, sieht alles in einem spielerischen
Partner-Dashboard, und kann ab einem einstellbaren Mindestbetrag eine Auszahlung beantragen —
mit vollständigem Admin-Überblick und Resend-Benachrichtigungen.

**Liefere fertigen, lauffähigen Code — keine Vorschläge, keine Platzhalter, keine TODOs im
Code.** Am Ende muss `npm run build` und `npm test` grün sein und jedes Akzeptanzkriterium
aus Abschnitt 12 nachweislich erfüllt.

---

## 1. BESTAND: WAS ES SCHON GIBT (nutzen, nicht neu bauen)

Lies diese Dateien, BEVOR du eine Zeile schreibst:

| Datei | Rolle |
|---|---|
| `lib/sheets-kv.ts` | Persistenz: `skGet/skGetJson/skSet/skSetJson/skDel/skScan/skBump`. Google-Sheets als KV, atomar unter Script-Lock. |
| `lib/kv.ts` | Upstash-Redis-Pfad (derzeit nicht konfiguriert). Store-Reihenfolge überall: Redis → Sheets → Memory. |
| `lib/stripe/entitlements.ts` | Muster für einen Store mit drei Backends (`Memory`/`Redis`/`Sheets`) + `entitlementBacking()`. **Kopiere dieses Muster exakt.** |
| `app/api/stripe/webhook/route.ts` | Der EINZIGE Ort, an dem Geld-Ereignisse verarbeitet werden. Signaturprüfung, Idempotenz über `event.id`. |
| `app/api/stripe/create-payment-intent/route.ts` | Setzt `metadata.email` und `metadata.plan` auf dem PaymentIntent. |
| `lib/pricing.ts` | `PlanId = "raw" \| "pro" \| "blueprint"`, `AMOUNTS`, `formatAmount(locale, amount)`. |
| `lib/admin.ts` | `isAdmin()`, HMAC-Cookie `facescan_admin`, `ADMIN_CODE`, fail-closed. |
| `lib/auth/session.ts` | `currentSession()`, Cookie `facescan_session`, HMAC über `AUTH_SECRET`, 365 Tage. |
| `lib/auth/email.ts` | Resend-Versand + HTML-Mailtemplate im Markenlook (`BRAND` aus `lib/theme.ts`). |
| `components/admin/AdminNav.tsx` | Admin-Navigation (Live / Kunden / Produkte & Bilder). |
| `app/api/admin/customers/route.ts` | Muster für eine Admin-Auswertung über `skScan`. |
| `lib/i18n/{de,en,es,fr}.ts` + `types.ts` | Alle sichtbaren Strings sind typisiert und in **4 Sprachen** zu pflegen. |
| `scripts/test-stores.mts`, `scripts/test-purchase.mts` | Muster für die Tests, die du erweiterst. |

---

## 2. UNVERHANDELBARE INVARIANTEN (Bruch = Ablehnung)

1. **Geld entsteht nur im Stripe-Webhook.** Provisionen werden ausschließlich in
   `app/api/stripe/webhook/route.ts` bei `payment_intent.succeeded` gebucht — genau wie
   Entitlements. Keine Client-Route, kein `confirm`-Handler, kein Admin-Klick darf eine
   Provision erzeugen.
2. **Die Zuordnung liegt in der PaymentIntent-Metadata.** Beim Erzeugen des Intents wird der
   Partnercode als `metadata.ref` (+ `metadata.refLevel`, `metadata.refPercent`) mitgegeben.
   Der Webhook ist damit selbsttragend und hängt nicht an Cookies, die beim Zahlungs-Redirect
   längst weg sein können.
3. **Idempotenz.** Ein Webhook-Replay darf niemals eine zweite Provision buchen. Der
   Provisions-Schlüssel enthält die `paymentIntentId`; ein existierender Schlüssel wird nie
   überschrieben.
4. **`entitlementsEnforceable()` nicht anfassen.** Es gibt in `lib/access.ts` eine Bedingung,
   die Gates nur scharf schaltet, wenn Store UND Stripe UND Webhook-Secret vorhanden sind.
   Das Affiliate-System darf diese Logik weder verändern noch von ihr abhängen.
5. **Kein Ausfall des Shops durch das Affiliate-System.** Jede Affiliate-Operation im
   Kauf-Pfad (Intent-Erstellung, Webhook) ist in `try/catch` gekapselt und **fail-open**:
   Wenn der Affiliate-Store fehlt oder wirft, wird geloggt und der Kauf läuft normal weiter.
   Ein defektes Partnerprogramm darf niemals einen Verkauf blockieren.
6. **Design-Sprache: CONTAINERLOS.** Kein Karten-Container auf den neuen Kundenseiten.
   Inhalt schwebt direkt auf den Farbfeldern, Gliederung über Weißraum + `border-t hairline`.
   Dünne Outline (`border-white/[0.08] bg-white/[0.02]`) NUR auf Controls (Buttons,
   Kopier-Feld, Level-Kacheln). Glas (`.panel`/`.glass`) nur auf Navigations-Ebene, Modals
   und Sheets. Das Admin-Interface folgt dem bestehenden Admin-Stil.
7. **Alle sichtbaren Strings über `lib/i18n` in DE, EN, ES, FR.** Kein hartkodierter Text in
   Kundenkomponenten. `lib/i18n/types.ts` ist der Vertrag; fehlende Sprache = Build-Fehler.
8. **Admin-Routen fail-closed** über `isAdmin()`; Partner-Routen fail-closed über
   `currentSession()`. Ein Partner sieht ausschließlich seine eigenen Zahlen — jede Route
   leitet die Identität aus der Session ab, **niemals** aus einem Request-Parameter.
9. **IBAN und Adresse sind besonders schützenswerte Daten.** Siehe Abschnitt 7. Nie im Log,
   nie in einer E-Mail, nie in einer API-Antwort an den Client außer maskiert.
10. **Kein `body`-Hintergrund, keine neuen Karten-Container, keine Sterne/Fake-Zahlen.**
    Zeige nur echte Werte; wenn eine Zahl noch 0 ist, zeige 0 und einen Hinweis, nicht Mock-Daten.

---

## 3. DATENMODELL (Sheets-KV / Redis, Key-Layout)

Alle Schlüssel ohne TTL, außer wo angegeben. Werte sind JSON.

```
affcfg                        Globale Konfiguration (ein einziger Datensatz, siehe 3.1)
aff:<email>                   Partner-Datensatz (siehe 3.2)
affcode:<CODE>                → "<email>"  (Index: Code → Partner, CODE uppercase)
affinv:<CODE>                 Einladungs-/Zugangscode für die Anmeldung (siehe 3.3)
affbind:<customerEmail>       Dauerhafte Zuordnung Kunde → Partner (siehe 3.4)
affcom:<affEmail>:<piId>      Eine Provisionszeile, unveränderlich (siehe 3.5)
affsum:<affEmail>             Denormalisierte Zähler, via skBump fortgeschrieben (siehe 3.6)
affpay:<payoutId>             Auszahlungsantrag (siehe 3.7)
affclick:<CODE>:<yyyy-mm-dd>  Klickzähler pro Tag, TTL 120 Tage (nur Statistik)
```

`skScan("affcom:<email>:")` liefert alle Provisionen eines Partners, `skScan("aff:")` alle
Partner, `skScan("affpay:")` alle Auszahlungen — genau wie `app/api/admin/customers/route.ts`
es mit `ent:`/`pay:` macht.

### 3.1 `affcfg` — die Stellschrauben (alle im Admin editierbar)

```ts
interface AffiliateConfig {
  enabled: boolean;                 // Programm sichtbar/aktiv          default true
  joinMode: "open" | "code";        // freie Anmeldung oder Code nötig   default "open"
  requireApproval: boolean;         // Antrag muss vom Admin freigegeben werden  default false
  levels: LevelRule[];              // GENAU 5 Einträge, siehe unten
  commissionScope: "first" | "lifetime"; // nur Erstkauf oder alle Käufe  default "lifetime"
  commissionBase: "gross" | "net";  // Basis der Prozentrechnung         default "gross"
  vatPercent: number;               // nur bei base="net" benutzt        default 19
  cookieDays: number;               // Gültigkeit des Ref-Cookies        default 60
  holdDays: number;                 // Reifezeit bis auszahlbar          default 10
  payoutMinCents: number;           // Standard-Mindestauszahlung        default 2500 (25,00 €)
  currency: "eur";
  selfReferralBlocked: boolean;     // default true
  terms: string;                    // Kurztext, der bei der Anmeldung akzeptiert wird
  updatedAt: number;
}

interface LevelRule {
  level: 1 | 2 | 3 | 4 | 5;
  label: string;          // z. B. "Starter", "Bronze", "Silber", "Gold", "Legende"
  minReferrals: number;   // ab wie vielen ZAHLENDEN geworbenen Kunden
  percent: number;        // Provision in Prozent, 0–50, eine Nachkommastelle erlaubt
}
```

**Werkseinstellung (genau so vorbelegen):**

| Level | Label | ab zahlenden Kunden | Prozent |
|---|---|---|---|
| 1 | Starter | 0 | 10 % |
| 2 | Bronze | 20 | 15 % |
| 3 | Silber | 50 | 20 % |
| 4 | Gold | 100 | 25 % |
| 5 | Legende | 250 | 30 % |

Alle vier Zahlen jedes Levels sind im Admin änderbar (Label, Schwelle, Prozent).
Validierung serverseitig: 5 Einträge, `minReferrals` streng aufsteigend, Level 1 immer 0,
`percent` zwischen 0 und 50. Ungültige Eingabe → 400 mit klarer Meldung, kein Teil-Speichern.

### 3.2 `aff:<email>` — der Partner

```ts
interface Affiliate {
  email: string;                 // = Account-E-Mail, der Primärschlüssel
  code: string;                  // 6-stellig, A-Z2-9 ohne I/O/0/1, eindeutig
  status: "pending" | "active" | "blocked";
  firstName: string;
  lastName: string;
  address: { street: string; postalCode: string; city: string; country: string }; // ISO-2
  ibanEnc: string;               // AES-256-GCM, siehe Abschnitt 7
  ibanLast4: string;             // z. B. "4711" — das Einzige, was je an einen Client geht
  ibanCountry: string;           // "DE"
  accountHolder: string;
  createdAt: number;
  approvedAt: number | null;
  invitedWithCode: string | null;
  // Admin-Overrides, alle optional; null = globale Regel gilt
  percentOverride: number | null;        // fixe Prozente für diesen Partner
  levelOverride: 1 | 2 | 3 | 4 | 5 | null; // Level manuell festsetzen
  payoutMinOverrideCents: number | null; // eigene Mindestauszahlung ("manche nicht")
  note: string;                          // interne Notiz des Admins
  history: Array<{ at: number; field: "iban" | "address"; ibanLast4?: string }>; // max. 10
}
```

### 3.3 `affinv:<CODE>` — Zugangscode für die Anmeldung

```ts
interface InviteCode {
  code: string;          // 8-stellig, gleiche Alphabet-Regel
  createdAt: number;
  expiresAt: number | null;
  maxUses: number;       // default 1
  uses: number;
  usedBy: string[];      // E-Mails
  note: string;          // "Instagram-Aktion", "Freundeskreis" …
  disabled: boolean;
}
```

### 3.4 `affbind:<customerEmail>` — die Zuordnung

```ts
interface Binding {
  affiliateEmail: string;
  code: string;
  boundAt: number;
  source: "link" | "manual";  // manual = vom Admin gesetzt
  firstPurchaseAt: number | null;
}
```

**Regeln:**
- Wird geschrieben, sobald ein geworbener Besucher zum ersten Mal eine identifizierte
  Session bekommt (Login/Registrierung) **und** noch keine Bindung existiert.
- **Eine bestehende Bindung wird NIE automatisch überschrieben.** Nur der Admin kann sie
  ändern oder löschen.
- Keine Bindung, wenn `affiliateEmail === customerEmail` (Selbstwerbung) oder wenn der Kunde
  zum Zeitpunkt der Bindung bereits ein Entitlement besitzt (Bestandskunde) — beides
  protokollieren, nicht anlegen.

### 3.5 `affcom:<affEmail>:<paymentIntentId>` — eine Provisionszeile (unveränderlich)

```ts
interface Commission {
  id: string;                  // = paymentIntentId
  affiliateEmail: string;
  customerEmail: string;
  plan: PlanId;
  grossCents: number;          // was Stripe wirklich eingezogen hat
  baseCents: number;           // Rechenbasis nach commissionBase/vatPercent
  percent: number;             // die Prozente, die GALTEN, eingefroren
  level: 1 | 2 | 3 | 4 | 5;    // das Level, das galt, eingefroren
  amountCents: number;         // Math.round(baseCents * percent / 100)
  createdAt: number;
  maturesAt: number;           // createdAt + holdDays * 86400000
  status: "pending" | "available" | "requested" | "paid" | "reversed";
  payoutId: string | null;
  reversedReason: string | null;
}
```

**Level und Prozent werden zum Buchungszeitpunkt eingefroren.** Wenn der Admin später die
Prozente ändert, verändert das keine bereits gebuchte Provision — nur künftige. Das ist
Absicht und muss im Code kommentiert sein.

### 3.6 `affsum:<affEmail>` — Zähler (mit `skBump` fortgeschrieben)

```ts
interface AffiliateSummary {
  clicks: number;
  signups: number;          // gebundene Kunden ohne Kauf
  payingCustomers: number;  // eindeutige Kunden mit mind. einem bezahlten Kauf → LEVEL-BASIS
  revenueCents: number;     // Umsatz, den der Partner erzeugt hat
  earnedCents: number;      // Summe aller nicht stornierten Provisionen
  paidCents: number;        // ausgezahlt
  updatedAt: number;
}
```

`skBump` ist atomar unter dem Script-Lock — benutze es für jede Zählerbewegung.
**Die Summen sind ein Cache, nicht die Wahrheit.** Für Partner-Dashboard und Admin-Detail
werden die Beträge aus `skScan("affcom:<email>:")` berechnet; der Cache dient nur der
Partner-Liste im Admin. Baue eine Admin-Aktion „Neu berechnen", die `affsum:*` aus den
Provisionszeilen wiederherstellt.

### 3.7 `affpay:<payoutId>` — Auszahlungsantrag

```ts
interface Payout {
  id: string;               // "po_" + 12 Zeichen
  affiliateEmail: string;
  amountCents: number;      // Summe der referenzierten Provisionen, eingefroren
  commissionIds: string[];
  status: "requested" | "approved" | "paid" | "rejected";
  requestedAt: number;
  decidedAt: number | null;
  paidAt: number | null;
  reference: string;        // Verwendungszweck/Überweisungsreferenz, vom Admin gepflegt
  rejectionReason: string | null;
  // Schnappschuss der Zahlungsdaten zum Antragszeitpunkt (eine spätere Adressänderung
  // darf eine bereits getätigte Überweisung nicht rückwirkend verfälschen)
  snapshot: { accountHolder: string; ibanLast4: string; address: Affiliate["address"] };
}
```

---

## 4. TRACKING & ZUORDNUNG (der Kern — hier entscheidet sich, ob es „perfekt funktioniert")

### 4.1 Der Link

- Kanonisch: `https://<host>/r/<CODE>` (kurz, teilbar, druckbar).
- Zusätzlich akzeptiert jede Seite `?ref=<CODE>` (für Bio-Links und UTM-Kombinationen).
- Neue Route `app/r/[code]/route.ts` (Route Handler, `runtime = "nodejs"`):
  1. Code normalisieren (uppercase, trim), `affcode:<CODE>` auflösen.
  2. Unbekannter/blockierter Code → 302 auf `/` **ohne** Cookie (kein Fehler zeigen, kein
     Rückschluss darauf, welche Codes existieren).
  3. Gültig → Cookie setzen, Tagesklick via `skBump` zählen, 302 auf `/` (oder auf den in
     `?to=` übergebenen internen Pfad — nur Pfade, die mit `/` beginnen und kein `//`
     enthalten; alles andere ignorieren, sonst ist es ein offener Redirect).
- Middleware oder ein kleiner Server-Hook liest `?ref=` auf beliebigen Seiten und setzt
  dasselbe Cookie.

### 4.2 Das Cookie

- Name `facescan_ref`, **httpOnly**, `secure` in Produktion, `sameSite: "lax"`,
  `path: "/"`, `maxAge = cookieDays * 86400`.
- Inhalt HMAC-signiert mit `AUTH_SECRET` — exakt das Schema aus `lib/auth/session.ts`
  wiederverwenden (`payload.signature`, base64url). Ein unsigniertes Cookie wäre eine
  Selbstbedienungs-Provision.
- **Last click wins**, solange keine dauerhafte Bindung existiert: ein neuer Link
  überschreibt das Cookie.

### 4.3 Vom Cookie zur Bindung

In dem Moment, in dem eine Session entsteht (`/api/auth/verify-code`,
`/api/auth/password/login`, `/api/auth/google`): Cookie lesen, verifizieren,
`affbind:<email>` schreiben, falls noch keine existiert und die Regeln aus 3.4 es zulassen.
`signups` hochzählen. Anschließend das Ref-Cookie löschen (die Bindung ist jetzt dauerhaft).
Diese Logik lebt in **einer** Funktion `bindReferralIfAny(email)` in `lib/affiliate/track.ts`
und wird an allen drei Login-Wegen aufgerufen — nicht dreimal kopiert.

### 4.4 Von der Bindung zur Provision

1. **`create-payment-intent`**: Bindung des eingeloggten Kunden laden. Wenn vorhanden,
   Partner + aktuelles Level + Prozente ermitteln und als
   `metadata.ref`, `metadata.refLevel`, `metadata.refPercent` an den Intent hängen.
   Bei `commissionScope === "first"` und bereits vorhandenem `firstPurchaseAt`: nichts anhängen.
   Alles in `try/catch` — ein Fehler hier darf den Checkout nicht anfassen.
2. **Webhook `payment_intent.succeeded`**: nach der bestehenden `Promise.all`-Buchung von
   Entitlement + Payment zusätzlich `bookCommission(intent)` aufrufen. Diese Funktion:
   - liest `metadata.ref/refLevel/refPercent`; fehlt eines → still zurück,
   - prüft Selbstwerbung, Partnerstatus `active`, `cfg.enabled`,
   - prüft, ob `affcom:<aff>:<piId>` schon existiert → dann Ende (Idempotenz),
   - berechnet `baseCents` (`gross` → `intent.amount`; `net` → `Math.round(amount / (1 + vat/100))`),
   - schreibt die Provisionszeile mit `status: "pending"` und `maturesAt`,
   - aktualisiert `affsum` (`revenueCents`, `earnedCents`; `payingCustomers` **nur**, wenn
     dieser Kunde vorher noch nie gezahlt hat — prüfe über `affbind.firstPurchaseAt`),
   - setzt `firstPurchaseAt` in der Bindung, falls leer,
   - schickt die „Neuer geworbener Kunde"-Mail (Abschnitt 8),
   - fängt jeden Fehler ab und loggt ihn mit `[affiliate]`-Präfix. **Niemals werfen** — sonst
     wiederholt Stripe die Zustellung und das Entitlement wird erneut verarbeitet.
3. **`charge.refunded`**: der bestehende `case` wird erweitert — die zugehörige Provision
   (über `payment_intent`) auf `reversed` setzen, `earnedCents`/`revenueCents` zurückbuchen.
   War sie bereits Teil eines bezahlten Payouts, bleibt `paid` bestehen und es wird ein
   negativer Ausgleichsposten `affcom:<aff>:rev_<piId>` mit negativem `amountCents` geschrieben,
   der die nächste Auszahlung mindert. Im Admin sichtbar machen.

### 4.5 Reifung (der 10-Tage-Halt)

Kein Cron nötig und keiner erlaubt: `status: "pending"` wird **beim Lesen** ausgewertet —
eine Provision gilt als `available`, wenn `Date.now() >= maturesAt` und `status === "pending"`.
Die Statusspalte wird erst beim Auszahlungsantrag materialisiert. Schreibe eine reine
Funktion `effectiveStatus(c: Commission, now: number)` in `lib/affiliate/model.ts` und
benutze sie überall — Dashboard, Admin, Antragsprüfung. Genau diese Funktion wird getestet.

---

## 5. LEVEL-LOGIK

```ts
function levelFor(payingCustomers: number, cfg: AffiliateConfig): LevelRule
```

- Höchste Regel, deren `minReferrals <= payingCustomers`.
- `levelOverride` des Partners schlägt die Berechnung.
- `percentOverride` des Partners schlägt den Prozentsatz des Levels (Level bleibt für die
  Anzeige erhalten).
- Basis ist die Anzahl **eindeutiger zahlender** geworbener Kunden — nicht Klicks, nicht
  Anmeldungen, nicht Anzahl Käufe. Ein Kunde, der dreimal kauft, zählt einmal.
- Ein Level-Aufstieg löst eine Mail an den Partner aus (Abschnitt 8) und wird auf dem
  Dashboard einmalig gefeiert (Konfetti/Impuls-Animation, siehe 6.2).

---

## 6. KUNDENSEITE

### 6.1 Routen

| Route | Inhalt |
|---|---|
| `/partner` | Nicht angemeldet → Erklärseite + Login-Aufruf. Angemeldet ohne Partnerstatus → Bewerbungsformular. Angemeldet mit Partnerstatus → Dashboard. |
| `/partner/auszahlung` | Auszahlungsantrag + Historie (kann auch ein Sheet auf `/partner` sein). |
| `/r/[code]` | Redirect-Handler (Abschnitt 4.1). |

`/partner` ist im `sitemap.ts` als Marketing-Einstieg erlaubt, das eingeloggte Dashboard
bekommt `robots: { index: false }`. Verlinke `/partner` in `app/konto/page.tsx` und in der
unteren Tab-Leiste oder im Menü — es muss auffindbar sein, ohne die bestehende Navigation
umzubauen.

### 6.2 Das Dashboard — „sehr spielerisch"

Pflichtelemente, in dieser Reihenfolge:

1. **Level-Ring**: SVG-Kreis mit Fortschritt zum nächsten Level, in der Mitte die Levelzahl,
   darunter das Label. Zahl zählt beim Einblenden hoch (`framer-motion`, respektiert
   `prefers-reduced-motion`).
2. **Fortschrittsbalken** „Noch **N** Kunden bis Level X — dann **Y %** statt **Z %**".
   Das ist der wichtigste Satz der Seite; er muss die Belohnung konkret benennen.
3. **Level-Leiter**: fünf Sprossen (Level 1–5) mit Schwelle und Prozent, erreichte Stufen
   leuchten in Akzentfarbe, kommende sind gedimmt, die nächste ist hervorgehoben. Keine
   Karten — Haarlinien und Weißraum, gemäß Invariante 6.
4. **Link-Block**: der eigene Link groß, monospaced, mit „Kopieren"-Button (Bestätigung
   inline, kein Alert), Teilen-Buttons (WhatsApp, Instagram-DM-Text, X, E-Mail — reine
   `mailto:`/Deeplinks, keine externen Skripte), und ein QR-Code (serverseitig als SVG
   erzeugt, keine neue Abhängigkeit ohne Not — kleine eigene QR-Implementierung oder
   `qrcode`-Paket, wenn es ohne Build-Probleme installiert).
5. **Vier Kennzahlen** als 2×2-Quadrant mit Haarlinien-Kreuz (Muster aus dem Home-Screen):
   Klicks · Geworbene Kunden · Verdient gesamt · Auszahlbar jetzt.
6. **Verlauf**: die letzten geworbenen Käufe — Datum, Paket, Betrag, deine Provision,
   Status-Pille (`In Reifung bis TT.MM.` / `Auszahlbar` / `Beantragt` / `Ausgezahlt` /
   `Storniert`). **Die E-Mail des geworbenen Kunden wird pseudonymisiert** (`m•••@gmail.com`)
   — der Partner braucht die Adresse nicht, und du gibst keine Kundendaten heraus.
7. **Auszahlungs-Panel**: aktueller auszahlbarer Betrag, Mindestbetrag, Button
   („Auszahlung beantragen") — deaktiviert mit klarer Begründung, wenn der Mindestbetrag
   nicht erreicht ist oder ein Antrag offen ist. Darunter der ehrliche Satz: „Auszahlungen
   werden manuell geprüft und dauern in der Regel bis zu 10 Tage."
8. **Leerer Zustand**: noch keine Klicks → freundliche Anleitung in drei Schritten, keine
   erfundenen Beispielzahlen.

Animationen: Impuls beim Level-Aufstieg, weiche Zähler, Hover-Antwort nur bei
`(hover:hover) and (pointer:fine)`. Alles aus unter `prefers-reduced-motion`.

### 6.3 Bewerbungsformular (Partner werden)

Felder, alle Pflicht: Vorname · Nachname · Straße + Hausnummer · PLZ · Ort · Land ·
Kontoinhaber · IBAN · Häkchen „Teilnahmebedingungen akzeptiert".
Bei `joinMode === "code"` zusätzlich: **Zugangscode**.

Validierung **client- und serverseitig** (Server ist die Wahrheit):
- Namen 2–60 Zeichen, keine Steuerzeichen.
- PLZ/Ort/Straße nicht leer, Land als ISO-2 aus einer Auswahlliste.
- **IBAN: Formatprüfung + Mod-97-Prüfsumme** (`lib/affiliate/iban.ts`, eigene Implementierung,
  ~30 Zeilen, mit Unit-Test). Falsche Prüfsumme → klare Fehlermeldung am Feld, kein Speichern.
- Zugangscode: existiert, nicht `disabled`, nicht abgelaufen, `uses < maxUses`. Verbrauch
  wird erst nach erfolgreichem Anlegen des Partners hochgezählt.
- Doppelte Bewerbung → 409 mit Verweis aufs Dashboard.
- Rate-Limit: max. 5 Versuche pro Session und Stunde (Muster aus `lib/auth/store.ts`).

Nach dem Absenden: `requireApproval === false` → sofort `status: "active"`, Dashboard mit
Willkommens-Animation. `true` → `status: "pending"`, Wartebildschirm, Admin-Mail.

---

## 7. UMGANG MIT IBAN UND ADRESSE (nicht abkürzen)

- **Verschlüsselung at rest**: IBAN wird mit AES-256-GCM verschlüsselt gespeichert
  (`lib/affiliate/crypto.ts`, Node `crypto`, zufälliger 12-Byte-IV pro Datensatz, Format
  `v1.<iv-b64url>.<tag-b64url>.<ciphertext-b64url>`). Schlüssel aus `AFFILIATE_PII_KEY`
  (32 Byte, base64). Fehlt die Variable, verweigert die Bewerbung den Dienst mit einer
  klaren Meldung („Auszahlungsdaten können gerade nicht sicher gespeichert werden") —
  **niemals im Klartext speichern**, auch nicht in der Entwicklung.
  Begründung im Code kommentieren: Der Sheets-Store ist eine Tabelle in einem Google-Konto;
  eine Klartext-IBAN dort ist ein Datenleck mit einem Login Abstand.
- **Entschlüsselt wird an genau zwei Stellen**: in der Admin-Auszahlungsansicht (nach
  explizitem Klick auf „IBAN anzeigen", serverseitig, ein Aufruf pro Klick, mit Log-Eintrag
  ohne die IBAN selbst) und beim Export der Auszahlungsliste. Nirgends sonst.
- **Nie geloggt, nie in einer E-Mail, nie in einer Antwort an den Partner-Client.** An den
  Partner geht ausschließlich `DE•• •••• 4711`.
- Der Partner darf seine Zahlungsdaten ändern; Änderungen an IBAN oder Adresse werden mit
  Zeitstempel in `aff:<email>.history` festgehalten (max. 10 Einträge, IBAN nur mit `last4`),
  damit im Streitfall nachvollziehbar ist, wohin überwiesen wurde.
- Offener Auszahlungsantrag + IBAN-Änderung → der Antrag behält seinen `snapshot`.

---

## 8. E-MAILS (Resend)

Baue `lib/affiliate/email.ts` nach dem Vorbild von `lib/auth/email.ts`: `Resend`-Client,
`AUTH_FROM_EMAIL` als Absender, HTML im `BRAND`-Look **plus** Textteil, jede Funktion gibt
`SendResult` zurück und wirft nie. Ohne `RESEND_API_KEY` in Entwicklung: Konsolenausgabe.
Jeder Versand wird im kritischen Pfad defensiv behandelt (Fehler abfangen, loggen,
weitermachen) — **eine fehlgeschlagene Mail darf niemals eine Buchung verhindern.**

| Auslöser | Empfänger | Inhalt |
|---|---|---|
| **Neuer geworbener Kunde (Kauf gebucht)** | Partner | „Du hast gerade **X,XX €** verdient." Paket, Betrag, aktuelles Level, Gesamtstand, Reifedatum, Link zum Dashboard. **Keine Kundendaten außer maskierter Adresse.** |
| **Auszahlung beantragt** | Admin (`ADMIN_ALERT_EMAIL`, Fallback `AUTH_FROM_EMAIL`) | Partnername, Betrag, Anzahl Provisionen, Kontoinhaber, **IBAN nur maskiert**, Link nach `/admin/affiliate/auszahlungen`. Die vollständige IBAN steht im Admin, nicht im Postfach. |
| **Auszahlung beantragt (Bestätigung)** | Partner | Betrag, Antragsnummer, „Prüfung dauert in der Regel bis zu 10 Tage." |
| **Auszahlung ausgezahlt / abgelehnt** | Partner | Betrag + Referenz bzw. Begründung. |
| **Level-Aufstieg** | Partner | „Level 3 erreicht — ab jetzt 20 %." |
| **Bewerbung eingegangen** (nur bei `requireApproval`) | Admin | Name, E-Mail, Link zur Freigabe. |
| **Bewerbung freigegeben / abgelehnt** | Partner | Link zum Dashboard bzw. Begründung. |

Alle Partner-Mails in der Sprache des Partners (Locale aus Profil/Session; Fallback DE) —
dieselben vier Sprachen wie die UI.

---

## 9. ADMIN-BEREICH

Neuer Eintrag „Affiliate" in `components/admin/AdminNav.tsx`, Seiten unter
`app/admin/affiliate/…` mit vier Unteransichten (Tabs im bestehenden Admin-Stil):

### 9.1 Übersicht
Kennzahlen: aktive Partner · gebundene Kunden · geworbener Umsatz · Provisionen gesamt /
in Reifung / auszahlbar / ausgezahlt · offene Auszahlungsanträge (mit Badge in der Navigation).
Darunter Top-10-Partner nach Umsatz.

### 9.2 Partner
Tabelle: E-Mail · Name · Code · Level · Prozent · Klicks · geworbene Kunden · Umsatz ·
verdient · auszahlbar · Status · seit. Sortier- und filterbar, Suchfeld, CSV-Export.
Zeile aufklappbar → **Detail** mit:
- allen geworbenen Kunden (maskierte E-Mail, Erstkontakt, Anzahl Käufe, Ausgaben gesamt,
  erzeugte Provision) — genau der verlangte „komplette Überblick",
- allen Provisionszeilen mit Status,
- Zahlungsdaten (Adresse im Klartext, IBAN erst nach Klick auf „anzeigen"),
- Aktionen: **freigeben · sperren · entsperren · Prozent-Override setzen/löschen ·
  Level-Override setzen/löschen · Mindestauszahlung überschreiben (auch auf 0) ·
  Notiz speichern · Bindung eines Kunden manuell setzen oder lösen · Summen neu berechnen**.

### 9.3 Einstellungen
Formular auf `affcfg`: Programm an/aus · Anmeldung `offen` / `nur mit Code` · Freigabe nötig ·
Provisionsumfang (Erstkauf/lebenslang) · Basis (brutto/netto + MwSt.-Satz) · Cookie-Tage ·
Reifezeit in Tagen · Standard-Mindestauszahlung · **die 5 Level mit Label, Schwelle, Prozent**.
Ein „Speichern" pro Formular, serverseitige Validierung (Abschnitt 3.1), Erfolg/Fehler
inline. Vorschau-Zeile: „Bei 100 € Umsatz zahlt Level 4 gerade 25,00 € aus."

### 9.4 Codes
Liste aller Zugangscodes mit Status, Nutzung, Notiz, Ablauf.
Aktionen: **Generieren** (Anzahl 1–100 auf einmal, `maxUses`, optionales Ablaufdatum,
Notiz) · Kopieren · Deaktivieren · Löschen · CSV-Export. Generierte Codes werden
**einmal gesammelt angezeigt** und sind als Block kopierbar.

### 9.5 Auszahlungen
Liste aller Anträge (Standardfilter „offen"): Datum · Partner · Betrag · Status.
Detail: Betrag, enthaltene Provisionen, Kontoinhaber, **vollständige IBAN nach Klick**,
Adresse, Referenzfeld.
Aktionen: **genehmigen · als ausgezahlt markieren (mit Referenz) · ablehnen (mit Grund)**.
Beim Markieren als ausgezahlt: alle referenzierten Provisionen auf `paid`, `paidCents`
erhöhen, Mail an den Partner. Beim Ablehnen: Provisionen zurück auf `available`, Mail mit Grund.
Export der offenen Auszahlungen als CSV im SEPA-tauglichen Spaltenlayout
(Kontoinhaber, IBAN, Betrag, Verwendungszweck) — **die Überweisung selbst führt der Betreiber
in seiner Bank aus; das System löst niemals Zahlungen aus.**

---

## 10. API-ROUTEN (alle `runtime = "nodejs"`)

**Partner (Session Pflicht, Identität immer aus der Session):**
```
GET   /api/affiliate/me            Status, Konfigurations-Auszug, Level, Prozente, Kennzahlen,
                                   Provisionsverlauf (paginiert), auszahlbarer Betrag
POST  /api/affiliate/apply         Bewerbung (Formular aus 6.3)
PATCH /api/affiliate/payout-info   Adresse/IBAN ändern
POST  /api/affiliate/payout        Auszahlung beantragen
GET   /api/affiliate/payouts       eigene Auszahlungshistorie
```

**Admin (`isAdmin()` Pflicht):**
```
GET         /api/admin/affiliate/overview
GET  PATCH  /api/admin/affiliate/partners     (+ ?email= für Detail; PATCH für Status/Overrides/
                                               Notiz/Bindungen)
GET         /api/admin/affiliate/reveal-iban  ?email= — einzelner, protokollierter Abruf
GET  PATCH  /api/admin/affiliate/config
GET  POST  DELETE /api/admin/affiliate/codes
GET  PATCH  /api/admin/affiliate/payouts
```

Alle Schreibrouten: JSON-Body, manuelle Validierung im Stil des Repos (kein neues
Validierungs-Paket), 400 bei Unsinn, 401 ohne Berechtigung, 409 bei Zustandskonflikt,
niemals ein 500 mit Stacktrace an den Client. Betragsrechnung **immer in Cent als Integer** —
kein `float`, nirgends.

### Prüfungen beim Auszahlungsantrag (serverseitig, in dieser Reihenfolge)
1. Session vorhanden, Partner existiert, `status === "active"`.
2. Kein Antrag mit Status `requested`/`approved` offen (sonst 409).
3. Auszahlbarer Betrag = Summe aller Provisionen mit `effectiveStatus === "available"`
   (inklusive negativer Ausgleichsposten).
4. Betrag ≥ `payoutMinOverrideCents ?? cfg.payoutMinCents` (0 = kein Minimum).
5. Zahlungsdaten vollständig und IBAN prüfsummenvalide.
6. Antrag anlegen, referenzierte Provisionen auf `requested` setzen, Snapshot einfrieren,
   beide Mails verschicken.

---

## 11. DATEIEN, DIE DU ANLEGST

```
lib/affiliate/config.ts     Laden/Speichern von affcfg, Defaults, Validierung
lib/affiliate/store.ts      AffiliateStore mit Memory/Redis/Sheets-Backend (Muster:
                            lib/stripe/entitlements.ts), inkl. affiliateBacking()
lib/affiliate/model.ts      reine Funktionen: levelFor, effectiveStatus, commissionFor,
                            payableCents, maskEmail, formatCode  ← hier liegt die Testbasis
lib/affiliate/track.ts      Ref-Cookie lesen/schreiben/signieren, bindReferralIfAny()
lib/affiliate/crypto.ts     AES-256-GCM für die IBAN
lib/affiliate/iban.ts       Normalisierung + Mod-97-Prüfung + Maskierung
lib/affiliate/email.ts      alle Resend-Templates aus Abschnitt 8
lib/affiliate/codes.ts      Code-Generator (kollisionssicher: bis zu 5 Versuche gegen affcode:)
app/r/[code]/route.ts
app/partner/page.tsx
components/partner/*.tsx    Dashboard, LevelRing, LevelLadder, LinkBlock, Stats,
                            CommissionList, PayoutPanel, ApplyForm
app/admin/affiliate/{page,partner,einstellungen,codes,auszahlungen}/page.tsx
components/admin/Affiliate*.tsx
app/api/... (Abschnitt 10)
scripts/test-affiliate.mts  ← in "test" in package.json eintragen
```

Änderungen an bestehenden Dateien, sonst nichts:
`app/api/stripe/create-payment-intent/route.ts` (Metadata), `app/api/stripe/webhook/route.ts`
(Provisionsbuchung + Refund), die drei Auth-Routen (`bindReferralIfAny`),
`components/admin/AdminNav.tsx`, `app/konto/page.tsx` (Einstiegslink),
`lib/i18n/{types,de,en,es,fr}.ts`, `app/robots.ts`/`app/sitemap.ts`, `package.json`.

---

## 12. AKZEPTANZKRITERIEN (jedes einzeln nachweisen)

**Automatisiert in `scripts/test-affiliate.mts` (reine Funktionen + Store gegen Memory-Backend):**
1. `levelFor`: 0→L1, 19→L1, 20→L2, 49→L2, 50→L3, 99→L3, 100→L4, 249→L4, 250→L5, 10 000→L5.
2. Geänderte Schwellen im Config greifen sofort für die Levelberechnung.
3. `percentOverride`/`levelOverride` schlagen die Konfiguration.
4. Provisionsberechnung: 18,95 € brutto bei 20 % = 379 Cent; Netto-Basis bei 19 % MwSt.
   = 1592 Cent Basis → 318 Cent. Rundung immer `Math.round`, nie `floor`.
5. Idempotenz: `bookCommission` zweimal mit derselben `paymentIntentId` → genau eine Zeile,
   Zähler genau einmal bewegt.
6. Selbstwerbung wird abgelehnt; Bestandskunde wird nicht gebunden; bestehende Bindung wird
   nicht überschrieben.
7. `effectiveStatus`: vor `maturesAt` = `pending`, danach `available`; `requested`/`paid`/
   `reversed` bleiben unverändert.
8. Auszahlung unter Mindestbetrag → abgelehnt; mit `payoutMinOverrideCents: 0` → erlaubt;
   zweiter Antrag bei offenem Antrag → 409.
9. Storno nach Auszahlung erzeugt einen negativen Ausgleichsposten und die nächste
   auszahlbare Summe sinkt entsprechend.
10. IBAN: `DE89370400440532013000` gültig, `DE89370400440532013001` ungültig, Kleinschreibung
    und Leerzeichen werden normalisiert.
11. Krypto: `decrypt(encrypt(x)) === x`; manipulierter Chiffretext wirft; ohne Schlüssel
    wird nicht gespeichert.
12. Cookie: manipulierte Signatur wird verworfen (keine Bindung).

**Manuell, mit Beleg (Screenshot oder Konsolenausgabe) im Abschlussbericht:**
13. `/r/<CODE>` setzt das Cookie und leitet weiter; unbekannter Code leitet weiter, ohne
    Cookie; `?to=https://fremd.de` wird ignoriert.
14. Vollständiger Durchlauf im Stripe-Testmodus: Partner anlegen → Link → zweiter Account →
    Kauf → Provision erscheint im Dashboard und im Admin, Partner-Mail ist raus.
15. Admin-Änderung an Prozenten wirkt auf den **nächsten** Kauf, nicht rückwirkend.
16. `joinMode: "code"`: Anmeldung ohne Code wird abgewiesen, generierter Code funktioniert
    genau `maxUses`-mal.
17. Auszahlungsantrag → Mail an Admin und an den Partner, Status im Admin durchgeschaltet
    bis „ausgezahlt", Provisionen stehen auf `paid`.
18. `npm run build` ohne Fehler und ohne neue Warnungen; `npm test` grün.
19. Handy-Ansicht (375 px) geprüft: kein horizontales Scrollen, Level-Ring und Leiter lesbar,
    Kopier-Button erreichbar. Design containerlos gemäß Invariante 6.
20. Ohne `SHEETS_URL`/`SHEETS_TOKEN` (nur Memory-Store) startet die App, `/partner` zeigt
    einen ehrlichen Hinweis statt eines Absturzes, und der Checkout funktioniert unverändert.

---

## 13. UMGEBUNGSVARIABLEN

Neu (in `README.md` dokumentieren, mit Erzeugungsbefehl):
```
AFFILIATE_PII_KEY=<32 zufällige Bytes, base64>
# node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
ADMIN_ALERT_EMAIL=<Postfach für Auszahlungs- und Bewerbungsmails>
NEXT_PUBLIC_SITE_URL=<https://…>   # falls noch nicht vorhanden: Basis für den Partnerlink
```
Bereits vorhanden und wiederverwendet: `AUTH_SECRET`, `ADMIN_CODE`, `RESEND_API_KEY`,
`AUTH_FROM_EMAIL`, `SHEETS_URL`, `SHEETS_TOKEN`, `STRIPE_*`.

---

## 14. WAS DU NICHT TUST

- Keine neue Datenbank, kein Prisma, kein ORM. Sheets-KV mit Memory-Boden, wie im Repo.
- Keine automatischen Geldflüsse: **das System überweist nichts**, es verwaltet Anträge.
  Kein Stripe Connect, keine Payouts-API, kein SEPA-Versand.
- Keine erfundenen Zahlen, keine Beispiel-Partner, keine Fake-Bestenlisten, keine
  „Top-Verdiener verdienen 3.000 €/Monat"-Texte. Nur echte Werte aus dem Store.
- Keine Karten-Container, keine neuen Glas-Flächen außerhalb von Navigation/Modals, kein
  Hintergrund auf `body`.
- Keine Klartext-IBAN, kein Logging personenbezogener Daten, keine Kunden-E-Mail im
  Partner-Dashboard.
- Keine Änderung an Scan-, Report- oder Vision-Logik. Das Affiliate-System ist additiv.
- Kein `npm run build`, solange ein `next dev` läuft (zerschießt `.next`).

---

## 15. LIEFERUNG

Arbeite in dieser Reihenfolge und halte nach jedem Block kurz an, um den Stand zu berichten:

1. `lib/affiliate/*` (Model, Store, Crypto, IBAN, Codes, Config) + `scripts/test-affiliate.mts` → Tests grün.
2. Tracking-Kette: `/r/[code]`, Cookie, `bindReferralIfAny`, Anbindung an die drei Login-Routen.
3. Geld-Kette: Metadata im PaymentIntent, `bookCommission` im Webhook, Refund-Behandlung.
4. Partner-API + Dashboard + Bewerbungsformular + i18n in vier Sprachen.
5. Admin: Einstellungen → Partner → Codes → Auszahlungen.
6. E-Mails.
7. Durchlauf der Akzeptanzliste, Build, Tests, Bericht.

**Abschlussbericht** mit: geänderte/neue Dateien, das Key-Layout wie tatsächlich umgesetzt,
die neuen Env-Variablen, das Ergebnis jedes der 20 Akzeptanzkriterien, und eine ehrliche
Liste dessen, was nicht funktioniert oder bewusst offen geblieben ist.
