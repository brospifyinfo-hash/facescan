import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "FaceScan — On-device facial aesthetics analysis",
  description:
    "Clinical-grade facial geometry analysis that runs entirely in your browser. 478 landmarks, real measurements — your photos never leave your device during the free scan.",
};

export const viewport: Viewport = {
  themeColor: "#09090b",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-dvh bg-zinc-950 font-sans text-zinc-100 antialiased">
        {/* Subtle ambient glow — kept extremely low-key for the clinical look */}
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10"
          style={{
            background:
              "radial-gradient(1200px 600px at 50% -10%, rgba(149,191,71,0.07), transparent 60%)",
          }}
        />
        {children}
      </body>
    </html>
  );
}
