// An idea's own picture: one a person in the group adds from their phone or computer.
//
// It is separate from the preview picture of the page an idea links to (src/lib/preview.ts). When
// an idea has both, its own picture is the one shown. The picture is made small on the device,
// then kept in Supabase Storage, and the idea remembers where (supabase/updates/017-idea-pictures.sql).
//
// This file is the rules, with nothing in it that needs a phone. Choosing a picture, making it
// small and sending it are in src/lib/picture-files.ts.

import { ideaPhoto, type IdeaPhoto } from './idea-photos';

/** Only a secure web address is shown as a picture: the same rule as for a link's preview picture (`usablePicture`). */
function usablePicture(value: unknown): string | null {
  return typeof value === 'string' && value.length <= 2000 && /^https:\/\/\S+$/i.test(value) ? value : null;
}

/** The place in Supabase Storage the pictures are kept. The database update makes it. */
export const PICTURE_BUCKET = 'idea-pictures';

/** The longest a kept picture's longer side can be, in dots. Plenty for a card on any phone. */
export const PICTURE_SIDE = 1280;

/** The biggest file the app will send. The place itself refuses anything over 1 MB (1,048,576 bytes). */
export const PICTURE_MAX_BYTES = 1_000_000;

/**
 * Said when a picture cannot be saved because the database does not have update 017. It names
 * the update on purpose: only whoever looks after the database can put this right.
 */
export const NO_PICTURES = 'Pictures cannot be saved yet. The database is missing update 017 (idea pictures).';

export const TOO_BIG = 'That picture is too big to keep, even once it is made smaller. Try another one.';

const ID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const PATH = new RegExp(`^${ID}/${ID}[.]jpg$`);

/**
 * The size to make a picture so that its longer side is no more than `side`, keeping its shape.
 * Null when it is already small enough: a small picture is never made bigger.
 */
export function fitWithin(width: number, height: number, side = PICTURE_SIDE): { width: number; height: number } | null {
  if (!(width > 0) || !(height > 0)) return null;
  const longer = Math.max(width, height);
  if (longer <= side) return null;
  const scale = side / longer;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Where a group's picture is kept: in the group's own folder, under an id nobody could guess. */
export function picturePath(groupId: string, fileId: string): string {
  return `${groupId}/${fileId}.jpg`.toLowerCase();
}

/** A kept picture's place, if it is shaped the way the app names them (the same rule the database keeps). */
export function ownPicture(value: unknown): string | null {
  return typeof value === 'string' && PATH.test(value) ? value : null;
}

/**
 * The web address a kept picture is shown from. Anyone who has the address can open it, which is
 * what lets it show on a card like any picture on the web. Null without a usable place.
 */
export function pictureAddress(path: unknown, base: string | undefined = process.env.EXPO_PUBLIC_SUPABASE_URL): string | null {
  const place = ownPicture(path);
  if (!place || !base) return null;
  return usablePicture(`${base.replace(/\/+$/, '')}/storage/v1/object/public/${PICTURE_BUCKET}/${place}`);
}

/** As much of an idea as decides which picture its card shows. */
type Pictured = { picture?: string | null; photo?: unknown; image_url?: string | null; link?: string | null };

/**
 * The picture an idea's card shows: its own if it has one, otherwise a photo found by search
 * (src/lib/idea-photos.ts), otherwise the preview picture of the page it links to. Null when it
 * has none of them.
 */
export function cardPicture(idea: Pictured, base?: string): string | null {
  return pictureAddress(idea.picture, base) ?? ideaPhoto(idea.photo)?.url ?? (idea.link ? usablePicture(idea.image_url) : null);
}

/**
 * Who to credit under the picture an idea's card shows: the found photo, when that is the
 * picture on show. Null when the card shows the idea's own picture, its link's, or none.
 */
export function cardCredit(idea: Pictured, base?: string): IdeaPhoto | null {
  return pictureAddress(idea.picture, base) ? null : ideaPhoto(idea.photo);
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * A file's bytes from its Base64 text, which is how a phone hands over a picture it has just made.
 * A "data:" address is taken apart first. Anything that is not a Base64 letter is skipped.
 */
export function bytesFromBase64(text: string): Uint8Array {
  const clean = text.replace(/^data:[^,]*,/, '').replace(/[^A-Za-z0-9+/]/g, '');
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let at = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = LETTERS.indexOf(clean[i]);
    const b = i + 1 < clean.length ? LETTERS.indexOf(clean[i + 1]) : 0;
    const c = i + 2 < clean.length ? LETTERS.indexOf(clean[i + 2]) : -1;
    const d = i + 3 < clean.length ? LETTERS.indexOf(clean[i + 3]) : -1;
    if (at < bytes.length) bytes[at++] = (a << 2) | (b >> 4);
    if (c !== -1 && at < bytes.length) bytes[at++] = ((b & 15) << 4) | (c >> 2);
    if (d !== -1 && at < bytes.length) bytes[at++] = ((c & 3) << 6) | d;
  }
  return bytes;
}

/** How many bytes a file given as Base64 text holds, without unpacking it. */
export function base64Size(text: string): number {
  const clean = text.replace(/^data:[^,]*,/, '').replace(/[^A-Za-z0-9+/]/g, '');
  return Math.floor((clean.length * 3) / 4);
}

/**
 * Where to look for a picture on the web: a picture search for the idea's name, in the person's
 * own browser. Null when there is no name to search for yet.
 */
export function pictureSearch(name: string): string | null {
  const words = name.replace(/\s+/g, ' ').trim();
  return words ? `https://www.google.com/search?q=${encodeURIComponent(words)}&udm=2` : null;
}
