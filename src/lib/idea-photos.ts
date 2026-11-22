// A found photo as an idea's picture: one tapped in a search of free photos, the same search a
// group's cover uses (src/lib/photo-search.ts).
//
// Nothing is copied. The idea keeps only the photo's web address and who took it
// (supabase/updates/022-idea-photos.sql), and the photo is always loaded from Unsplash's servers.
// It is separate from an idea's own picture, which is a file the group keeps
// (src/lib/pictures.ts), and from the preview picture of the page an idea links to. When an idea
// has more than one, its card shows its own picture first, then the found photo, then the link's.
//
// Unsplash's rules are the same here as for a cover: wherever the photo shows, so does "Photo by
// <name> on Unsplash" (`PhotoCredit` in src/components/cover-credit.tsx), and Unsplash is told
// when the photo is put to use, which is when an idea is saved with it.

import { creditAddress, searchedPhotoAddress } from './covers';
import type { FoundPhoto } from './photo-search';

/** A found photo, as an idea keeps it. */
export type IdeaPhoto = { url: string; credit: string; creditUrl: string };

/**
 * Said when a found photo cannot be saved because the database does not have update 022. It names
 * the update on purpose: only whoever looks after the database can put this right.
 */
export const NO_IDEA_PHOTOS = 'A photo from search cannot be saved on an idea yet. The database is missing update 022 (idea photos).';

/**
 * An idea's found photo, read from what the database holds. Null when it has none, or when what
 * is there is not a photo on Unsplash's own servers with a credit that leads back to Unsplash:
 * nothing from anywhere else is ever shown as a found photo.
 */
export function ideaPhoto(value: unknown): IdeaPhoto | null {
  const photo = value as { url?: unknown; credit?: unknown; creditUrl?: unknown } | null;
  if (!photo || typeof photo !== 'object') return null;
  if (!searchedPhotoAddress(photo.url) || !creditAddress(photo.creditUrl)) return null;
  if (typeof photo.credit !== 'string' || !photo.credit.trim() || photo.credit.length > 120) return null;
  return { url: photo.url, credit: photo.credit, creditUrl: photo.creditUrl };
}

/** What an idea keeps of a photo that was found by a search. */
export function photoForIdea(found: FoundPhoto): IdeaPhoto {
  return { url: found.url, credit: found.credit, creditUrl: found.creditUrl };
}

/** Whether two found photos are the same one. */
export function samePhoto(one: IdeaPhoto | null, other: IdeaPhoto | null): boolean {
  return one?.url === other?.url;
}
