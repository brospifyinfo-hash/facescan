// Reading and writing the home-page image overrides.
//
// Split from lib/site-images.ts so the validation there stays importable by a
// test and by client components without dragging the spreadsheet client along
// with it.
//
// A FAILED READ RETURNS THE DEFAULTS, IT DOES NOT THROW. The only consumer is
// the landing page, and the worst outcome of a slow or broken spreadsheet
// must be "the shipped artwork is shown" rather than "the home page is a
// stack trace". A failed WRITE does throw, because an admin who pressed save
// has to be told it did not save.

import { skGetJson, skSetJson, sheetsKvConfigured, sheetsKvHealthy } from "./sheets-kv";
import { cleanSiteImages, type SiteImages } from "./site-images";

const KEY = "site:images";

/** Survives a warm instance only — the honest fallback when nothing is configured. */
let memory: SiteImages = {};

export async function readSiteImages(): Promise<SiteImages> {
  if (!sheetsKvConfigured() || !sheetsKvHealthy()) return memory;
  try {
    return cleanSiteImages(await skGetJson<unknown>(KEY));
  } catch {
    return memory;
  }
}

export async function writeSiteImages(next: SiteImages): Promise<SiteImages> {
  const clean = cleanSiteImages(next);

  if (sheetsKvConfigured()) {
    // THE MEMORY COPY IS UPDATED ONLY AFTER THE WRITE LANDS. It used to be
    // set first, which meant a failed save still changed what the site
    // served on this instance: the admin was told "could not be saved" while
    // the new picture was already live, and it would vanish again on the
    // next cold start. "Failed" has to mean nothing changed.
    //
    // No try/catch either — the admin needs to see the failure rather than a
    // success that did not persist.
    await skSetJson(KEY, clean);
  }

  memory = clean;
  return clean;
}
