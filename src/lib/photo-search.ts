// Searching free photos for a group's cover.
//
// The photos come from Unsplash. The app never talks to Unsplash's search itself: it asks a small
// server-side helper (supabase/functions/photo-search), which holds the key. Nothing is stored
// for a photo found this way but its web address and who took it, on the group's cover
// (supabase/updates/018-group-covers.sql). The photo is always loaded from Unsplash's servers.
//
// Unsplash's rules, which the app follows:
//   * Wherever one of its photos shows, so does "Photo by <name> on Unsplash", with the name
//     linked to the photographer's page and "Unsplash" linked to Unsplash (src/components/cover-credit.tsx).
//   * Every link to Unsplash says which app it came from.
//   * Unsplash is told when a photo is put to use, which here is when a cover with it is saved.
//
// See docs/REDESIGN-HOME-AND-GROUP-2.md, section 7.

import { creditAddress, searchedPhotoAddress, type Cover } from './covers';
import { db } from './supabase';

/** Unsplash's own page, as every link to it from this app is written. */
export const UNSPLASH = 'https://unsplash.com/?utm_source=somedaisy&utm_medium=referral';

/** The most letters that can be searched for. The helper keeps the same limit. */
export const SEARCH_MAX = 60;

/** A photo found by a search. */
export type FoundPhoto = {
  id: string;
  /** A small copy, for the grid of results. */
  thumb: string;
  /** The copy shown as a cover, and the address saved on the group. */
  url: string;
  /** What the photo shows, in words, when Unsplash says. */
  alt: string | null;
  /** Who took it. */
  name: string;
  /** The credit saved with the cover: "Photo by <name> on Unsplash". */
  credit: string;
  /** The photographer's page on Unsplash. */
  creditUrl: string;
  /** What to send the helper if this photo is chosen, so Unsplash can be told. Null when it gave none. */
  report: string | null;
};

/** Why a search gave nothing: it is not set up, the hour's searches are used up, or it failed. */
export type SearchTrouble = 'off' | 'busy' | 'failed';

/**
 * What is said for each. The first names the helper on purpose: only whoever looks after the
 * server can put that right.
 */
export const SEARCH_SAYS: Record<SearchTrouble, string> = {
  off: 'Photo search is not set up yet. Its helper (photo-search) or its key is missing. You can still upload a photo.',
  busy: 'Photo search is busy right now. Try again in a while, or upload a photo.',
  failed: "We couldn't search for photos. Try again.",
};

/** Said when a search worked and found nothing. */
export const NOTHING_FOUND = 'No photos found. Try other words.';

/** The words to search for, tidied, or null when there is nothing worth searching for. */
export function cleanSearch(typed: string): string | null {
  const words = typed.replace(/\s+/g, ' ').trim().slice(0, SEARCH_MAX).trim();
  return words.length >= 2 ? words : null;
}

/** The credit for a photo, as Unsplash asks for it to be worded. */
export function creditFor(name: string): string {
  return `Photo by ${name} on Unsplash`;
}

/**
 * The photographer's name, read back from a credit, so it can be shown as a link of its own.
 * Null for a credit worded any other way, which is then shown whole.
 */
export function creditName(credit: string): string | null {
  return /^Photo by (.+) on Unsplash$/.exec(credit.trim())?.[1].trim() || null;
}

function line(value: unknown, most: number): string | null {
  if (typeof value !== 'string') return null;
  const text = value.replace(/\s+/g, ' ').trim().slice(0, most).trim();
  return text || null;
}

/**
 * The photos in the helper's answer, each checked again here: an address that is not on Unsplash
 * is never shown, whatever the answer says.
 */
export function foundFrom(data: unknown): FoundPhoto[] {
  const photos = (data as { photos?: unknown } | null)?.photos;
  if (!Array.isArray(photos)) return [];
  const found: FoundPhoto[] = [];
  for (const item of photos as ({ id?: unknown; thumb?: unknown; url?: unknown; alt?: unknown; name?: unknown; profile?: unknown; chosen?: unknown } | null)[]) {
    if (!item || typeof item !== 'object') continue;
    // The credit has to fit where it is saved (120 letters), so the name is kept well under that.
    const name = line(item.name, 80);
    if (typeof item.id !== 'string' || !item.id || !name || !searchedPhotoAddress(item.thumb) || !searchedPhotoAddress(item.url) || !creditAddress(item.profile)) continue;
    if (found.some((photo) => photo.id === item.id || photo.url === item.url)) continue;
    found.push({
      id: item.id,
      thumb: item.thumb,
      url: item.url,
      alt: line(item.alt, 140),
      name,
      credit: creditFor(name),
      creditUrl: item.profile,
      report: typeof item.chosen === 'string' && item.chosen.length <= 1000 ? item.chosen : null,
    });
  }
  return found;
}

// What each search found, for the rest of the session, so asking for the same words again costs
// nothing. Unsplash allows the app a set number of searches an hour, across everyone.
const kept = new Map<string, FoundPhoto[]>();

/** Forget what the searches so far found. Only the tests need this. */
export function forgetSearches(): void {
  kept.clear();
}

/**
 * Search for photos. Never fails out loud: when the search could not be done, `trouble` says why
 * and there are no photos.
 */
export async function searchPhotos(typed: string): Promise<{ photos: FoundPhoto[]; trouble: SearchTrouble | null }> {
  const words = cleanSearch(typed);
  if (!words) return { photos: [], trouble: null };
  const key = words.toLowerCase();
  const before = kept.get(key);
  if (before) return { photos: before, trouble: null };
  try {
    const { data, error } = await db().functions.invoke('photo-search', { body: { query: words } });
    if (error) {
      // A helper that has not been deployed answers "not found".
      const status = (error as { context?: { status?: unknown } }).context?.status;
      return { photos: [], trouble: status === 404 ? 'off' : 'failed' };
    }
    const why = (data as { why?: unknown } | null)?.why;
    if (why === 'off' || why === 'busy' || why === 'failed') return { photos: [], trouble: why };
    const photos = foundFrom(data);
    kept.set(key, photos);
    return { photos, trouble: null };
  } catch {
    return { photos: [], trouble: 'failed' };
  }
}

/**
 * Tell Unsplash, through the helper, that a photo has been put to use. Call it once a cover with
 * the photo has been saved, without waiting for it. It never fails out loud.
 */
export function reportChosen(photo: FoundPhoto): void {
  if (!photo.report) return;
  const report = photo.report;
  Promise.resolve()
    .then(() => db().functions.invoke('photo-search', { body: { chosen: report } }))
    .catch(() => {});
}

/** The cover a group gets by choosing a found photo. The colour under it stays whatever the cover had: it shows while the photo loads. */
export function searchedCover(base: Cover, photo: FoundPhoto): Cover {
  return { kind: 'photo', background: base.background, pattern: base.pattern, photo: { source: 'search', url: photo.url, credit: photo.credit, creditUrl: photo.creditUrl } };
}

/** The searched photo on a cover, or null when the cover has none (colours, or an uploaded photo). */
export function searchedPhoto(cover: Cover): { url: string; credit: string; creditUrl: string } | null {
  return cover.kind === 'photo' && cover.photo.source === 'search' ? cover.photo : null;
}
