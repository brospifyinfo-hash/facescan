import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/LandingPage";
import { JsonLd } from "@/components/seo/JsonLd";
import { absolute } from "@/lib/seo";

// A SERVER component wrapping the client one, for two reasons that both
// only work here: page-level metadata cannot be exported from a "use
// client" module, and the structured data has to be in the HTML a crawler
// receives without running any JavaScript.
//
// NO DESCRIPTION IS SET HERE, deliberately. It used to repeat the on-page
// subtitle, and page metadata overrides the layout only field by field —
// so og:description carried the subtitle while twitter:description still
// carried the layout's, and the two disagreed in the same <head>. Worse,
// the subtitle still promised the analysis "runs in your browser", which
// stopped being true the day the vision engine started uploading photos.
// One description, in the layout, tracking the engine. See META_DESCRIPTION.
export const metadata: Metadata = {
  alternates: { canonical: absolute("/") },
  openGraph: { url: absolute("/") },
};

export default function Page() {
  return (
    <>
      <JsonLd />
      <LandingPage />
    </>
  );
}
