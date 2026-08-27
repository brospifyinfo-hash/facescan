import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { I18nProvider } from "@/lib/i18n";
import { META_DESCRIPTION, VISION_ACTIVE } from "@/lib/i18n/privacy";
import { ParallaxField } from "@/components/ui/ParallaxField";
import { ConsentBanner } from "@/components/ui/ConsentBanner";
import { Tracker } from "@/components/ui/Tracker";
import { MenuFab } from "@/components/home/MenuFab";
import { BRAND, SITE_LOCALE, SITE_URL, absolute } from "@/lib/seo";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

// WHAT A CRAWLER GETS, AND WHY IT LOOKS LIKE THIS
// ----------------------------------------------
// metadataBase is what turns every relative image and canonical below into
// an absolute URL — without it Next emits relative og:image values, which
// no social platform resolves, and the share card silently renders blank.
//
// The canonical is set HERE, once, to the site root, and per page where a
// page differs. The same deployment answers on the apex, the www and the
// vercel.app hostname; without a canonical those are three competing copies
// of one site, and the ranking gets split between them.
//
// Title and description both track the engine. The old pair asserted the
// analysis runs "on-device" and that photos "never leave your device" —
// true of the geometry pipeline, false the moment the free scan uploads to
// GPT-4.1. A share card and a search result are where that claim travels
// furthest, so it is the last place it should be left stale.
const TITLE = VISION_ACTIVE
  ? `${BRAND} — KI-Gesichtsanalyse: 15 Messwerte, Score und Plan`
  : `${BRAND} — Gesichtsanalyse auf deinem Gerät: 15 Messwerte, Score und Plan`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    // Every other page appends the brand rather than repeating the claim —
    // a title that is 80% boilerplate is 80% wasted in a result list.
    template: `%s · ${BRAND}`,
  },
  description: META_DESCRIPTION,
  applicationName: BRAND,
  alternates: { canonical: absolute("/") },
  openGraph: {
    type: "website",
    siteName: BRAND,
    locale: SITE_LOCALE,
    url: absolute("/"),
    title: TITLE,
    description: META_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: META_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      // Let Google show a full text snippet, a large image and no video
      // preview — the defaults are conservative and cost click-through.
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": 0,
    },
  },
  category: "health",
  formatDetection: { telephone: false, address: false, email: false },
};

export const viewport: Viewport = {
  themeColor: "#05080d",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // THE SERVER RENDERS GERMAN, and that is an SEO decision rather than a
  // default nobody revisited. The dictionary is chosen in the browser, so
  // exactly one language ends up in the HTML a crawler reads; this domain
  // serves the German market, so that language is German. Everyone else
  // still gets their own the moment the app mounts — see I18nProvider.
  return (
    <html lang="de" className={inter.variable}>
      {/* No background on the body — the canvas is html's alone, so the
          fixed light layers behind the content are not painted over. See
          the body note in globals.css. */}
      <body className="min-h-dvh font-sans text-[var(--color-ink)] antialiased">
        {/* Ambient field — gives the glass panels something to refract, and
            keeps the canvas from reading as flat black behind the report's
            near-black plates. Weaker than the previous pass: at the new
            surface values a 10% wash was visible AS a gradient rather than as
            depth, which is the point at which it stops being ambient. */}
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10"
          style={{
            background:
              "radial-gradient(1100px 620px at 50% -12%, rgba(95,227,138,0.07), transparent 62%), radial-gradient(800px 500px at 88% 8%, rgba(84,140,214,0.05), transparent 60%), radial-gradient(700px 420px at 6% 32%, rgba(95,227,138,0.03), transparent 60%)",
          }}
        />
        {/* The moving half of the light — the body paints the standing half,
            so the glass refracts something even before hydration. */}
        <ParallaxField />
        <I18nProvider>
          {children}
          {/* Consent first, statistics second: the tracker checks the choice
              the banner wrote and stays silent without an "accept all". */}
          {/* Hier und nicht in der LandingPage: das Menue soll auf jeder
              Seite erreichbar sein, nicht nur auf der Startseite. Es
              entscheidet selbst, wo es sich zurueckhaelt — siehe HIDDEN
              in der Komponente. */}
          <MenuFab />
          <ConsentBanner />
          <Tracker />
        </I18nProvider>
      </body>
    </html>
  );
}
