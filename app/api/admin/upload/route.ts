import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { isAdmin } from "@/lib/admin";
import { blobConfigured } from "@/lib/blob";

export const runtime = "nodejs";

// Product images.
//
// WHY THE SDK, when lib/kv.ts deliberately hand-rolls Redis over REST. The
// reasoning there was that eight Redis commands over a stable wire protocol
// are cheaper to own than a dependency. Blob is the opposite case: its REST
// contract is versioned through request headers, and getting that version
// wrong fails at runtime in a way no local test can catch before a store
// exists. A first-party package that guarantees the contract is worth more
// than the twenty lines it saves.
//
// The image is compressed in the browser before it arrives — see
// components/admin/ImageField.tsx. This route still enforces the limits,
// because a client-side guard is a convenience and not a control.

/** Comfortably above a compressed product shot, far below the 4.5 MB body cap. */
const MAX_BYTES = 2 * 1024 * 1024;

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!blobConfigured()) {
    return NextResponse.json(
      {
        error: "unconfigured",
        details: [
          "No Blob store is connected. Vercel dashboard → Storage → Create → Blob, " +
            "connect it to this project, then redeploy.",
        ],
      },
      { status: 501 },
    );
  }

  let file: File | null = null;
  try {
    const form = await request.formData();
    const value = form.get("file");
    file = value instanceof File ? value : null;
  } catch {
    return NextResponse.json({ error: "invalid_form" }, { status: 400 });
  }

  if (!file) {
    return NextResponse.json({ error: "no_file" }, { status: 400 });
  }

  // The type is checked against the DECLARED content type, which a caller
  // controls — so the extension is derived from the allowlist rather than
  // from the filename, and the stored object can only ever be one of three
  // image types regardless of what the upload claimed to be called.
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json(
      { error: "unsupported_type", details: [`${file.type || "unknown"} is not an image`] },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "too_large", details: [`${Math.round(file.size / 1024)} KB exceeds 2 MB`] },
      { status: 413 },
    );
  }

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";

  const blob = await put(`products/${crypto.randomUUID()}.${ext}`, file, {
    access: "public",
    contentType: file.type,
    // The pathname already carries a UUID; a second random suffix would only
    // make the URL longer.
    addRandomSuffix: false,
    // Product images are immutable — a new image is a new upload, so the CDN
    // may hold this one indefinitely.
    cacheControlMaxAge: 31536000,
  });

  return NextResponse.json({ url: blob.url });
}
