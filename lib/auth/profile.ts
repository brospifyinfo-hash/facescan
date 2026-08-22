// Who the customer is, as far as the app is allowed to know.
//
// The account is an email address and nothing else — that was deliberate,
// and it stays the rule. This adds exactly two optional fields so a header
// can greet somebody by name instead of by inbox: a display name and a
// picture URL, both of which arrive from Google when Google is the way in,
// and neither of which is invented when it is not.
//
// NO FABRICATION. Without a name the header shows the address's local part,
// which is a fact about the address rather than a guess about the person,
// and the avatar falls back to its first letter. A stock silhouette would
// be a picture of nobody.
//
// Stored in the same sheets-kv as the rest, key `profile:<email>`, no TTL.

import { skGetJson, skSetJson, sheetsKvConfigured, sheetsKvHealthy } from "../sheets-kv";

export interface Profile {
  name?: string;
  picture?: string;
  /** True once the customer named themselves — see mergeProfile. */
  nameSetByUser?: boolean;
}

const key = (email: string) => `profile:${email}`;

/** Local fallback so a checkout with no credentials still runs. */
const memory = new Map<string, Profile>();

const clean = (v: unknown, max: number) =>
  typeof v === "string" && v.trim().length > 0 ? v.trim().slice(0, max) : undefined;

/** Only https URLs, and only as a picture — this value lands in an `src`. */
function cleanPicture(v: unknown): string | undefined {
  const url = clean(v, 500);
  if (!url) return undefined;
  try {
    return new URL(url).protocol === "https:" ? url : undefined;
  } catch {
    return undefined;
  }
}

export async function getProfile(email: string): Promise<Profile> {
  if (sheetsKvConfigured() && sheetsKvHealthy()) {
    try {
      const p = await skGetJson<Profile>(key(email));
      if (p) {
        return {
          name: clean(p.name, 60),
          picture: cleanPicture(p.picture),
          nameSetByUser: p.nameSetByUser === true,
        };
      }
    } catch {
      /* fall through to the floor */
    }
  }
  return memory.get(email) ?? {};
}

/**
 * Merge in what an identity provider told us.
 *
 * THE PICTURE ALWAYS REFRESHES. It is Google's, not ours and not the
 * customer's — nothing in this app edits it — so keeping a stale copy
 * would mean somebody who changes their Google photo, or who signed in
 * before this app stored pictures at all, is stuck with what we happened
 * to capture first. Signing in again is then the fix for a missing avatar,
 * which is a thing a person can actually do.
 *
 * THE NAME DOES NOT, once the customer has set their own: being renamed
 * back by an identity provider is the kind of thing that feels like the
 * app forgetting who you are.
 */
export async function mergeProfile(email: string, incoming: Profile): Promise<void> {
  const current = await getProfile(email);
  const next: Profile = {
    name: current.nameSetByUser ? current.name : (clean(incoming.name, 60) ?? current.name),
    picture: cleanPicture(incoming.picture) ?? current.picture,
    nameSetByUser: current.nameSetByUser,
  };
  if (!next.name && !next.picture) return;

  memory.set(email, next);
  if (sheetsKvConfigured() && sheetsKvHealthy()) {
    try {
      await skSetJson(key(email), next);
    } catch {
      /* the memory floor already holds it */
    }
  }
}

/** Set by the customer themselves, so it overwrites. */
export async function setProfileName(email: string, name: string): Promise<void> {
  const current = await getProfile(email);
  const next: Profile = { ...current, name: clean(name, 60), nameSetByUser: true };
  memory.set(email, next);
  if (sheetsKvConfigured() && sheetsKvHealthy()) {
    try {
      await skSetJson(key(email), next);
    } catch {
      /* dito */
    }
  }
}

/**
 * What to call somebody. The address's local part, tidied — "max.mustermann"
 * becomes "Max", which is a fact about the address rather than a guess at a
 * person's name.
 */
export function displayName(email: string, profile?: Profile): string {
  if (profile?.name) return profile.name;
  const local = email.split("@")[0] ?? email;
  const first = local.split(/[.\-_+]/)[0] ?? local;
  return first.charAt(0).toUpperCase() + first.slice(1);
}
