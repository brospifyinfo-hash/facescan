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
    disclaimer:
      "FaceScan liefert geometrische Schätzwerte zur Orientierung bei der Selbstoptimierung. Es ist kein Medizinprodukt, und kein Ergebnis stellt eine medizinische oder dermatologische Beurteilung dar.",
  },
  quiz: {
    progress: "Frage {n} von {total}",
    back: "Zurück",
    home: "Startseite",
    minorTitle: "FaceScan ist ab 18",
    minorBody:
      "Deine Gesichtsstruktur verändert sich noch — jeder Wert, den wir dir heute geben, wäre in einem Jahr falsch. Und wir analysieren aus Prinzip keine Gesichter von Minderjährigen. Komm wieder, wenn du 18 bist.",
    minorCta: "Zurück zum Start",
    questions: [
      {
        title: "Wie sollen wir deinen Scan kalibrieren?",
        sub: "Die Referenzbereiche unterscheiden sich — das setzt die richtige Basis.",
        options: ["Männlich", "Weiblich"],
      },
      { title: "Wie alt bist du?", options: ["Unter 18", "18–24", "25–34", "35+"] },
      {
        title: "Was stört dich an deinem Gesicht am meisten?",
        options: ["Asymmetrie", "Schwache Kieferlinie", "Augenpartie", "Hautbild", "Dünner werdendes Haar"],
      },
      {
        title: "Geschätzter Körperfettanteil?",
        sub: "Die Definition im Gesicht hängt stark am Körperfett.",
        options: ["Unter 12 %", "12–18 %", "19–25 %", "Über 25 %", "Weiß ich nicht"],
      },
      {
        title: "Trainierst du Zungenhaltung (Mewing)?",
        options: ["Nie", "Manchmal", "Täglich"],
      },
      {
        title: "Was ist dein eigentliches Ziel?",
        options: ["Model-Niveau", "Selbstbewusstsein beim Daten", "Allgemeine Selbstoptimierung", "Nur neugierig"],
      },
    ],
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
    overall: "Gesamtwert",
    outOf: "von 10",
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
  },
  checkout: {
    eyebrow: "Einmalige Freischaltung",
    product: "Vollständige biometrische Analyse",
    once: "einmalig · kein Abo",
    features: [
      "Alle 16 biometrischen Messwerte freigeschaltet",
      "Symmetrie, Lidachse & Kieferlinie in exakten Zahlen",
      "Personalisierter Glow-Up-Aktionsplan",
      "KI-Tiefenanalyse aus deinen Fotos",
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
    },
    guaSha: {
      title: "Gua Sha entlang Kiefer und unter den Augen",
      detail:
        "Zwei Einheiten pro Woche, wenig Öl, sanfte Züge vom Kinn zum Ohr. Es bewegt Lymphflüssigkeit — erwarte einen abschwellenden Effekt für Stunden, keinen Knochenumbau.",
      tag: "Kieferlinie",
      cadence: "2× / Woche",
    },
    tonguePosture: {
      title: "Tägliche Zungenhaltung",
      detail:
        "Zunge vollflächig am Gaumen, Lippen geschlossen, Nasenatmung. Belege für Knochenveränderung bei Erwachsenen sind dünn — behandle es als Haltungsarbeit. Kau gleichmäßig auf beiden Seiten.",
      tag: "Kieferlinie",
      cadence: "Täglich",
    },
    retinoid: {
      title: "Retinoid abends, 3 Nächte pro Woche",
      detail:
        "Starte mit Adapalen 0,1 % oder Retinol 0,3 % auf trockener Haut nach der Reinigung, Feuchtigkeitspflege darüber. Über 8–12 Wochen auf täglich steigern. Schneller und stärker bringt nur Reizung.",
      tag: "Haut",
      cadence: "3 Nächte / Woche",
    },
    spf: {
      title: "LSF 30+ an jedem einzelnen Morgen",
      detail:
        "Die Hautmaßnahme mit dem höchsten Ertrag — und die, die alle auslassen. Sie schützt alles andere, was du tust, auch das Retinoid, das die Haut lichtempfindlich macht.",
      tag: "Haut",
      cadence: "Täglich",
    },
    asymmetry: {
      title: "Prüfe die Ursachen deiner Asymmetrie",
      detail:
        "Wechsle die Kauseite, schlaf nicht immer auf derselben Wange, und stell die Bildschirmhöhe so ein, dass dein Kopf nicht acht Stunden am Tag geneigt ist. Kleine Hebel — aber die, die du in der Hand hast.",
      tag: "Symmetrie",
      cadence: "Dauerhaft",
    },
    depuff: {
      title: "Abschwell-Routine für die Augenpartie",
      detail:
        "Abends weniger Salz, mindestens 7,5 Stunden Schlaf, Alkohol maßvoll, und mit leicht erhöhtem Kopf schlafen. Die meisten Beschwerden an der Augenpartie sind Wassereinlagerung, keine Knochenstruktur.",
      tag: "Augen",
      cadence: "Täglich",
    },
    proportions: {
      title: "Style um deine Proportionen herum, kämpf nicht dagegen",
      detail:
        "Senkrechte Proportionen sind Knochen und ändern sich nicht. Ein Schnitt mit der richtigen Höhe und eine Bartlinie, die das untere Drittel streckt oder verbreitert, verschieben den Eindruck weit mehr als jede Übung.",
      tag: "Proportionen",
      cadence: "Nächster Termin",
    },
    hair: {
      title: "Haarausfall: früh handeln, zum Arzt gehen",
      detail:
        "Minoxidil und Finasterid sind die einzigen Mittel mit belastbarer Evidenz, und beide wirken am besten vor sichtbarer Ausdünnung. Vereinbare einen Termin, statt mit Nahrungsergänzung zu experimentieren.",
      tag: "Haar",
      cadence: "Diesen Monat",
    },
    grooming: {
      title: "Grooming-Termin bei einem guten Barbier",
      detail:
        "Ein Schnitt passend zu deiner Gesichtsform, aufgeräumte statt gezupfter Brauen und eine saubere Bartlinie. Die günstigste, schnellste und sichtbarste Veränderung auf dieser Liste.",
      tag: "Grooming",
      cadence: "Alle 4 Wochen",
    },
    sleep: {
      title: "Schlaf ist der Multiplikator",
      detail:
        "7,5–9 Stunden nach festem Rhythmus. Hautregeneration, Flüssigkeitshaushalt und die allgemeine Frische im Gesicht hängen enger am Schlaf als an jedem Produkt in deinem Schrank.",
      tag: "Lebensstil",
      cadence: "Jede Nacht",
    },
  },
};
