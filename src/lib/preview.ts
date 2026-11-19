// Preview pictures for ideas with a link: the picture a chat app would show for that link.
//
// The app cannot read another site's page itself, so it asks a small server-side helper
// (supabase/functions/link-preview) for the picture's web address, and saves only that address
// on the idea (supabase/updates/011-link-previews.sql). No picture is ever stored.
//
// All of this is a nicety. If the helper or the database column is not set up, or the page has
// no picture, the idea simply has none, and nothing here fails loudly.

import { db } from './supabase';

/** Only a secure web address is shown as a picture, the same rule the database keeps. */
export function usablePicture(value: unknown): string | null {
  return typeof value === 'string' && value.length <= 2000 && /^https:\/\/\S+$/i.test(value) ? value : null;
}

/** What the form knows about the picture for the link in its box. */
export type LinkPreview =
  | { state: 'none' } // no link, or not a web address yet
  | { state: 'looking' }
  | { state: 'found'; link: string; picture: string; title: string | null }
  | { state: 'missing'; link: string; title: string | null }; // the page has no picture, or could not be read

/** A link, and the picture and page title found for it. Null picture: looked, and there is none. */
export type Looked = { link: string; picture: string | null; title?: string | null };

/** A page's title as one line of plain text, or null if there is nothing usable. */
export function usableTitle(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const title = value.replace(/\s+/g, ' ').trim();
  return title ? title.slice(0, 200).trim() : null;
}

/** The longest name an idea can have. */
export const TITLE_MAX = 120;

/**
 * A name for an idea, from the title of the page it links to. Pages add their site's name after
 * a bar or a dash ("Dune | Official Trailer - YouTube", "Taco Spot - Menu"), so only the part
 * before the first such break is kept. A colon is left alone: it is as often part of the name
 * ("Dune: Part Two") as not. The person can change the name either way.
 */
export function nameFromTitle(title: string): string {
  const whole = title.replace(/\s+/g, ' ').trim();
  const first = whole.split(/\s[|–—·-]\s/)[0].trim();
  return (first.length >= 3 ? first : whole).slice(0, TITLE_MAX).trim();
}

/**
 * Where the form stands for the link now in its box, given the latest lookup that came back.
 * A lookup for a different link (the one typed a moment ago) does not count.
 */
export function previewState(link: string | null, looked: Looked | null): LinkPreview {
  if (!link) return { state: 'none' };
  if (!looked || looked.link !== link) return { state: 'looking' };
  const picture = usablePicture(looked.picture);
  const title = usableTitle(looked.title);
  return picture ? { state: 'found', link, picture, title } : { state: 'missing', link, title };
}

/**
 * Ask the helper for a page's preview picture and its title. Either is null when the page has
 * none, could not be read, or the helper is not there. A helper from before it learned to read
 * titles simply gives none.
 */
export async function fetchPreview(link: string): Promise<{ picture: string | null; title: string | null }> {
  try {
    const { data, error } = await db().functions.invoke('link-preview', { body: { url: link } });
    if (error) return { picture: null, title: null };
    const found = data as { image?: unknown; title?: unknown } | null;
    return { picture: usablePicture(found?.image), title: usableTitle(found?.title) };
  } catch {
    return { picture: null, title: null };
  }
}

/** Ask the helper for a page's preview picture. Null when there is none, or the helper is not there. */
export async function fetchPreviewPicture(link: string): Promise<string | null> {
  return (await fetchPreview(link)).picture;
}

/**
 * Find the picture for an idea's link and save it on the idea. Call it after saving the idea,
 * without waiting for it: the picture turns up on the card a moment later. Returns whether a
 * picture was saved. `known` is the picture, when it has been looked up already.
 */
export async function attachPreview(ideaId: string, link: string, known?: string | null): Promise<boolean> {
  // The form may have found the picture already, while the link was being typed.
  const picture = usablePicture(known) ?? (await fetchPreviewPicture(link));
  if (!picture) return false;
  try {
    // Saved only if the idea still has this link: it may have been edited again in the meantime.
    const { error } = await db().from('ideas').update({ image_url: picture }).eq('id', ideaId).eq('link', link);
    return !error;
  } catch {
    return false;
  }
}
