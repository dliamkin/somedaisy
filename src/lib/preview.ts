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

/** Ask the helper for a page's preview picture. Null when there is none, or the helper is not there. */
export async function fetchPreviewPicture(link: string): Promise<string | null> {
  try {
    const { data, error } = await db().functions.invoke('link-preview', { body: { url: link } });
    if (error) return null;
    return usablePicture((data as { image?: unknown } | null)?.image);
  } catch {
    return null;
  }
}

/**
 * Find the picture for an idea's link and save it on the idea. Call it after saving the idea,
 * without waiting for it: the picture turns up on the card a moment later. Returns whether a
 * picture was saved.
 */
export async function attachPreview(ideaId: string, link: string): Promise<boolean> {
  const picture = await fetchPreviewPicture(link);
  if (!picture) return false;
  try {
    // Saved only if the idea still has this link: it may have been edited again in the meantime.
    const { error } = await db().from('ideas').update({ image_url: picture }).eq('id', ideaId).eq('link', link);
    return !error;
  } catch {
    return false;
  }
}
