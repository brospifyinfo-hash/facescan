import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { I18nProvider } from "@/lib/i18n";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "FaceScan — On-device facial aesthetics analysis",
  description:
    "Clinical-grade facial geometry analysis that runs entirely in your browser. 478 landmarks, 16 real measurements — your photos never leave your device during the free scan.",
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
      <body className="min-h-dvh bg-zinc-950 font-sans text-zinc-100 antialiased">
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
