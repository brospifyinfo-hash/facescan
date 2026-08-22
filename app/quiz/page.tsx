import type { Metadata } from "next";
import { QuizPage } from "@/components/pages/QuizPage";
import { absolute } from "@/lib/seo";

// A server wrapper around the client screen. Metadata cannot be exported
// from a "use client" module, and every page owes a search engine a title
// and an indexing decision — including the pages whose answer is "no".
export const metadata: Metadata = {
  title: "Gesichtsanalyse starten — 6 Fragen",
  description:
    "Sechs Fragen kalibrieren deine Analyse: Geschlecht, Alter, Körperbau und Ziel. Danach zwei Fotos — Ergebnis in Sekunden, ohne Anmeldung.",
  alternates: { canonical: absolute("/quiz") },
  openGraph: { url: absolute("/quiz") },
};

export default function Page() {
  return <QuizPage />;
}
