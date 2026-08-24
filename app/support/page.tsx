import type { Metadata } from "next";
import { absolute } from "@/lib/seo";
import { SupportHeader } from "@/components/support/SupportHeader";
import { SupportForm } from "@/components/support/SupportForm";

// Indexable, unlike /konto: "how do I contact them" is a question people
// ask a search engine before they ask the company. Canonical set the same
// way every public page sets it — one origin answers on three hostnames,
// and a contact page is exactly the kind of thin page that gets flagged as
// a duplicate when it does not say which one is real.
export const metadata: Metadata = {
  title: "Support",
  description:
    "Fragen zur Analyse, zu einer Zahlung oder zum Konto — schreib uns, wir antworten per E-Mail.",
  alternates: { canonical: absolute("/support") },
  openGraph: { url: absolute("/support") },
};

export default function SupportPage() {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-14 pb-24">
      <SupportHeader />
      <div className="mt-8">
        <SupportForm />
      </div>
    </main>
  );
}
