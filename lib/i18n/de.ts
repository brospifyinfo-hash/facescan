import type { Dict } from "./types";

export const de: Dict = {
  nav: { howItWorks: "So funktioniert's", language: "Sprache" },
  landing: {
    badge: "KI auf deinem Gerät · Beim Gratis-Scan wird nichts hochgeladen",
    headline: "Finde heraus, wo du",
    headlineAccent: "wirklich stehst.",
    sub: "Klinisch präzise Gesichtsgeometrie, komplett in deinem Browser berechnet. 478 Landmarken. 16 echte Messwerte. Ein Plan, mit dem du sofort anfangen kannst.",
    cta: "Gratis-Scan starten",
    ctaNote:
      "Kostenloser Scan · Kein Konto zum Starten nötig · Einmalzahlung für den vollen Report",
    expired:
      "Deine Sitzung ist abgelaufen — wie versprochen wurden Fotos und Scan aus dem Speicher gelöscht. Du kannst jederzeit neu starten.",
    trust: [
      {
        title: "Fotos werden nie hochgeladen",
        text: "Der Gratis-Scan läuft zu 100 % auf deinem Gerät — deine Fotos bleiben in diesem Browser-Tab und verfallen automatisch.",
      },
      {
        title: "478 Landmarken",
        text: "Echte Messungen: Symmetrieabweichung, Lidachse in Grad, Kieferwinkel. Nichts geraten.",
      },
      {
        title: "Einmalzahlung",
        text: "Kein Abo, keine automatische Verlängerung. Einmal zahlen, Report für immer behalten.",
      },
    ],
    stepsTitle: "So funktioniert's",
    steps: [
      { title: "6 Fragen beantworten", text: "60 Sekunden — kalibriert deine Analyse." },
      { title: "Zwei Fotos", text: "Frontal & Profil. Sie verlassen deinen Browser nie." },
      { title: "Scan auf dem Gerät", text: "478 Landmarken werden lokal erfasst und vermessen." },
      { title: "Dein Report", text: "16 Messwerte, Kategorie-Scores und ein echter Aktionsplan." },
    ],
    measuredTitle: "Was tatsächlich gemessen wird",
    measuredSub:
      "Fünfzehn Messwerte aus dem Landmarken-Netz, jeder gegen einen veröffentlichten anthropometrischen Referenzbereich geprüft.",
    privacyTitle: "Dein Foto verlässt dieses Gerät nicht",
    privacyBody:
      "Das ist kein Versprechen in einer Datenschutzerklärung, sondern die Architektur. Das Analysemodell wird in deinen Browser geladen und läuft dort. Beim Gratis-Scan ist überhaupt kein Upload-Endpunkt beteiligt.",
    privacyPoints: [
      "Der Scan läuft in deinem Browser — es gibt keinen Server, an den Fotos gehen könnten.",
      "Fotos liegen nur im Speicher des Tabs: keine Festplatte, keine Cookies, kein Konto.",
      "Die Sitzung löscht sich nach 15 Minuten selbst, Tab schließen löscht sofort.",
    ],
    pricingTitle: "Ein Preis, einmal bezahlt",
    pricingSub: "Kein Abo, keine automatische Verlängerung, kein Upselling.",
    pricingIncludes: [
      "Alle 15 biometrischen Messwerte mit ihren Referenzbereichen",
      "Kategorie-Scores und deine Stufe auf der Skala",
      "Personalisierter Aktionsplan, nach erwarteter Wirkung sortiert",
      "KI-Tiefenanalyse aus deinen Fotos",
    ],
    pricingNote:
      "Scan und Gesamtwert sind kostenlos. Du zahlst nur für die Details.",
    faqTitle: "Fragen, die sich lohnen",
    faq: [
      {
        q: "Wie genau ist das?",
        a: "Die Landmarken-Erkennung ist präzise — es ist dasselbe Modell, das in produktiven Computer-Vision-Systemen läuft. Weicher ist die Deutung: Die Scores vergleichen deine Messwerte mit veröffentlichten Referenzbereichen, und die beschreiben Durchschnitte, keine Schönheit. Nimm die Zahlen als Orientierung, nicht als Urteil.",
      },
      {
        q: "Ist das eine Attraktivitätsbewertung?",
        a: "Nein. Gemessen wird, wie nah deine Gesichtsproportionen an veröffentlichten Referenzbereichen liegen. Das korreliert in der Forschung mit empfundener Attraktivität, aber dieser konkrete Score wurde nie gegen Attraktivitätsurteile validiert — und wir behaupten das auch nicht.",
      },
      {
        q: "Was passiert mit meinen Fotos?",
        a: "Beim Gratis-Scan gar nichts — sie verlassen deinen Browser nie. Kaufst du den Report und stimmst ausdrücklich zu, werden die beiden Fotos einmalig zur KI-Analyse übertragen und danach nicht auf dem Server gespeichert.",
      },
      {
        q: "Warum braucht ihr ein Profilbild?",
        a: "Brauchen wir nicht. Alle Messwerte stammen aus dem Frontalbild. Ein Profilbild gibt dem KI-Report nur eine zweite Perspektive — deshalb ist es optional.",
      },
      {
        q: "Kann ich das unter 18 nutzen?",
        a: "Nein. Die Gesichtsstruktur verändert sich noch, jeder Wert wäre in einem Jahr falsch. Und wir analysieren aus Prinzip keine Gesichter von Minderjährigen.",
      },
    ],
    ctaFinal: "Scan starten",
    disclaimer:
      "FaceScan liefert geometrische Schätzwerte zur Orientierung bei der Selbstoptimierung. Es ist kein Medizinprodukt, und kein Ergebnis stellt eine medizinische, dermatologische oder psychologische Beurteilung dar.",
    imprint: "Impressum",
    privacyLink: "Datenschutz",
  },
  quiz: {
    progress: "Frage {n} von {total}",
    back: "Zurück",
    home: "Startseite",
    minorTitle: "FaceScan ist ab 18",
    minorBody:
      "Deine Gesichtsstruktur verändert sich noch — jeder Wert, den wir dir heute geben, wäre in einem Jahr falsch. Und wir analysieren aus Prinzip keine Gesichter von Minderjährigen. Komm wieder, wenn du 18 bist.",
    minorCta: "Zurück zum Start",
    numberHint: "Regler ziehen oder Wert eintippen",
    next: "Weiter",
    skip: "Überspringen",
    questions: [
      {
        title: "Wie sollen wir deinen Scan kalibrieren?",
        sub: "Die Referenzbereiche unterscheiden sich nach Geschlecht — das setzt die richtige Basis.",
        options: ["Männlich", "Weiblich", "Divers", "Will ich nicht sagen"],
      },
      {
        title: "Wie alt bist du?",
        sub: "Weichgewebe und Haut verhalten sich pro Lebensjahrzehnt anders.",
        options: ["Unter 18", "18–24", "25–34", "35–44", "45+"],
      },
      { title: "Wie groß bist du?", sub: "Zusammen mit dem Gewicht zur Einschätzung der Körperzusammensetzung." },
      { title: "Was wiegst du?", sub: "Die Definition im Gesicht hängt an der Körperzusammensetzung wie an nichts sonst." },
      {
        title: "Geschätzter Körperfettanteil?",
        sub: "Wenn du unsicher bist, überspring es — Größe und Gewicht geben uns schon einen Anhaltspunkt.",
        options: ["Unter 12 %", "12–18 %", "19–25 %", "Über 25 %", "Weiß ich nicht"],
      },
      {
        title: "Wie oft trainierst du?",
        sub: "Die Trainingsfrequenz bestimmt, wie schnell sich der Körperfett-Hebel bewegen lässt.",
        options: ["Aktuell gar nicht", "1–2× pro Woche", "3–4× pro Woche", "5× oder öfter"],
      },
      {
        title: "Wie viel schläfst du?",
        sub: "Wassereinlagerung und Hautregeneration hängen enger am Schlaf als an jedem Produkt.",
        options: ["Unter 6 Stunden", "6–7 Stunden", "7–8 Stunden", "Über 8 Stunden"],
      },
      {
        title: "Deine aktuelle Hautpflege?",
        options: ["Keine", "Reinigung und Creme", "Wirkstoffe, LSF, volle Routine"],
      },
      {
        title: "Rauchst oder dampfst du?",
        sub: "Man sieht es innerhalb weniger Jahre am Hautbild und an der Augenpartie.",
        options: ["Nein", "Gelegentlich", "Täglich"],
      },
      {
        title: "Was stört dich an deinem Gesicht am meisten?",
        options: ["Asymmetrie", "Schwache Kieferlinie", "Augenpartie", "Hautbild", "Dünner werdendes Haar"],
      },
      {
        title: "Trainierst du Zungenhaltung (Mewing)?",
        options: ["Nie", "Manchmal", "Täglich"],
      },
      {
        title: "Worum geht es dir wirklich?",
        options: ["Model-Niveau", "Selbstbewusstsein beim Daten", "Allgemeine Selbstoptimierung", "Nur neugierig"],
      },
    ],
  },
  plans: {
    raw: {
      name: "Raw Data",
      tagline: "Die Zahlen, sonst nichts",
      features: [
        "Alle 15 biometrischen Messwerte",
        "Lidachse, Symmetrie in %, Kieferwinkel in exakten Zahlen",
        "Referenzbereich zu jedem Messwert",
      ],
      excluded: ["Aktionsplan", "4-Wochen-Programm", "Verlauf & Tracking"],
    },
    pro: {
      name: "Pro Action Plan",
      tagline: "Die Zahlen — und was du damit machst",
      features: [
        "Alles aus Raw Data",
        "Schritt-für-Schritt-Glow-Up-Plan, nach Wirkung sortiert",
        "4-Wochen-Programm, Woche für Woche strukturiert",
        "Verlauf & Tracking — Scans über die Zeit vergleichen",
      ],
      excluded: ["Glow-Up-Projektionen", "Frisur- & Produktempfehlungen"],
    },
    blueprint: {
      name: "The Blueprint",
      tagline: "Alles, plus der visuelle Plan",
      features: [
        "Alles aus Pro",
        "Glow-Up-Projektionen für deinen Zielzustand",
        "Frisurempfehlungen für deine Gesichtsform",
        "Konkrete Produktempfehlungen mit Links",
        "KI-Tiefenanalyse, aus deinen Fotos geschrieben",
      ],
      excluded: [],
    },
  },
  monthly: {
    title: "Dein 4-Wochen-Programm",
    sub: "Aus deinen Messwerten und Antworten gebaut. Jede Woche baut auf der vorherigen auf.",
    weekLabel: "Woche",
    upsellTitle: "4-Wochen-Programm",
    upsellBody:
      "Ein Wochenplan rund um deine schwächsten Messwerte, dazu die KI-Tiefenanalyse aus deinen Fotos.",
    upsellCta: "Programm dazunehmen",
  },
  upload: {
    title: "Zwei Fotos. Mehr nicht.",
    sub: "Der Scan erfasst 478 Gesichtslandmarken aus deinem Frontalbild; das Profilbild verfeinert die Geometrie.",
    tips: [
      "Gleichmäßiges Tageslicht — stell dich ans Fenster",
      "Neutraler Ausdruck, Mund geschlossen",
      "Keine Brille, Haare aus dem Gesicht",
    ],
    front: "Frontalbild",
    frontHint: "Schau gerade in die Kamera, Kopf waagerecht.",
    side: "Profilbild",
    sideHint: "Dreh dich um 90° — Ohr zur Kamera.",
    optional: "optional",
    sideSkipNote:
      "Das Profilbild ist optional — alle Messwerte stammen aus dem Frontalbild. Es gibt dem KI-Report nur eine zweite Perspektive.",
    added: "hinzugefügt",
    replace: "Foto ersetzen",
    privacy:
      "Fotos bleiben in diesem Browser-Tab — beim Gratis-Scan wird nichts hochgeladen.",
    cta: "Analyse starten",
    errType: "Bitte wähle eine Bilddatei (JPG, PNG, WebP).",
    errSize: "Das Bild ist größer als 10 MB — bitte nimm ein kleineres.",
  },
  scan: {
    lines: [
      "FaceLandmarker-Modell wird geladen…",
      "Gesichtsbereich wird erkannt…",
      "478 Gesichtslandmarken werden erfasst…",
      "Kopfneigung wird über die Lidachse korrigiert…",
      "Lidachsenwinkel wird gemessen…",
      "Kieferkontur wird analysiert…",
      "Bilaterale Symmetrie wird berechnet…",
      "Gesichtsproportionen werden bewertet…",
      "Dein Aktionsplan wird erstellt…",
    ],
    running: "Läuft lokal in deinem Browser — nichts wird hochgeladen.",
    keepOpen: "Lass diesen Tab offen, bis die Analyse fertig ist.",
    failedTitle: "Scan fehlgeschlagen",
    errNoFace:
      "Wir konnten auf deinem Frontalbild kein Gesicht erkennen. Achte auf gleichmäßiges Licht, schau direkt in die Kamera und sorge dafür, dass dein ganzes Gesicht sichtbar ist.",
    errModel:
      "Das Analysemodell konnte nicht geladen werden. Prüfe deine Verbindung (das Modell wird einmalig heruntergeladen) und versuch es erneut.",
    backToPhotos: "Zurück zu den Fotos",
    retry: "Erneut versuchen",
    front: "Frontalbild",
    side: "Profilbild",
  },
  results: {
    overall: "Gesamt Score",
    // The reference sets the unit as "/ 10" beside the numeral rather than
    // spelling it out. Notation, so it is the same in every locale.
    outOf: "/ 10",
    demoData: "Demo-Daten",
    landmarks: "Landmarken",
    measured: "Gemessen",
    inRange: "Im Bereich",
    breakdown: "Biometrische Aufschlüsselung",
    breakdownSub: "Kategorie-Werte aus dem vollständigen Messsatz.",
    symmetry: "Symmetrie",
    eyes: "Augen",
    jaw: "Kiefer",
    ratios: "Verhältnisse",
    midface: "Mittelgesicht",
    allMeasurements: "Alle Messwerte",
    allMeasurementsSub: "Die vollständige Datentabelle hinter den Kreisdiagrammen.",
    skinTitle: "Haut & Haar",
    skinSub:
      "Aus der Landmarken-Geometrie nicht ableitbar — wird im KI-Report vom Vision-Modell aus deinem Foto bewertet.",
    planTitle: "Dein Glow-Up-Plan",
    planSub: "Sortiert nach erwarteter Wirkung für deine konkreten Messwerte.",
    completed: "Erledigt",
    inCategoryRange: "{n}/{total} im Bereich",
    unlockTitle: "{n} Messwerte sind fertig",
    unlockBody: "Deine drei größten Hebel:",
    unlockCta: "Alles freischalten",
    unlockNote: "Einmalzahlung · Kein Abo · Lebenslanger Zugriff",
    unlockChips: ["👁️ Augenpartie", "🗿 Kiefer & Kinn", "📐 Verhältnisse", "👃 Mittelgesicht", "✨ Glow-Up-Plan"],
    unlocked: "Vollständige Analyse freigeschaltet",
    disclaimer:
      "Jeder Wert ist eine geometrische Messung, die auf deinem Gerät aus Gesichtslandmarken berechnet und mit veröffentlichten Referenzbereichen verglichen wird. Orientierung zur Selbstoptimierung — keine medizinische, dermatologische oder psychologische Beurteilung und kein Urteil über das Aussehen eines Menschen.",
    reference: "Ref.",
    tableHead: ["Messwert", "Wert", "Referenz", "Status", "Score"],
    legendBand: "Normbereich",
    legendNeedle: "Dein Wert",
    legendScale: "Skalenenden",
    ringLegend:
      "Jeder Ring zeigt dasselbe: wie nah dieser Messwert an seinem Referenzbereich liegt, 0–100. Tippe einen an für die genaue Skala.",
    percentileBetter: "Besser als {p} %",
    percentileTop: "Top {n} %",
    percentileCaption:
      "der modellierten Vergleichsverteilung — gemessen an der Nähe zu den veröffentlichten Referenzproportionen.",
    percentileWhat:
      "Berechnet aus einem Modell von 60.000 Gesichtern rund um veröffentlichte anthropometrische Mittelwerte — keine Attraktivitäts-Rangliste und noch nicht auf Basis echter Nutzer.",
    tierTitle: "Deine Stufe",
    tierSub: "Sieben Stufen nach Proportionstreue",
    tierNote:
      "Die Gesichter unterscheiden sich nur in den Proportionen, die der Scan misst — Kieferverjüngung, Kinnlänge, Mittelgesichtshöhe. Sie sind keine Attraktivitätsskala.",

    confidential: "Vertraulich",
    status: "Status",
    faceDetected: "Gesicht erkannt",
    scanId: "Scan-ID",
    scanDate: "Datum",
    detailed: "Detaillierte Analyse",
    notMeasured: "Nicht messbar",
    strengthsTitle: "Deine Stärken",
    optimizeTitle: "Optimierungs­potenzial",
    potential: "Potenzial Score",
    potentialBody:
      "Erreichbar, wenn die beeinflussbaren Messwerte auf ihrem Referenzwert lägen.",
    potentialWhat:
      "Kein geschätzter Wert: derselbe Score, neu gerechnet mit jedem Messwert auf seinem Referenzwert, den Verhalten, Pflege, Haltung oder die Aufnahme selbst tatsächlich bewegen. Knochen bleibt, wo er ist — die Differenz kommt ausschließlich aus dem, was du beeinflussen kannst.",
    tipTitle: "Tipp für dich",
    tipBody:
      "Konsistenz ist der Schlüssel. Kleine tägliche Verbesserungen führen zu großen Ergebnissen.",
    moreTips: "Mehr Tipps",
    tabsLabel: "Report-Navigation",
    tabs: {
      result: "Ergebnis",
      analysis: "Analyse",
      tips: "Tipps",
      history: "Verlauf",
    },
    historyBody:
      "Dieser Scan ist der einzige, den es gibt. Deine Fotos und Messwerte liegen nur in diesem Browser-Tab und werden beim Ablauf der Sitzung verworfen — deshalb kann hier nichts Älteres stehen.",
    newScan: "Neuer Scan",
    // ­ is a SOFT HYPHEN: invisible until the word has to break, then it
    // becomes a hyphen at exactly this point. German compounds have no space
    // to wrap at, and an analysis tile is ~48px of label column, so without
    // these the browser breaks mid-syllable — "Symmetri / e", "Augenber /
    // eich". `hyphens: auto` is the proper mechanism and is set on the label,
    // but it depends on the engine shipping a German hyphenation dictionary
    // and plenty do not, so the breaks are placed here rather than hoped for.
    modules: {
      symmetry: "Sym­metrie",
      eyes: "Augen­bereich",
      jaw: "Kiefer­linie",
      proportions: "Propor­tionen",
      nose: "Nasen­form",
      lips: "Lippen",
      skin: "Haut­qualität",
      faceShape: "Gesichts­form",
      midface: "Mittel­gesicht",
    },
  },
  checkout: {
    eyebrow: "Einmalige Freischaltung",
    choosePlan: "Wähle deinen Plan",
    continueToPayment: "Weiter zur Zahlung",
    popular: "Am vollständigsten",
    product: "Vollständige biometrische Analyse",
    once: "einmalig · kein Abo",
    features: [
      "Alle 15 biometrischen Messwerte freigeschaltet",
      "Symmetrie, Lidachse & Kieferlinie in exakten Zahlen",
      "Personalisierter Aktionsplan",
      "Lebenslanger Zugriff — Einmalzahlung",
    ],
    emailPlaceholder: "E-Mail für deine Rechnung",
    cardNote: "Kartendaten werden auf der Zahlungsseite eingegeben",
    pay: "{price} zahlen & freischalten",
    processing: "Wird verarbeitet…",
    secure: "Verschlüsselter Checkout",
    noCardData: "Kartendaten erreichen unsere Server nie",
    mockWarning:
      "Entwicklungsversion — dies ist ein Checkout-Mock. Es wird keine Zahlung eingezogen und keine Kartendaten erfasst. Vor dem Launch Stripe anbinden.",
    close: "Checkout schließen",
  },
  report: {
    title: "KI-Tiefenanalyse",
    body: "Dein vollständiger Report wird von Claude Vision aus deinen beiden Fotos, deinen Messwerten und deinen Quiz-Antworten erstellt.",
    consent:
      "Ich bin damit einverstanden, dass meine beiden Fotos einmalig und verschlüsselt zur KI-Verarbeitung übertragen werden, um diesen Report zu erstellen. Sie werden nach der Verarbeitung nicht auf dem Server gespeichert.",
    generate: "Vollständigen Report erstellen",
    generating: "Dein Report wird erstellt…",
    oneTime: "Einmalige Übertragung, nichts wird gespeichert",
    errNoPhotos:
      "Deine Fotos sind nicht mehr in dieser Browser-Sitzung (sie werden nie gespeichert). Starte einen neuen Scan, um den Report zu erstellen.",
    errNetwork: "Netzwerkfehler — bitte versuch es erneut.",
  },
  auth: {
    title: "Analyse sichern",
    sub: "Gib deine E-Mail ein, wir schicken dir einen sechsstelligen Code. Kein Passwort zu merken, und mehr erfassen wir nicht.",
    emailPlaceholder: "du@beispiel.de",
    sendCode: "Code senden",
    sending: "Wird gesendet…",
    codeTitle: "Schau in dein Postfach",
    codeSub: "Wir haben einen sechsstelligen Code an {email} geschickt. Er läuft in 10 Minuten ab.",
    verify: "Bestätigen",
    verifying: "Wird geprüft…",
    resend: "Neuen Code senden",
    resendIn: "Neuer Code in {s} s",
    changeEmail: "Andere Adresse verwenden",
    devHint: "Entwicklungsmodus: kein Mail-Anbieter konfiguriert, der Code steht in der Server-Konsole.",
    privacy: "Deine E-Mail dient der Anmeldung und dem Beleg. Mehr nicht.",
    errors: {
      invalidEmail: "Das sieht nicht nach einer E-Mail-Adresse aus.",
      cooldown: "Kurz warten, bevor du einen neuen Code anforderst.",
      rateLimited: "Zu viele Codes angefordert. Versuch es in ein paar Minuten erneut.",
      unconfigured: "Der Mail-Versand ist noch nicht eingerichtet. RESEND_API_KEY setzen.",
      failed: "Der Code konnte nicht gesendet werden. Bitte erneut versuchen.",
      wrongCode: "Der Code stimmt nicht. Noch {n} Versuche.",
      expired: "Der Code ist abgelaufen. Fordere einen neuen an.",
      locked: "Zu viele Fehlversuche. Fordere einen neuen Code an.",
    },
  },
  pay: {
    summaryTitle: "Bestellübersicht",
    net: "Nettobetrag",
    vat: "zzgl. {rate} % MwSt.",
    shipping: "Versandkosten",
    shippingFree: "Entfällt — digitales Produkt",
    total: "Gesamtbetrag",
    inclVat: "inkl. {rate} % MwSt.",
    terms: "Ich akzeptiere die {terms} und habe die {privacy} zur Kenntnis genommen.",
    termsLink: "AGB",
    privacyLink: "Datenschutzerklärung",
    withdrawal:
      "Ich verlange ausdrücklich, dass mit der Ausführung vor Ende der Widerrufsfrist begonnen wird. Mir ist bekannt, dass mein {withdrawal} mit vollständiger Vertragserfüllung erlischt.",
    withdrawalLink: "Widerrufsrecht",
    mustAccept: "Bitte bestätige beide Punkte, um fortzufahren.",
    orderButton: "Jetzt zahlungspflichtig bestellen",
    processing: "Zahlung wird verarbeitet…",
    confirming: "Zahlung wird bestätigt…",
    succeeded: "Zahlung erfolgreich — deine Analyse wird freigeschaltet.",
    expressOr: "oder mit Karte bezahlen",
    securedBy: "Zahlungsabwicklung über Stripe. Kartendaten erreichen unsere Server nie.",
    unconfigured: "Die Zahlungsabwicklung ist noch nicht eingerichtet.",
    errors: {
      declined: "Deine Bank hat die Zahlung abgelehnt. Versuch eine andere Karte oder frag bei deiner Bank nach.",
      insufficientFunds: "Die Karte hat nicht genug Deckung. Bitte eine andere Zahlungsart wählen.",
      expiredCard: "Diese Karte ist abgelaufen. Bitte prüf das Ablaufdatum.",
      incorrectCvc: "Die Prüfnummer stimmt nicht. Sie steht auf der Rückseite der Karte.",
      processingError: "Bei der Verarbeitung ist etwas schiefgelaufen. Es wurde nichts abgebucht — bitte erneut versuchen.",
      authRequired: "Deine Bank verlangt eine zusätzliche Bestätigung. Bitte schließ sie ab.",
      network: "Verbindungsproblem. Es wurde nichts abgebucht — bitte erneut versuchen.",
      generic: "Die Zahlung konnte nicht abgeschlossen werden. Es wurde nichts abgebucht.",
      timeout: "Die Zahlung ist durch, die Freischaltung dauert noch einen Moment. Lade die Seite in ein paar Sekunden neu.",
    },
  },
  quality: {
    label: "Messgüte",
    low: "Geringe Aufnahmequalität — das Ergebnis ist unsicherer als üblich. Ein schärferes, frontales Foto bei gleichmäßigem Licht schärft es nach.",
    issues: {
      motionBlur: "Bewegungsunschärfe",
      blurry: "unscharf",
      underexposed: "zu dunkel",
      overexposed: "zu hell",
      noisy: "verrauscht",
      colorCast: "Farbstich",
      lowResolution: "zu geringe Auflösung",
      notFrontal: "Kopf gedreht",
      occluded: "Gesicht teils verdeckt",
    },
  },
  navAccount: "Konto",
  navAdmin: "Admin",
  account: {
    title: "Dein Konto",
    loading: "Wird geladen…",
    signedOutBody:
      "Melde dich mit deiner E-Mail an. Deine Scans und Käufe liegen unter dieser Adresse — ohne Passwort, wir schicken dir einen Code.",
    signIn: "Anmelden",
    signOut: "Abmelden",
    savedBody:
      "Dieser Scan ist unter deiner E-Mail gespeichert. Dort findest du auch deine Zahlungen.",
    teaserBody:
      "Mit einem Konto bleiben deine Scans erhalten und du siehst deine Zahlungen.",
    scansTitle: "Deine Scans",
    noScans:
      "Noch keine gespeicherten Scans. Ein Scan wird hier abgelegt, sobald du ihn freigeschaltet hast — vorher verlässt er deinen Browser nicht.",
    paymentsTitle: "Zahlungen",
    noPayments: "Noch keine Zahlungen.",
    newScan: "Neuen Scan starten",
  },
  products: {
    title: "Passend zu deinem Ergebnis",
    topBadge: "Top-Empfehlung für dich",
    othersTitle: "Weitere passende Produkte",
    cta: "Auf {host} ansehen",
    ctaGeneric: "Produkt ansehen",
    matchedFor: "Passt zu",
    priceNote: "Preis kann abweichen",
    disclosure:
      "Anzeige · Affiliate-Links. Kaufst du über einen dieser Links, erhalten wir eine Provision vom Händler. Für dich ändert das den Preis nicht. Die Auswahl richtet sich nach deinen Messwerten, nicht nach der Höhe der Provision.",
  },
  admin: {
    title: "Produkte",
    productsLabel: "im Katalog",
    newProduct: "Neues Produkt",
    editProduct: "Produkt bearbeiten",
    save: "Speichern",
    saving: "Wird gespeichert…",
    cancel: "Abbrechen",
    edit: "Bearbeiten",
    delete: "Löschen",
    confirmDelete: "Dieses Produkt endgültig löschen?",
    loading: "Wird geladen…",
    empty: "Noch keine Produkte angelegt.",
    inactive: "Inaktiv",
    readOnlyNotice:
      "Der Katalog liegt in deinem Google Sheet. Neue Produkte legst du dort als neue Zeile an — Änderungen erscheinen hier nach kurzer Zeit.",
    openSheet: "Sheet öffnen",
    columnsLabel: "Spalten in dieser Reihenfolge (erste Zeile)",
    backingSheets: "Google Sheets",
    memoryWarning:
      "Kein Upstash konfiguriert — der Katalog liegt nur im Arbeitsspeicher dieser Instanz und ist beim nächsten Kaltstart weg. Für dauerhafte Produkte KV_REST_API_URL und KV_REST_API_TOKEN setzen.",
    fieldTitle: "Titel",
    fieldDescription: "Beschreibung",
    fieldPrice: "Preis",
    priceHint: "Freitext, genau wie beim Händler — wird als Richtwert angezeigt.",
    fieldImage: "Bild-URL",
    pickImage: "Bild auswählen",
    replaceImage: "Ersetzen",
    removeImage: "Entfernen",
    uploading: "Wird hochgeladen…",
    uploadFailed: "Upload fehlgeschlagen.",
    uploadNotImage: "Das ist kein Bild.",
    uploadUnavailable:
      "Bild-Upload ist noch nicht eingerichtet — trag solange die Bild-Adresse ein. (Vercel → Storage → Blob anlegen und mit dem Projekt verbinden.)",
    fieldLink: "Affiliate-Link",
    fieldTags: "Passt zu welchen Problemen?",
    tagsHint:
      "Mindestens eins. Ohne Treffer bei den Werten des Nutzers wird das Produkt nie ausgespielt.",
    fieldActive: "Status",
    activeHint: "Aktiv (wird ausgespielt)",
  },
  session: {
    notice:
      "Private Sitzung — deine Fotos und dein Scan liegen nur in diesem Browser und werden verworfen in",
  },
  status: {
    in: "Im Referenzbereich",
    below: "Unter Referenzbereich",
    above: "Über Referenzbereich",
  },
  statusShort: { in: "Im Bereich", below: "Darunter", above: "Darüber" },
  categories: {
    eyes: {
      label: "Augenpartie",
      blurb: "Neigung, Abstand und Öffnung — der aussagekräftigste Bereich im Gesicht.",
    },
    jaw: {
      label: "Kiefer & Kinn",
      blurb: "Struktur des unteren Drittels. Reagiert am stärksten auf Körperfett.",
    },
    proportions: {
      label: "Proportionen",
      blurb: "Wie sich das Gesicht senkrecht und waagerecht aufteilt.",
    },
    midface: {
      label: "Nase & Mund",
      blurb: "Verhältnisse im mittleren Drittel und Lippenbalance.",
    },
  },
  metrics: {
    canthalTilt: {
      label: "Lidachsenwinkel",
      note: "Winkel vom inneren zum äußeren Augenwinkel. Positiv heißt: der äußere Winkel liegt höher.",
    },
    esr: {
      label: "Augenabstands-Verhältnis",
      note: "Abstand der inneren Augenwinkel im Verhältnis zur Gesichtsbreite. Der neoklassische Kanon liegt bei etwa 0,45.",
    },
    eyeAspect: {
      label: "Lidspaltenöffnung",
      note: "Höhe der Augenöffnung im Verhältnis zur Breite. Niedrige Werte können schlicht heißen, dass du geblinzelt hast — dann neu aufnehmen.",
    },
    browPosition: {
      label: "Brauenposition",
      note: "Abstand Braue zu Lid, in Augenhöhen. Niedriger wirkt kapuzenartiger und tiefer gesetzt.",
    },
    gonialAngle: {
      label: "Kieferkontur-Winkel",
      note: "Oberflächenwinkel vom Jochbein über den Kiefer zum Kinn — eine Näherung für die Schärfe der Kieferlinie, nicht der kephalometrische Kieferwinkel. Körperfett überdeckt das stark.",
    },
    jawWidth: {
      label: "Kiefer-zu-Wangen-Breite",
      note: "Kieferbreite im Verhältnis zur Jochbeinbreite. Zu hoch verliert die Verjüngung, zu niedrig wirkt schmal.",
    },
    chinRatio: {
      label: "Kinn zu Philtrum",
      note: "Kinnhöhe gegen das Philtrum. Der klassische Zielwert liegt bei etwa zwei zu eins.",
    },
    thirds: {
      label: "Gesichtsdrittel",
      note: "Wie gleichmäßig sich das Gesicht in oberes, mittleres und unteres Drittel teilt. Weniger Abweichung ist näher am Kanon.",
    },
    fifths: {
      label: "Gesichtsfünftel",
      note: "Gesichtsbreite in Augenbreiten. Der Kanon teilt das Gesicht in fünf gleiche senkrechte Fünftel.",
    },
    fwhr: {
      label: "fWHR",
      note: "Verhältnis von Gesichtsbreite zu -höhe — der meistuntersuchte Einzelwert der Gesichtsmorphologie.",
    },
    facialIndex: {
      label: "Gesichtsindex",
      note: "Gesamthöhe gegen Breite. Höher wirkt lang und schmal, niedriger kurz und breit.",
    },
    mouthNose: {
      label: "Mund-zu-Nasen-Breite",
      note: "Mundbreite in Nasenbreiten. Der klassische Kanon setzt den Mund auf etwa das 1,5-Fache der Nase.",
    },
    noseWidth: {
      label: "Nasenbreite",
      note: "Nasenbreite im Verhältnis zur Gesichtsbreite — eines der klassischen waagerechten Fünftel.",
    },
    lipRatio: {
      label: "Lippenverhältnis",
      note: "Höhe der Unterlippe gegen die Oberlippe. Rund 1,6 : 1 gilt als häufig genannter ästhetischer Zielwert.",
    },
    midface: {
      label: "Mittelgesichts-Verhältnis",
      note: "Abstand Augenlinie zu Lippe gegen den Augenabstand. Kompakte Mittelgesichter werden meist als jugendlicher gelesen.",
    },
  },
  bands: {
    elite: {
      label: "True Adam",
      blurb:
        "Nahezu jeder Messwert liegt mitten in seinem Referenzbereich. Selten — und da bleibt kaum etwas zu korrigieren.",
    },
    emerging: {
      label: "Sub 5",
      blurb:
        "Mehrere Messwerte liegen knapp außerhalb ihres Referenzbereichs. Genau das sind die günstigsten Erfolge in deinem Plan.",
    },
    exceptional: {
      label: "Chad",
      blurb:
        "Spitzenwerte über nahezu alle Messungen. Deine Hebel liegen in der Feinabstimmung, nicht in der Korrektur.",
    },
    strong: {
      label: "HTN",
      blurb:
        "Deutlich über dem Referenzbereich. Ein paar gezielte Anpassungen bringen dich von hier aus weit.",
    },
    solid: {
      label: "MTN",
      blurb: "Gute Ausgangslage mit klarem, machbarem Verbesserungspotenzial.",
    },
    reference: {
      label: "LTN",
      blurb:
        "Genau im Durchschnitt — und genau dort liegen die größten sichtbaren Gewinne.",
    },
    developing: {
      label: "Sub 3",
      blurb:
        "Viel Luft nach oben. Fang oben in deinem Plan an und arbeite dich runter — die ersten Punkte bewegen am meisten.",
    },
  },
  plan: {
    bodyFat: {
      title: "Körperfett Richtung 12–18 % senken",
      detail:
        "Definition im Gesicht ist vor allem eine Körperfett-Frage. Der Weg Richtung 12–18 % bringt deinem Kiefer und deinen Wangenknochen mehr als jedes Gerät oder jeder Trick auf dem Markt.",
      tag: "Kieferlinie",
      cadence: "Dauerhaft",
      short: "Niedrigerer Körperfettanteil",
    },
    guaSha: {
      title: "Gua Sha entlang Kiefer und unter den Augen",
      detail:
        "Zwei Einheiten pro Woche, wenig Öl, sanfte Züge vom Kinn zum Ohr. Es bewegt Lymphflüssigkeit — erwarte einen abschwellenden Effekt für Stunden, keinen Knochenumbau.",
      tag: "Kieferlinie",
      cadence: "2× / Woche",
      short: "Gua Sha für die Kieferlinie",
    },
    tonguePosture: {
      title: "Tägliche Zungenhaltung",
      detail:
        "Zunge vollflächig am Gaumen, Lippen geschlossen, Nasenatmung. Belege für Knochenveränderung bei Erwachsenen sind dünn — behandle es als Haltungsarbeit. Kau gleichmäßig auf beiden Seiten.",
      tag: "Kieferlinie",
      cadence: "Täglich",
      short: "Zungenhaltung korrigieren",
    },
    retinoid: {
      title: "Retinoid abends, 3 Nächte pro Woche",
      detail:
        "Starte mit Adapalen 0,1 % oder Retinol 0,3 % auf trockener Haut nach der Reinigung, Feuchtigkeitspflege darüber. Über 8–12 Wochen auf täglich steigern. Schneller und stärker bringt nur Reizung.",
      tag: "Haut",
      cadence: "3 Nächte / Woche",
      short: "Retinoid-Routine abends",
    },
    spf: {
      title: "LSF 30+ an jedem einzelnen Morgen",
      detail:
        "Die Hautmaßnahme mit dem höchsten Ertrag — und die, die alle auslassen. Sie schützt alles andere, was du tust, auch das Retinoid, das die Haut lichtempfindlich macht.",
      tag: "Haut",
      cadence: "Täglich",
      short: "Täglicher Sonnenschutz",
    },
    asymmetry: {
      title: "Prüfe die Ursachen deiner Asymmetrie",
      detail:
        "Wechsle die Kauseite, schlaf nicht immer auf derselben Wange, und stell die Bildschirmhöhe so ein, dass dein Kopf nicht acht Stunden am Tag geneigt ist. Kleine Hebel — aber die, die du in der Hand hast.",
      tag: "Symmetrie",
      cadence: "Dauerhaft",
      short: "Asymmetrie ausgleichen",
    },
    depuff: {
      title: "Abschwell-Routine für die Augenpartie",
      detail:
        "Abends weniger Salz, mindestens 7,5 Stunden Schlaf, Alkohol maßvoll, und mit leicht erhöhtem Kopf schlafen. Die meisten Beschwerden an der Augenpartie sind Wassereinlagerung, keine Knochenstruktur.",
      tag: "Augen",
      cadence: "Täglich",
      short: "Augenpartie abschwellen",
    },
    proportions: {
      title: "Style um deine Proportionen herum, kämpf nicht dagegen",
      detail:
        "Senkrechte Proportionen sind Knochen und ändern sich nicht. Ein Schnitt mit der richtigen Höhe und eine Bartlinie, die das untere Drittel streckt oder verbreitert, verschieben den Eindruck weit mehr als jede Übung.",
      tag: "Proportionen",
      cadence: "Nächster Termin",
      short: "Frisur an Gesichtsform anpassen",
    },
    hair: {
      title: "Haarausfall: früh handeln, zum Arzt gehen",
      detail:
        "Minoxidil und Finasterid sind die einzigen Mittel mit belastbarer Evidenz, und beide wirken am besten vor sichtbarer Ausdünnung. Vereinbare einen Termin, statt mit Nahrungsergänzung zu experimentieren.",
      tag: "Haar",
      cadence: "Diesen Monat",
      short: "Haaransatz und Styling",
    },
    grooming: {
      title: "Grooming-Termin bei einem guten Barbier",
      detail:
        "Ein Schnitt passend zu deiner Gesichtsform, aufgeräumte statt gezupfter Brauen und eine saubere Bartlinie. Die günstigste, schnellste und sichtbarste Veränderung auf dieser Liste.",
      tag: "Grooming",
      cadence: "Alle 4 Wochen",
      short: "Augenbrauen definieren",
    },
    smoking: {
      title: "Nikotin weglassen",
      detail:
        "Rauchen und Dampfen bauen Kollagen ab und trüben den Ton unter den Augen. Das ist innerhalb weniger Jahre sichtbar und teilweise umkehrbar — nichts sonst auf dieser Liste wird durch Weitermachen so schnell zunichtegemacht.",
      tag: "Haut",
      cadence: "Ab sofort",
      short: "Rauchen reduzieren",
    },
    training: {
      title: "Krafttraining in die Woche bringen",
      detail:
        "Zwei bis drei Einheiten pro Woche sind das Minimum, damit eine Diät hält. Training bewahrt die Muskulatur, die du sonst verlierst — und genau die erhält die Definition an Kiefer und Wangen, für die du abnimmst.",
      tag: "Körper",
      cadence: "3× / Woche",
      short: "Krafttraining aufnehmen",
    },
    sleep: {
      title: "Schlaf ist der Multiplikator",
      detail:
        "7,5–9 Stunden nach festem Rhythmus. Hautregeneration, Flüssigkeitshaushalt und die allgemeine Frische im Gesicht hängen enger am Schlaf als an jedem Produkt in deinem Schrank.",
      tag: "Lebensstil",
      cadence: "Jede Nacht",
      short: "Mehr und besserer Schlaf",
    },
  },
};
