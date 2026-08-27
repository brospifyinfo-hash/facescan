import type { Metadata } from "next";
import { absolute } from "@/lib/seo";
import { Block, LegalPage, Section } from "@/components/legal/LegalPage";
import {
  ADDRESS,
  CONTACT_EMAIL,
  OPERATORS,
  VAT_ID,
  addressLines,
  operatorLine,
} from "@/lib/legal";

export const metadata: Metadata = {
  title: "Impressum",
  description: "Anbieterkennzeichnung nach §5 DDG.",
  alternates: { canonical: absolute("/impressum") },
  robots: { index: true, follow: true },
};

export default function ImpressumPage() {
  return (
    <LegalPage
      title="Impressum"
      intro="Angaben gemäß §5 Digitale-Dienste-Gesetz (DDG)."
    >
      <Section title="Anbieter">
        <Block>
          {OPERATORS.map((name) => (
            <div key={name}>{name}</div>
          ))}
          {addressLines().map((line) => (
            <div key={line}>{line}</div>
          ))}
        </Block>
        <p>
          Malook wird von {operatorLine()} gemeinschaftlich betrieben. Beide
          sind gemeinsam vertretungsberechtigt.
        </p>
      </Section>

      <Section title="Kontakt">
        <p>
          E-Mail:{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-accent underline underline-offset-2 hover:text-accent-bright"
          >
            {CONTACT_EMAIL}
          </a>
        </p>
        <p>
          Für Anfragen zu Analysen, Zahlungen oder deinem Konto steht das{" "}
          <a
            href="/support"
            className="text-accent underline underline-offset-2 hover:text-accent-bright"
          >
            Support-Formular
          </a>{" "}
          zur Verfügung. Wir antworten per E-Mail.
        </p>
      </Section>

      <Section title="Umsatzsteuer">
        {VAT_ID ? (
          <p>
            Umsatzsteuer-Identifikationsnummer gemäß §27a Umsatzsteuergesetz:{" "}
            {VAT_ID}
          </p>
        ) : (
          <p>
            Eine Umsatzsteuer-Identifikationsnummer nach §27a
            Umsatzsteuergesetz wird derzeit nicht geführt.
          </p>
        )}
      </Section>

      <Section title="Verantwortlich für den Inhalt">
        <p>
          {operatorLine()}, Anschrift wie oben.
        </p>
      </Section>

      <Section title="Verbraucherstreitbeilegung">
        <p>
          Wir sind nicht bereit und nicht verpflichtet, an
          Streitbeilegungsverfahren vor einer
          Verbraucherschlichtungsstelle teilzunehmen (§36
          Verbraucherstreitbeilegungsgesetz).
        </p>
      </Section>

      <Section title="Haftung für Inhalte und Links">
        <p>
          Die Inhalte dieser Seiten wurden mit Sorgfalt erstellt. Für die
          Richtigkeit, Vollständigkeit und Aktualität der Inhalte können wir
          jedoch keine Gewähr übernehmen. Als Diensteanbieter sind wir für
          eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen
          verantwortlich; wir sind allerdings nicht verpflichtet, übermittelte
          oder gespeicherte fremde Informationen zu überwachen.
        </p>
        <p>
          Unser Angebot enthält Links zu externen Websites Dritter, auf deren
          Inhalte wir keinen Einfluss haben. Für diese fremden Inhalte ist
          stets der jeweilige Anbieter verantwortlich. Zum Zeitpunkt der
          Verlinkung waren keine Rechtsverstöße erkennbar. Werden uns
          Rechtsverletzungen bekannt, entfernen wir solche Links umgehend.
        </p>
      </Section>

      <Section title="Hinweis zur Analyse">
        <p>
          Malook liefert eine automatisierte, ästhetische Einschätzung von
          Gesichtsproportionen. Das ist{" "}
          <strong className="font-semibold text-[var(--color-ink)]">
            keine medizinische, psychologische oder therapeutische Beratung
          </strong>{" "}
          und ersetzt keine ärztliche Diagnose. Die ausgegebenen Werte sind
          Rechenergebnisse eines Modells, keine Feststellungen über eine
          Person.
        </p>
      </Section>

      <Section title="Adresse">
        <p>
          Postalisch erreichst du uns unter {ADDRESS.street},{" "}
          {ADDRESS.zip} {ADDRESS.city}.
        </p>
      </Section>
    </LegalPage>
  );
}
