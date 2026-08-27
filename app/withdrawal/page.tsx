import type { Metadata } from "next";
import { absolute } from "@/lib/seo";
import { Block, LegalPage, Section } from "@/components/legal/LegalPage";
import { WithdrawalForm } from "@/components/legal/WithdrawalForm";
import { CONTACT_EMAIL, addressLines, operatorLine } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Widerrufsrecht",
  description:
    "Widerrufsbelehrung für Verbraucher und Muster-Widerrufsformular.",
  alternates: { canonical: absolute("/withdrawal") },
};

// Die Belehrung, auf die der zweite Haken im Checkout verlinkt.
//
// WARUM DIESE SEITE DER WICHTIGSTE DER VIER TEXTE IST
//
// Malook verkauft digitale Inhalte, die sofort nach der Zahlung bereitstehen.
// Dass dafür am Ende kein Widerrufsrecht mehr besteht, ist kein Automatismus:
// §356 Abs. 5 BGB lässt es nur erlöschen, wenn der Kunde VORHER ausdrücklich
// zugestimmt hat, dass mit der Ausführung begonnen wird, UND bestätigt hat,
// dass er sein Widerrufsrecht damit verliert, UND wir ihm das bestätigen.
//
// Genau diese beiden Erklärungen holt die zweite Checkbox in
// components/checkout/PaymentForm.tsx ein. Ihr Text und dieser hier müssen
// zusammenpassen — steht dort etwas anderes als hier, greift die Ausnahme
// nicht und jeder Kauf ist vierzehn Tage lang widerrufbar.

export default function WithdrawalPage() {
  return (
    <LegalPage
      title="Widerrufsrecht"
      intro="Widerrufsbelehrung für Verbraucherinnen und Verbraucher."
    >
      <Section title="Widerrufsrecht">
        <p>
          Du hast das Recht, binnen vierzehn Tagen ohne Angabe von Gründen
          diesen Vertrag zu widerrufen. Die Widerrufsfrist beträgt vierzehn
          Tage ab dem Tag des Vertragsabschlusses.
        </p>
        <p>
          Um dein Widerrufsrecht auszuüben, musst du uns mittels einer
          eindeutigen Erklärung (zum Beispiel per E-Mail oder Brief) über
          deinen Entschluss, diesen Vertrag zu widerrufen, informieren. Du
          kannst dafür das unten stehende Muster-Formular verwenden, das aber
          nicht vorgeschrieben ist.
        </p>
        <Block>
          <div>{operatorLine()}</div>
          {addressLines().map((line) => (
            <div key={line}>{line}</div>
          ))}
          <div className="mt-2">
            E-Mail:{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-accent underline underline-offset-2 hover:text-accent-bright"
            >
              {CONTACT_EMAIL}
            </a>
          </div>
        </Block>
        <p>
          Zur Wahrung der Widerrufsfrist reicht es aus, dass du die Mitteilung
          über die Ausübung des Widerrufsrechts vor Ablauf der Widerrufsfrist
          absendest.
        </p>
      </Section>

      <Section title="Widerruf jetzt erklären">
        <p>
          Am schnellsten geht es hier. Pflicht sind nur dein Name und die
          E-Mail-Adresse der Bestellung — alles Weitere hilft uns beim
          Zuordnen, ist aber freiwillig. Du bekommst die Eingangsbestätigung
          sofort per E-Mail.
        </p>
        <div className="mt-2">
          <WithdrawalForm />
        </div>
      </Section>

      <Section title="Folgen des Widerrufs">
        <p>
          Wenn du diesen Vertrag widerrufst, haben wir dir alle Zahlungen, die
          wir von dir erhalten haben, unverzüglich und spätestens binnen
          vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über
          deinen Widerruf bei uns eingegangen ist.
        </p>
        <p>
          Für die Rückzahlung verwenden wir dasselbe Zahlungsmittel, das du
          bei der ursprünglichen Transaktion eingesetzt hast, es sei denn, mit
          dir wurde ausdrücklich etwas anderes vereinbart. In keinem Fall
          werden dir wegen dieser Rückzahlung Entgelte berechnet.
        </p>
      </Section>

      <Section title="Vorzeitiges Erlöschen des Widerrufsrechts">
        <p>
          Das Widerrufsrecht erlischt bei einem Vertrag über die Lieferung von
          nicht auf einem körperlichen Datenträger befindlichen digitalen
          Inhalten, wenn wir mit der Ausführung des Vertrags begonnen haben
          und du zuvor
        </p>
        <p>
          ausdrücklich zugestimmt hast, dass wir mit der Ausführung des
          Vertrags vor Ablauf der Widerrufsfrist beginnen, und deine Kenntnis
          davon bestätigt hast, dass du durch deine Zustimmung mit Beginn der
          Ausführung des Vertrags dein Widerrufsrecht verlierst.
        </p>
        <p>
          Beide Erklärungen holen wir im Bezahlvorgang mit einem eigenen
          Bestätigungsfeld ein, bevor die Zahlung ausgelöst wird. Erst danach
          wird die Analyse freigeschaltet. Setzt du dieses Häkchen nicht, kann
          der Kauf nicht abgeschlossen werden — und dein Widerrufsrecht
          bleibt in vollem Umfang bestehen.
        </p>
      </Section>

      <Section title="Muster-Widerrufsformular">
        <p>
          Wenn du den Vertrag widerrufen willst, kannst du dieses Formular
          ausfüllen und zurücksenden. Verpflichtend ist das nicht.
        </p>
        <Block>
          <p className="whitespace-pre-line">
            {`An ${operatorLine()}, ${addressLines().join(", ")}, ${CONTACT_EMAIL}:

Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über den Kauf der folgenden digitalen Inhalte:

_______________________________________________

Bestellt am (*) / erhalten am (*): ____________

Name des/der Verbraucher(s): __________________

Anschrift des/der Verbraucher(s): _____________

_______________________________________________

Unterschrift des/der Verbraucher(s)
(nur bei Mitteilung auf Papier)

Datum: ________________________________________

(*) Unzutreffendes streichen.`}
          </p>
        </Block>
      </Section>
    </LegalPage>
  );
}
