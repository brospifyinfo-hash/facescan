import type { Metadata } from "next";
import { absolute } from "@/lib/seo";
import { Block, LegalPage, List, Section } from "@/components/legal/LegalPage";
import { CONTACT_EMAIL, addressLines, operatorLine } from "@/lib/legal";
import { VISION_ACTIVE } from "@/lib/i18n/privacy";

export const metadata: Metadata = {
  title: "Datenschutzerklärung",
  description:
    "Welche Daten Malook verarbeitet, wohin deine Fotos gehen und welche Rechte du hast.",
  alternates: { canonical: absolute("/privacy") },
};

// Die Datenschutzerklärung liest den Engine-Schalter, statt ihn zu behaupten.
//
// NEXT_PUBLIC_SCORE_ENGINE entscheidet, ob die Fotos den Browser verlassen:
// bei "vision" gehen sie an OpenAI, sonst werden sie ausschließlich lokal
// ausgewertet. Genau dieselbe Konstante steuert schon die Aussagen auf der
// Startseite (lib/i18n/privacy.ts). Eine Datenschutzerklärung, die den
// Übermittlungsabschnitt fest verdrahtet, wird beim nächsten Umschalten
// unwahr — und zwar an der einen Stelle, an der Unwahrheit teuer ist.

const link =
  "text-accent underline underline-offset-2 hover:text-accent-bright";

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Datenschutzerklärung"
      intro="Was mit deinen Daten passiert — und wohin dein Foto geht."
    >
      <Section n={1} title="Verantwortlicher">
        <Block>
          <div>{operatorLine()}</div>
          {addressLines().map((line) => (
            <div key={line}>{line}</div>
          ))}
          <div className="mt-2">
            E-Mail:{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className={link}>
              {CONTACT_EMAIL}
            </a>
          </div>
        </Block>
        <p>
          Einen Datenschutzbeauftragten müssen wir nicht bestellen. Bei Fragen
          zum Datenschutz wende dich an die oben genannte Adresse.
        </p>
      </Section>

      <Section n={2} title="Deine Fotos">
        {VISION_ACTIVE ? (
          <>
            <p>
              Für die Analyse werden deine beiden Fotos{" "}
              <strong className="font-semibold text-[var(--color-ink)]">
                einmalig an OpenAI übertragen
              </strong>{" "}
              (OpenAI Ireland Ltd. bzw. OpenAI, L.L.C., USA). Sie werden dabei
              verkleinert und ohne Namen oder Kontobezug übermittelt. Weder wir
              noch OpenAI speichern sie dauerhaft; eine Verwendung zum Training
              von Modellen findet nicht statt.
            </p>
            <p>
              Das Landmarken-Netz, das du über deinem Foto siehst, wird
              weiterhin ausschließlich in deinem Browser berechnet.
            </p>
          </>
        ) : (
          <p>
            Die Analyse läuft vollständig in deinem Browser. Deine Fotos
            werden nicht hochgeladen und erreichen unsere Server nicht.
          </p>
        )}
        <p>
          Auf unserer Seite liegen die Fotos ausschließlich im Arbeitsspeicher
          deines Browser-Tabs: keine Festplatte, keine Cookies, kein Konto.
          Die Sitzung löscht sich nach 15 Minuten selbst, das Schließen des
          Tabs löscht sie sofort.
        </p>
        <p>
          <strong className="font-semibold text-[var(--color-ink)]">
            Rechtsgrundlage:
          </strong>{" "}
          deine Einwilligung nach Art. 6 Abs. 1 lit. a DSGVO, die du mit dem
          Hochladen erteilst und jederzeit durch Schließen des Tabs
          widerrufen kannst.
        </p>
        <p>
          Wir verwenden die Aufnahmen{" "}
          <strong className="font-semibold text-[var(--color-ink)]">
            nicht zur eindeutigen Identifizierung
          </strong>{" "}
          einer Person. Es findet kein Abgleich mit anderen Aufnahmen, keine
          Wiedererkennung und keine Zusammenführung mit einem Personenprofil
          statt. Ausgewertet werden ausschließlich geometrische Verhältnisse
          für eine ästhetische Einschätzung.
        </p>
      </Section>

      <Section n={3} title="Konto und Anmeldung">
        <p>
          Für einen Kauf und für den Zugriff auf gekaufte Inhalte brauchst du
          ein Konto. Dafür verarbeiten wir deine E-Mail-Adresse und, je nach
          gewähltem Weg, einen per E-Mail versandten Einmalcode, ein von dir
          gesetztes Passwort (nur als Hashwert) oder die Anmeldung über Google.
        </p>
        <p>
          Meldest du dich über Google an, erhalten wir von Google deine
          E-Mail-Adresse und die Bestätigung, dass sie dir gehört. Es gilt
          zusätzlich die Datenschutzerklärung von Google.
        </p>
        <p>
          Nach der Anmeldung setzen wir ein technisch notwendiges,
          signiertes Sitzungs-Cookie. Es enthält deine Adresse und ein
          Ablaufdatum und dient allein dazu, dich wiederzuerkennen.
        </p>
        <p>
          <strong className="font-semibold text-[var(--color-ink)]">
            Rechtsgrundlage:
          </strong>{" "}
          Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung).
        </p>
      </Section>

      <Section n={4} title="Käufe und Zahlung">
        <p>
          Zahlungen wickeln wir über Stripe ab (Stripe Payments Europe Ltd.,
          Irland). Deine Zahlungsdaten — Kartennummer, Wallet-Daten und
          Ähnliches — werden unmittelbar von Stripe erhoben und verarbeitet;
          wir sehen sie nicht und speichern sie nicht.
        </p>
        <p>
          Von uns gespeichert wird, welches Paket zu welcher E-Mail-Adresse
          freigeschaltet wurde, die Kennung des Zahlungsvorgangs, der Betrag
          und der Zeitpunkt. Das ist nötig, damit du deine gekauften Inhalte
          wiederbekommst, und erfüllt zugleich handels- und steuerrechtliche
          Aufbewahrungspflichten.
        </p>
        <p>
          <strong className="font-semibold text-[var(--color-ink)]">
            Rechtsgrundlage:
          </strong>{" "}
          Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) und Art. 6 Abs. 1
          lit. c DSGVO (rechtliche Verpflichtung).
        </p>
      </Section>

      <Section n={5} title="Scan-Verlauf">
        <p>
          Hast du ein Paket gekauft, das einen Verlauf enthält, speichern wir
          zu deiner Adresse die Kennzahlen deiner Scans — also die
          errechneten Werte, nicht die Fotos. So kannst du eine spätere
          Analyse mit einer früheren vergleichen.
        </p>
        <p>
          <strong className="font-semibold text-[var(--color-ink)]">
            Rechtsgrundlage:
          </strong>{" "}
          Art. 6 Abs. 1 lit. b DSGVO.
        </p>
      </Section>

      <Section n={6} title="Support-Anfragen">
        <p>
          Schreibst du uns über das Support-Formular, verarbeiten wir Name,
          E-Mail-Adresse, Betreff und Nachricht, um zu antworten. Zusätzlich
          speichern wir für längstens eine Stunde einen Zählerstand zu deiner
          IP-Adresse, damit das Formular nicht als Massenversender
          missbraucht werden kann.
        </p>
        <p>
          <strong className="font-semibold text-[var(--color-ink)]">
            Rechtsgrundlage:
          </strong>{" "}
          Art. 6 Abs. 1 lit. b DSGVO für die Antwort, Art. 6 Abs. 1 lit. f
          DSGVO für den Missbrauchsschutz.
        </p>
      </Section>

      <Section n={7} title="Empfänger und Dienstleister">
        <p>
          Wir setzen die folgenden Dienstleister ein. Mit ihnen bestehen
          Verträge zur Auftragsverarbeitung; soweit Daten in die USA gelangen,
          stützen wir die Übermittlung auf das EU-US Data Privacy Framework
          bzw. auf Standardvertragsklauseln nach Art. 46 DSGVO.
        </p>
        <List
          items={[
            <>
              <strong className="font-semibold text-[var(--color-ink)]">
                Vercel
              </strong>{" "}
              — Hosting und Auslieferung der Website, inklusive
              Server-Protokollen.
            </>,
            <>
              <strong className="font-semibold text-[var(--color-ink)]">
                Stripe
              </strong>{" "}
              — Zahlungsabwicklung.
            </>,
            <>
              <strong className="font-semibold text-[var(--color-ink)]">
                Resend
              </strong>{" "}
              — Versand von Anmeldecodes, Bestätigungen und Support-Antworten.
            </>,
            <>
              <strong className="font-semibold text-[var(--color-ink)]">
                Google
              </strong>{" "}
              — Anmeldung über Google-Konto sowie Google Tabellen als
              Speicher für Konten, Freischaltungen und Verläufe.
            </>,
            ...(VISION_ACTIVE
              ? [
                  <>
                    <strong className="font-semibold text-[var(--color-ink)]">
                      OpenAI
                    </strong>{" "}
                    — Auswertung der Fotos und Erstellung der Textanalysen.
                  </>,
                ]
              : [
                  <>
                    <strong className="font-semibold text-[var(--color-ink)]">
                      OpenAI
                    </strong>{" "}
                    — Erstellung der Textanalysen aus den bereits berechneten
                    Messwerten. Fotos werden dabei nicht übertragen.
                  </>,
                ]),
          ]}
        />
      </Section>

      <Section n={8} title="Server-Protokolle">
        <p>
          Beim Aufruf der Website fallen beim Hoster technische Protokolldaten
          an: IP-Adresse, Zeitpunkt, aufgerufene Adresse, übermittelter
          Browsertyp. Sie dienen dem sicheren Betrieb und der Fehlersuche.
        </p>
        <p>
          <strong className="font-semibold text-[var(--color-ink)]">
            Rechtsgrundlage:
          </strong>{" "}
          Art. 6 Abs. 1 lit. f DSGVO.
        </p>
      </Section>

      <Section n={9} title="Cookies">
        <p>
          Wir setzen keine Cookies zu Werbe- oder Analysezwecken und binden
          keine Tracker ein. Gesetzt werden ausschließlich technisch
          notwendige Cookies: das Sitzungs-Cookie nach der Anmeldung, ein
          Cookie für den Partnerbereich, wenn du über einen Partnerlink
          gekommen bist, sowie ein Cookie für den Verwaltungszugang der
          Betreiber. Deine Sprachwahl liegt lokal in deinem Browser und wird
          nicht übertragen.
        </p>
      </Section>

      <Section n={10} title="Speicherdauer">
        <List
          items={[
            "Fotos und Scan-Ergebnisse der laufenden Sitzung: 15 Minuten im Browser, danach automatisch gelöscht.",
            "Anmeldecodes: wenige Minuten.",
            "Konto und Freischaltungen: bis zur Löschung des Kontos.",
            "Zahlungsbelege: bis zum Ablauf der handels- und steuerrechtlichen Aufbewahrungsfristen.",
            "Support-Nachrichten: bis die Anfrage abschließend bearbeitet ist.",
          ]}
        />
      </Section>

      <Section n={11} title="Deine Rechte">
        <p>Du hast jederzeit das Recht auf</p>
        <List
          items={[
            "Auskunft über die zu dir gespeicherten Daten (Art. 15 DSGVO),",
            "Berichtigung unrichtiger Daten (Art. 16 DSGVO),",
            "Löschung (Art. 17 DSGVO),",
            "Einschränkung der Verarbeitung (Art. 18 DSGVO),",
            "Datenübertragbarkeit (Art. 20 DSGVO),",
            "Widerspruch gegen Verarbeitungen auf Grundlage berechtigter Interessen (Art. 21 DSGVO).",
          ]}
        />
        <p>
          Eine erteilte Einwilligung kannst du jederzeit mit Wirkung für die
          Zukunft widerrufen. Für alle Anliegen genügt eine Nachricht an{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className={link}>
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </Section>

      <Section n={12} title="Beschwerderecht">
        <p>
          Du kannst dich bei einer Datenschutz-Aufsichtsbehörde beschweren.
          Für uns zuständig ist das Bayerische Landesamt für
          Datenschutzaufsicht (BayLDA), Promenade 27, 91522 Ansbach.
        </p>
      </Section>

      <Section n={13} title="Keine automatisierte Entscheidung im Rechtssinne">
        <p>
          Die Auswertung wird maschinell erstellt, entfaltet dir gegenüber
          aber keine rechtliche Wirkung und beeinträchtigt dich nicht in
          ähnlicher Weise erheblich im Sinne von Art. 22 DSGVO. Sie ist eine
          ästhetische Einschätzung und keine Entscheidung über dich.
        </p>
      </Section>
    </LegalPage>
  );
}
