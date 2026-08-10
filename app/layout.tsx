import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { I18nProvider } from "@/lib/i18n";
import { META_DESCRIPTION, VISION_ACTIVE } from "@/lib/i18n/privacy";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

// Title and description both track the engine. The old pair asserted the
// analysis runs "on-device" and that photos "never leave your device" —
// true of the geometry pipeline, false the moment the free scan uploads to
// GPT-4.1. A share card and a search result are where that claim travels
// furthest, so it is the last place it should be left stale.
export const metadata: Metadata = {
  title: VISION_ACTIVE
    ? "FaceScan — AI facial aesthetics analysis"
    : "FaceScan — On-device facial aesthetics analysis",
  description: META_DESCRIPTION,
};

export const viewport: Viewport = {
  themeColor: "#09090b",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // `lang` is corrected on the client once the browser language is known.
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-dvh bg-[var(--color-canvas)] font-sans text-[var(--color-ink)] antialiased">
        {/* Ambient field — gives the glass panels something to refract. */}
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10"
          style={{
            background:
              "radial-gradient(1100px 620px at 50% -12%, rgba(149,191,71,0.10), transparent 62%), radial-gradient(800px 500px at 88% 8%, rgba(120,160,220,0.055), transparent 60%), radial-gradient(700px 420px at 6% 32%, rgba(149,191,71,0.045), transparent 60%)",
          }}
        />
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
