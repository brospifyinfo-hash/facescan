import type { Metadata } from "next";
import { UploadPage } from "@/components/pages/UploadPage";

// A server wrapper around the client screen. Metadata cannot be exported
// from a "use client" module, and every page owes a search engine a title
// and an indexing decision — including the pages whose answer is "no".
// Mid-funnel: meaningless without the quiz answers behind it. Reachable,
// linkable, but not a search result — see lib/seo.ts.
export const metadata: Metadata = {
  title: "Fotos hochladen",
  robots: { index: false, follow: true },
};

export default function Page() {
  return <UploadPage />;
}
