import type { Metadata } from "next";
import { CalibratePage } from "@/components/pages/CalibratePage";

// A server wrapper around the client screen. Metadata cannot be exported
// from a "use client" module, and every page owes a search engine a title
// and an indexing decision — including the pages whose answer is "no".
// A diagnostic for whoever runs the site, not a product page.
export const metadata: Metadata = {
  title: "Kalibrierung",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <CalibratePage />;
}
