import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { blobConfigured } from "@/lib/blob";
import { readSiteImages, writeSiteImages } from "@/lib/site-images-store";
import { cleanSiteImages, IMAGE_SLOTS, SLOT_SPECS } from "@/lib/site-images";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The admin side of the home-page artwork.
 *
 * GET returns the RAW overrides, not the resolved URLs — the editor has to be
 * able to show an empty field as empty. The public route resolves; this one
 * does not, and the difference is the whole reason they are two routes rather
 * than one with a flag.
 */
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    images: await readSiteImages(),
    slots: IMAGE_SLOTS.map((slot) => ({ slot, ...SLOT_SPECS[slot] })),
    // Decides whether the editor shows a file picker or a URL box. Without a
    // Blob store the picker cannot work, and a field that cannot work is
    // worse than a plainer one that can.
    uploads: blobConfigured(),
  });
}

/**
 * Replace the whole set.
 *
 * A full replace rather than a patch, because the editor holds every slot on
 * screen at once — so what it posts IS the intended state, and clearing a
 * field has to mean "use the default again". A patch endpoint would make an
 * emptied field indistinguishable from an untouched one.
 *
 * The body is cleaned in the store, not trusted here: an unknown slot is
 * dropped and a value that is not an http(s) URL or a site-relative path is
 * refused outright rather than written and rendered into a src attribute.
 */
export async function PUT(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const submitted = (body as { images?: unknown })?.images;
  const clean = cleanSiteImages(submitted);

  // A value that was sent but did not survive cleaning is a mistake worth
  // reporting: silently dropping it would leave the admin looking at a saved
  // form that did not save what they typed.
  const rejected: string[] = [];
  if (submitted && typeof submitted === "object") {
    for (const [slot, value] of Object.entries(submitted as Record<string, unknown>)) {
      const wanted = typeof value === "string" ? value.trim() : "";
      if (wanted.length > 0 && !(slot in clean)) rejected.push(slot);
    }
  }
  if (rejected.length > 0) {
    return NextResponse.json(
      {
        error: "invalid_url",
        slots: rejected,
        details: "Nur vollständige http(s)-Adressen oder Pfade, die mit / beginnen.",
      },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json({ images: await writeSiteImages(clean) });
  } catch (err) {
    return NextResponse.json(
      {
        error: "save_failed",
        details: err instanceof Error ? err.message : "Speichern fehlgeschlagen.",
      },
      { status: 502 },
    );
  }
}
