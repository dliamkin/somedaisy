// A photo as a group's cover: the rules, with nothing in them that needs a phone or the database.
//
// A group can upload one photo of its own. It is made small on the device, then kept in Supabase
// Storage as the one file in the group's folder (supabase/updates/019-cover-photos.sql). That
// place is private: only members can see the photo, and the app asks storage for an address that
// works for a day each time it needs to show it (src/lib/cover-addresses.ts). Choosing, shrinking
// and sending the photo are in src/lib/picture-files.ts.
//
// See docs/REDESIGN-HOME-AND-GROUP-2.md, section 7.

import type { Cover } from './covers';

/** The place in Supabase Storage the cover photos are kept. The database update makes it. */
export const COVER_BUCKET = 'group-covers';

/** The widest a kept cover photo can be, in dots. A cover is never shown wider than a phone. */
export const COVER_WIDTH = 1200;

/** How strongly the photo is squeezed as a JPEG: first as it should look, then once more if that is still too big. */
export const COVER_TRIES = [0.7, 0.5];

/** A first try no bigger than this is kept as it is. Bigger, and the photo is squeezed once more. */
export const COVER_ENOUGH = 400_000;

/** The biggest file the app will send. The place itself refuses anything over 512 KB (524,288 bytes). */
export const COVER_MAX_BYTES = 500_000;

/** How long an address for a photo works for, in seconds: one day. */
export const ADDRESS_LASTS = 24 * 60 * 60;

/**
 * Said when a cover photo cannot be saved because the database does not have update 019. It names
 * the update on purpose: only whoever looks after the database can put this right.
 */
export const NO_COVER_PHOTOS = 'Cover photos cannot be saved yet. The database is missing update 019 (cover photos).';

/** Said when a photo could not be sent, for any other reason. The cover the group had is kept. */
export const PHOTO_NOT_SAVED = "We couldn't save that photo. Try again.";

/**
 * The size to make a photo so that it is no wider than `most`, keeping its shape. Null when it is
 * already narrow enough: a small photo is never made bigger.
 */
export function fitWidth(width: number, height: number, most = COVER_WIDTH): { width: number; height: number } | null {
  if (!(width > 0) || !(height > 0) || width <= most) return null;
  return { width: most, height: Math.max(1, Math.round((height * most) / width)) };
}

// Versions are counted in seconds from this moment (14 November 2023), which keeps them short.
const VERSIONS_FROM = 1_700_000_000;

/**
 * The version to give a photo that is being uploaded now. The file always has the same name, so
 * the version is what tells a phone that its kept copy is out of date. It is taken from the
 * clock, not counted up from the last one, so a group that goes back to colours and later uploads
 * again never reuses a version a phone may still hold a photo for.
 */
export function nextVersion(now: number = Date.now()): number {
  return Math.max(1, Math.floor(now / 1000) - VERSIONS_FROM);
}

/** The uploaded photo on a cover, or null when the cover has none (colours, or a photo found by search). */
export function uploadedPhoto(cover: Cover): { path: string; version: number } | null {
  return cover.kind === 'photo' && cover.photo.source === 'upload' ? { path: cover.photo.path, version: cover.photo.version } : null;
}

/**
 * What a photo is kept under on the device. It changes when the photo does, and not when its
 * address does, so a photo is fetched once however many times a new address is asked for.
 */
export function photoKey(photo: { path: string; version: number }): string {
  return `${photo.path}#${photo.version}`;
}

/** A photo's place and version, read back from the key it is kept under. */
export function fromPhotoKey(key: string): { path: string; version: number } | null {
  const at = key.lastIndexOf('#');
  const version = Number(key.slice(at + 1));
  return at > 0 && Number.isInteger(version) && version > 0 ? { path: key.slice(0, at), version } : null;
}

/** An address from storage with the photo's version added, so nothing in between serves the photo it replaced. */
export function versioned(address: string, version: number): string {
  return `${address}${address.includes('?') ? '&' : '?'}cacheNonce=${version}`;
}
