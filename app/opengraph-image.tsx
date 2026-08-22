import { ImageResponse } from "next/og";
import { BRAND } from "@/lib/seo";

// The share card, drawn rather than uploaded.
//
// A link with no og:image gets a bare text row in every chat app, on every
// social network and in Slack — the single cheapest thing a site can fix
// and the one most often left undone because it needs a designer to export
// a PNG. Generating it here means it can never drift out of date with the
// product, and it costs no asset to maintain.
//
// The design is the product's own: near-black, one accent, the wireframe
// motif suggested with concentric rings rather than by loading the artwork
// (an ImageResponse cannot reach into the app's CSS or fetch a local file
// without a URL, and a share card that depends on a network fetch is a
// share card that sometimes fails to render).

export const runtime = "nodejs";
export const alt = `${BRAND} — KI-Gesichtsanalyse`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "72px 80px",
          backgroundColor: "#05080d",
          backgroundImage:
            "radial-gradient(circle at 12% -8%, rgba(95,227,138,0.22) 0%, rgba(5,8,13,0) 55%), radial-gradient(circle at 96% 16%, rgba(56,152,255,0.16) 0%, rgba(5,8,13,0) 58%)",
          color: "#f5f7f8",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* The instrument motif: concentric rings, fading outward. */}
        <div
          style={{
            position: "absolute",
            right: -120,
            top: 90,
            width: 520,
            height: 520,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {[520, 400, 280, 160].map((d, i) => (
            <div
              key={d}
              style={{
                position: "absolute",
                width: d,
                height: d,
                borderRadius: 999,
                border: `2px solid rgba(95,227,138,${0.32 - i * 0.06})`,
              }}
            />
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 999,
              background: "#5fe38a",
              boxShadow: "0 0 24px rgba(95,227,138,0.9)",
            }}
          />
          <div
            style={{
              fontSize: 26,
              letterSpacing: 6,
              textTransform: "uppercase",
              color: "#9aa4ae",
            }}
          >
            {BRAND}
          </div>
        </div>

        <div
          style={{
            marginTop: 26,
            fontSize: 76,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: -2.5,
            maxWidth: 760,
            display: "flex",
          }}
        >
          Entdecke dein volles Potenzial.
        </div>

        <div
          style={{
            marginTop: 26,
            fontSize: 30,
            lineHeight: 1.35,
            color: "#9aa4ae",
            maxWidth: 700,
            display: "flex",
          }}
        >
          KI-Gesichtsanalyse mit 15 echten Messwerten, deinem Score und einem Plan,
          mit dem du sofort anfangen kannst.
        </div>

        <div style={{ marginTop: 40, display: "flex", gap: 14 }}>
          {["478 Landmarken", "15 Messwerte", "Einmalzahlung"].map((chip) => (
            <div
              key={chip}
              style={{
                display: "flex",
                padding: "12px 22px",
                borderRadius: 999,
                border: "1px solid rgba(245,247,248,0.16)",
                fontSize: 24,
                color: "#dfe6ec",
              }}
            >
              {chip}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
