import type { Metadata } from "next";
import { ResultsPage } from "@/components/pages/ResultsPage";

// A server wrapper around the client screen. Metadata cannot be exported
// from a "use client" module, and every page owes a search engine a title
// and an indexing decision — including the pages whose answer is "no".
// One person's report, and it redirects to /upload without a scan in
// memory. Neither indexed nor followed.
export const metadata: Metadata = {
  title: "Dein Report",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <ResultsPage />;
}
