import { notFound } from "next/navigation";
import { Globe } from "@/components/admin/Globe";

// DEVELOPMENT ONLY: renders the globe with fake points so it can be looked
// at (and screenshotted) without an admin cookie. Production answers 404 —
// the component itself shows nothing sensitive, but a demo page in prod is
// clutter pretending to be a feature.
export const dynamic = "force-dynamic";

export default async function GlobeDemo({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const params = await searchParams;
  const num = (v: string | string[] | undefined) => {
    const n = Number(Array.isArray(v) ? v[0] : v);
    return Number.isFinite(n) ? n : undefined;
  };
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl items-center justify-center px-4">
      <Globe
        size={520}
        initial={{ zoom: num(params.zoom), lat: num(params.lat), lon: num(params.lon) }}
        points={[
          { country: "DE", count: 4, lat: 48.14, lon: 11.58, label: "München" },
          { country: "DE", count: 1, lat: 52.52, lon: 13.4, label: "Berlin" },
          { country: "US", count: 2, lat: 40.71, lon: -74.01, label: "New York" },
          { country: "BR", count: 1, lat: -23.55, lon: -46.63, label: "São Paulo" },
          { country: "JP", count: 3, lat: 35.68, lon: 139.69, label: "Tokio" },
        ]}
      />
    </main>
  );
}
