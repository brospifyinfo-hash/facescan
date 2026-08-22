import type { Metadata } from "next";
import { ScanPage } from "@/components/pages/ScanPage";

// A server wrapper around the client screen. Metadata cannot be exported
// from a "use client" module, and every page owes a search engine a title
// and an indexing decision — including the pages whose answer is "no".
// Mid-funnel, and it redirects without photos in memory.
export const metadata: Metadata = {
  title: "Scan läuft",
  robots: { index: false, follow: true },
};

export default function Page() {
  return <ScanPage />;
}
