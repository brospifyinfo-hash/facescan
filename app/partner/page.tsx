import type { Metadata } from "next";
import { PartnerView } from "@/components/partner/PartnerView";
import { absolute } from "@/lib/seo";

// The partner area.
//
// WHY THIS PAGE IS INDEXED WHILE /konto IS NOT
// One route serves two things: the public explanation of the programme and,
// for somebody who is signed in, their own dashboard. The explanation is
// marketing — it is how a person finds out the programme exists at all, and
// hiding it from search would mean the only way to discover it is to already
// know about it. The dashboard is not in the HTML a crawler receives: it is
// fetched from /api/affiliate/me after mount, behind the session cookie, so
// what gets indexed is the explainer and nothing else.
//
// The title is German like every other page title in this app; the page body
// is translated through lib/i18n, but metadata is rendered on the server
// before a locale is known. See the note in lib/i18n/index.ts.
export const metadata: Metadata = {
  title: "Partnerprogramm",
  description:
    "Empfiehl Malook weiter und verdiene an jedem Kauf mit: eigener Link, fünf Stufen, Auszahlung auf Antrag.",
  alternates: { canonical: absolute("/partner") },
  openGraph: {
    title: "Partnerprogramm",
    description:
      "Empfiehl Malook weiter und verdiene an jedem Kauf mit: eigener Link, fünf Stufen, Auszahlung auf Antrag.",
    url: absolute("/partner"),
  },
};

export default function PartnerPage() {
  return <PartnerView />;
}
