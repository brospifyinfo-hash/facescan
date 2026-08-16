import { NextResponse } from "next/server";
import { readSiteImages } from "@/lib/site-images-store";
import { IMAGE_SLOTS, resolveSlot } from "@/lib/site-images";

export const runtime = "nodejs";
// The values change when an admin saves, so a build-time snapshot would show
// the old artwork until the next deploy — which is the whole thing this
// feature exists to avoid.
export const dynamic = "force-dynamic";

/**
 * The home-page artwork. Public, and deliberately so: these are the pictures
 * on the landing page, and the response is exactly what any visitor can see
 * by looking at it.
 *
 * ALWAYS RESOLVED, never raw. The caller gets a usable URL for every slot,
 * with the shipped default filled in where there is no override, so no
 * consumer has to know that fallbacks exist or which asset is which.
 */
export async function GET() {
  const images = await readSiteImages();
  const resolved = Object.fromEntries(
    IMAGE_SLOTS.map((slot) => [slot, resolveSlot(images, slot)]),
  );
  return NextResponse.json(
    { images: resolved },
    {
      // Briefly cacheable at the edge: an admin swapping a picture can wait a
      // minute to see it, and the landing page should not hit the spreadsheet
      // once per visitor.
      headers: { "cache-control": "public, s-maxage=60, stale-while-revalidate=600" },
    },
  );
}
