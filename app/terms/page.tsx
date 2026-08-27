import type { Metadata } from "next";
import { absolute } from "@/lib/seo";
import { LegalPage, List, Section } from "@/components/legal/LegalPage";
import { CONTACT_EMAIL, addressLines, operatorLine } from "@/lib/legal";

export const metadata: Metadata = {
  title: "AGB",
  description:
    "Allgemeine Geschäftsbedingungen für die Nutzung von Malook und den Kauf der Analysepakete.",
  alternates: { canonical: absolute("/terms") },
};

const link =
  "text-accent underline underline-offset-2 hover:text-accent-bright";

export default function TermsPage() {
  return (
    <LegalPage
      title="Allgemeine Geschäftsbedingungen"
      intro="Für alle Verträge zwischen dir und den Betreibern von Malook."
    >
      <Section n={1} title="Geltungsbereich und Vertragspartner">
        <p>
          Diese Bedingungen gelten für die Nutzung von Malook und für jeden
          Kauf eines Analysepakets über diese Website. Vertragspartner sind{" "}
          {operatorLine()}, {addressLines().join(", ")} (nachfolgend „wir"),
          und du als Nutzerin oder Nutzer.
        </p>
        <p>
          Abweichende Bedingungen erkennen wir nicht an, es sei denn, wir
          haben ihnen ausdrücklich zugestimmt.
        </p>
      </Section>

      <Section n={2} title="Mindestalter">
        <p>
          Für die Nutzung und insbesondere für einen kostenpflichtigen Kauf
          musst du mindestens 18 Jahre alt sein. Bist du jünger, darfst du
          Malook nur mit Einwilligung deiner Erziehungsberechtigten nutzen und
          nur mit deren Zustimmung ein Paket kaufen.
        </p>
      </Section>

      <Section n={3} title="Leistungsbeschreibung">
        <p>
          Malook erstellt aus zwei von dir hochgeladenen Fotos eine
          automatisierte Auswertung von Gesichtsproportionen: Messwerte,
          eine Gesamtbewertung und — je nach gekauftem Paket — daraus
          abgeleitete Empfehlungen, Pläne und Darstellungen.
        </p>
        <p>
          Die Auswertung ist eine{" "}
          <strong className="font-semibold text-[var(--color-ink)]">
            ästhetische Einschätzung durch ein Rechenmodell
          </strong>
          . Sie ist keine medizinische, psychologische, therapeutische oder
          sonstige fachliche Beratung, stellt keine Diagnose dar und ersetzt
          keine ärztliche Konsultation. Ergebnisse sind Näherungen und können
          je nach Aufnahme abweichen. Einen bestimmten Score, ein bestimmtes
          Ergebnis oder eine bestimmte Wirkung schulden wir nicht.
        </p>
      </Section>

      <Section n={4} title="Kostenlose Nutzung und kostenpflichtige Pakete">
        <p>
          Der Scan und die Grundauswertung sind kostenlos. Weitergehende
          Inhalte sind kostenpflichtig und werden in drei Paketen angeboten,
          die sich im Umfang unterscheiden. Welche Inhalte ein Paket enthält,
          wird vor dem Kauf im Auswahlschritt angezeigt.
        </p>
        <p>
          Es handelt sich jeweils um eine{" "}
          <strong className="font-semibold text-[var(--color-ink)]">
            einmalige Zahlung ohne Abonnement
          </strong>
          . Es entsteht keine Verlängerung und keine wiederkehrende Belastung.
        </p>
      </Section>

      <Section n={5} title="Vertragsschluss">
        <p>
          Die Darstellung der Pakete ist kein bindendes Angebot, sondern eine
          Aufforderung zur Bestellung. Durch Anklicken der Schaltfläche „Jetzt
          zahlungspflichtig bestellen" gibst du ein verbindliches Angebot ab.
          Der Vertrag kommt zustande, sobald wir die Zahlung bestätigen und
          die gekauften Inhalte freischalten.
        </p>
        <p>
          Der Vertragstext wird von uns nicht gesondert gespeichert und ist
          nach Abschluss nicht mehr über die Website abrufbar. Diese
          Bedingungen kannst du jederzeit auf dieser Seite abrufen und
          speichern.
        </p>
      </Section>

      <Section n={6} title="Preise und Zahlung">
        <p>
          Alle Preise sind Endpreise und verstehen sich einschließlich der
          gesetzlichen Umsatzsteuer. Zusätzliche Versand- oder Lieferkosten
          fallen nicht an, weil die Leistung digital erbracht wird.
        </p>
        <p>
          Die Zahlung wird über Stripe abgewickelt. Je nach Verfügbarkeit
          stehen Karte, digitale Geldbörsen und weitere von Stripe angebotene
          Verfahren zur Verfügung. Es gelten ergänzend die Bedingungen des
          Zahlungsdienstleisters.
        </p>
      </Section>

      <Section n={7} title="Bereitstellung">
        <p>
          Die gekauften Inhalte werden unmittelbar nach erfolgreicher Zahlung
          freigeschaltet. Bei Zahlarten, die erst später endgültig bestätigt
          werden, erfolgt die Freischaltung mit der Bestätigung durch den
          Zahlungsdienstleister.
        </p>
        <p>
          Die Freischaltung ist an die E-Mail-Adresse gebunden, mit der du
          angemeldet warst. Meldest du dich später erneut mit derselben
          Adresse an, stehen die gekauften Inhalte wieder zur Verfügung.
        </p>
      </Section>

      <Section n={8} title="Widerrufsrecht">
        <p>
          Verbraucherinnen und Verbrauchern steht ein gesetzliches
          Widerrufsrecht zu. Einzelheiten, die Bedingungen für sein
          vorzeitiges Erlöschen bei digitalen Inhalten und das
          Muster-Widerrufsformular findest du in unserer{" "}
          <a href="/withdrawal" className={link}>
            Widerrufsbelehrung
          </a>
          .
        </p>
      </Section>

      <Section n={9} title="Deine Fotos">
        <p>
          Du versicherst, dass du die hochgeladenen Fotos verwenden darfst und
          dass sie dich selbst zeigen oder du die Einwilligung der abgebildeten
          Person hast. Wie deine Fotos verarbeitet werden und wohin sie dabei
          übertragen werden, steht in unserer{" "}
          <a href="/privacy" className={link}>
            Datenschutzerklärung
          </a>
          .
        </p>
      </Section>

      <Section n={10} title="Nutzungsrechte">
        <p>
          Die erstellten Auswertungen darfst du privat nutzen, speichern und
          weitergeben. Nicht gestattet ist es,
        </p>
        <List
          items={[
            "die Inhalte gewerblich weiterzuverkaufen oder als eigene Leistung anzubieten,",
            "die Website oder ihre Schnittstellen automatisiert auszulesen oder massenhaft abzufragen,",
            "Schutzmaßnahmen zu umgehen, um kostenpflichtige Inhalte ohne Kauf zu nutzen.",
          ]}
        />
      </Section>

      <Section n={11} title="Verfügbarkeit">
        <p>
          Wir bemühen uns um einen durchgehenden Betrieb, schulden aber keine
          bestimmte Verfügbarkeit. Wartungsarbeiten, Störungen bei
          Dienstleistern und Umstände außerhalb unseres Einflussbereichs
          können zu Unterbrechungen führen.
        </p>
      </Section>

      <Section n={12} title="Haftung">
        <p>
          Wir haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit, bei
          Verletzung von Leben, Körper oder Gesundheit, bei arglistig
          verschwiegenen Mängeln sowie nach dem Produkthaftungsgesetz.
        </p>
        <p>
          Bei einfacher Fahrlässigkeit haften wir nur bei Verletzung einer
          wesentlichen Vertragspflicht, also einer Pflicht, deren Erfüllung
          die ordnungsgemäße Durchführung des Vertrags überhaupt erst
          ermöglicht und auf deren Einhaltung du regelmäßig vertrauen darfst.
          In diesem Fall ist die Haftung auf den vertragstypischen,
          vorhersehbaren Schaden begrenzt.
        </p>
        <p>
          Für Entscheidungen, die du auf Grundlage einer Auswertung triffst,
          haften wir nicht. Die Auswertung ist eine maschinelle Einschätzung
          und keine fachliche Empfehlung.
        </p>
      </Section>

      <Section n={13} title="Änderungen dieser Bedingungen">
        <p>
          Wir können diese Bedingungen für künftige Verträge ändern. Für einen
          bereits geschlossenen Vertrag gilt die Fassung, die beim
          Vertragsschluss galt.
        </p>
      </Section>

      <Section n={14} title="Schlussbestimmungen">
        <p>
          Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss
          des UN-Kaufrechts. Zwingende Verbraucherschutzvorschriften des
          Staates, in dem du deinen gewöhnlichen Aufenthalt hast, bleiben
          davon unberührt.
        </p>
        <p>
          Sollte eine Bestimmung unwirksam sein, bleibt der übrige Vertrag
          wirksam.
        </p>
        <p>
          Fragen zu diesen Bedingungen beantworten wir unter{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className={link}>
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </Section>
    </LegalPage>
  );
}
