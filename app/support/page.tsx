import type { Metadata } from "next";
import { SupportHeader } from "@/components/support/SupportHeader";
import { SupportForm } from "@/components/support/SupportForm";

// Indexable, unlike /konto: "how do I contact them" is a question people
// ask a search engine before they ask the company.
export const metadata: Metadata = {
  title: "Support — FaceScan",
  description: "Questions about your analysis, a payment or your account.",
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
