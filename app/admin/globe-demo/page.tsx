import { notFound } from "next/navigation";
import { Globe } from "@/components/admin/Globe";

// DEVELOPMENT ONLY: renders the globe with fake points so it can be looked
// at (and screenshotted) without an admin cookie. Production answers 404 —
// the component itself shows nothing sensitive, but a demo page in prod is
// clutter pretending to be a feature.
export const dynamic = "force-dynamic";

export default function GlobeDemo() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl items-center justify-center px-4">
      <Globe
        size={520}
        points={[
          { country: "DE", count: 4 },
          { country: "US", count: 2 },
          { country: "BR", count: 1 },
          { country: "JP", count: 3 },
          { country: "AU", count: 1 },
        ]}
      />
    </main>
  );
}
