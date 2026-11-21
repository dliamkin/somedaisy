// SomeDaisy server-side helper: search free photos for a group's cover.
//
// A group can use a photo from Unsplash as its cover. The app asks this helper to search, so the
// key Unsplash gives us is never in the app. Nothing is stored here or anywhere else but the
// photo's web address and who took it, which the app saves on the group.
//
// Deploying: see "Photo search" in README.md. This is one file on purpose, so it can be pasted
// into the Supabase dashboard's function editor. It needs one secret, UNSPLASH_ACCESS_KEY, set
// under Edge Functions > Secrets in the dashboard. Without it the helper answers that search is
// off, and the app says so.
//
// It does two things, both by POST:
//   * { "query": "beach" } gives up to twelve photos, each with its two addresses (a small one
//     for the grid, a bigger one for the cover), who took it, and a link to their page.
//   * { "chosen": "<address>" } tells Unsplash that a photo was put to use, which it asks to be
//     told. The address is the one that came with the photo, and nothing else is accepted.
//
// Unsplash's rules, which this helper and the app follow together:
//   * Photos are shown from Unsplash's own servers, at the addresses it gives, unchanged.
//   * Wherever a photo shows, so does "Photo by <name> on Unsplash", with links to both, and
//     every link to Unsplash says which app it came from.
//   * Unsplash is told when a photo is chosen as a cover.
//
// Safety:
//   * Only signed-in people can call it (auth: 'user').
//   * It only ever talks to api.unsplash.com, and only passes on addresses that are on Unsplash.
//   * Its log says how many photos were found, never what was searched for.

import { withSupabase } from 'npm:@supabase/server@^1';

const API = 'https://api.unsplash.com';
/** The name of the secret that holds the key from Unsplash. */
export const SECRET = 'UNSPLASH_ACCESS_KEY';
/** What this app is called in links to Unsplash, which Unsplash asks every link to carry. */
const APP = 'somedaisy';
/** How many photos one search gives: four rows of three. */
const PER_PAGE = 12;
const QUERY_MAX = 60;
const NAME_MAX = 80;
const ALT_MAX = 140;
const TIMEOUT_MS = 8000;

/** One photo, as the app is given it. */
export type Photo = {
  id: string;
  /** A small copy, for the grid of results. */
  thumb: string;
  /** The copy shown as a cover. */
  url: string;
  /** What the photo shows, in words, when Unsplash says. */
  alt: string | null;
  /** Who took it. */
  name: string;
  /** Their page on Unsplash. */
  profile: string;
  /** The address to tell Unsplash on, if this photo is chosen. */
  chosen: string | null;
};

/** Why a search gave nothing: it is not set up, Unsplash's hourly limit is used up, or it failed. */
export type Why = 'off' | 'busy' | 'failed';
export type Answer = { photos: Photo[]; why?: Why };

/** The words to search for, tidied, or null when there is nothing worth searching for. */
export function cleanQuery(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const words = input.replace(/\s+/g, ' ').trim().slice(0, QUERY_MAX).trim();
  return words.length >= 2 ? words : null;
}

/** Whether a value is a secure web address on a site this helper trusts. */
function onSite(value: unknown, site: (host: string) => boolean): value is string {
  if (typeof value !== 'string' || value.length > 1000 || /\s/.test(value)) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
  return site(url.hostname.toLowerCase());
}

const photoSite = (host: string) => host.endsWith('.unsplash.com');
const mainSite = (host: string) => host === 'unsplash.com' || host === 'www.unsplash.com';

/**
 * The address to tell Unsplash on that a photo was chosen, or null if this is not one. Only the
 * address Unsplash itself gives with a photo is accepted, so this helper cannot be made to call
 * anywhere else.
 */
export function chosenTarget(input: unknown): string | null {
  if (!onSite(input, (host) => host === 'api.unsplash.com')) return null;
  return /^\/photos\/[\w-]{1,40}\/download$/.test(new URL(input).pathname) ? input : null;
}

/** A photographer's page on Unsplash, with the words Unsplash asks every link to it to carry. */
export function profileLink(input: unknown): string | null {
  if (!onSite(input, mainSite)) return null;
  const url = new URL(input);
  url.searchParams.set('utm_source', APP);
  url.searchParams.set('utm_medium', 'referral');
  url.hash = '';
  return url.toString();
}

/** One line of plain text, no longer than `most`, or null if there is nothing left. */
function line(value: unknown, most: number): string | null {
  if (typeof value !== 'string') return null;
  // Control characters have no place in a name.
  const text = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, most).trim();
  return text || null;
}

type Result = {
  id?: unknown;
  alt_description?: unknown;
  urls?: { small?: unknown; regular?: unknown } | null;
  links?: { download_location?: unknown } | null;
  user?: { name?: unknown; links?: { html?: unknown } | null } | null;
};

/**
 * One of Unsplash's results as the app is given it, or null if anything the app needs is missing.
 * The photo's addresses are passed on exactly as Unsplash gives them.
 */
export function photoFrom(result: unknown): Photo | null {
  const r = result as Result | null;
  if (!r || typeof r !== 'object') return null;
  const id = typeof r.id === 'string' && /^[\w-]{1,40}$/.test(r.id) ? r.id : null;
  const small = r.urls?.small;
  const regular = r.urls?.regular;
  const thumb = onSite(small, photoSite) ? small : null;
  const url = onSite(regular, photoSite) ? regular : null;
  const name = line(r.user?.name, NAME_MAX);
  const profile = profileLink(r.user?.links?.html);
  if (!id || !thumb || !url || !name || !profile) return null;
  return { id, thumb, url, alt: line(r.alt_description, ALT_MAX), name, profile, chosen: chosenTarget(r.links?.download_location) };
}

function headers(key: string): Record<string, string> {
  return { Authorization: `Client-ID ${key}`, 'Accept-Version': 'v1', Accept: 'application/json' };
}

/**
 * Search Unsplash. Photos wide enough for a cover, and with Unsplash's stricter filter on what
 * they show. `key` is the key from Unsplash, or nothing when it has not been set.
 */
export async function search(query: unknown, key: string | null | undefined, fetcher: typeof fetch = fetch): Promise<Answer> {
  if (!key) return { photos: [], why: 'off' };
  const words = cleanQuery(query);
  if (!words) return { photos: [] };
  const asked = new URLSearchParams({ query: words, per_page: String(PER_PAGE), orientation: 'landscape', content_filter: 'high' });
  const response = await fetcher(`${API}/search/photos?${asked.toString()}`, { headers: headers(key), signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) {
    const said = await response.text().catch(() => '');
    // Unsplash allows so many searches an hour, across everyone using the app.
    const spent = response.status === 429 || (response.status === 403 && (response.headers.get('x-ratelimit-remaining') === '0' || /rate limit/i.test(said)));
    // A key Unsplash does not know is the same, to the app, as no key.
    return { photos: [], why: spent ? 'busy' : response.status === 401 ? 'off' : 'failed' };
  }
  const body = (await response.json()) as { results?: unknown } | null;
  const results = Array.isArray(body?.results) ? body.results : [];
  const photos = results.map(photoFrom).filter((photo): photo is Photo => photo !== null);
  return { photos: photos.slice(0, PER_PAGE) };
}

/** Tell Unsplash that a photo was chosen as a cover. Answers whether it was told. */
export async function tellChosen(location: unknown, key: string | null | undefined, fetcher: typeof fetch = fetch): Promise<boolean> {
  const target = chosenTarget(location);
  if (!key || !target) return false;
  const response = await fetcher(target, { headers: headers(key), signal: AbortSignal.timeout(TIMEOUT_MS) });
  await response.body?.cancel().catch(() => {});
  return response.ok;
}

/** The key from Unsplash, from this helper's secrets. Nothing when it has not been set. */
function secret(): string | null {
  const server = (globalThis as { Deno?: { env?: { get?: (name: string) => string | undefined } } }).Deno;
  return server?.env?.get?.(SECRET)?.trim() || null;
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (req: Request) => {
    if (req.method !== 'POST') return Response.json({ photos: [] }, { status: 405 });
    let body: { query?: unknown; chosen?: unknown } | null = null;
    try {
      const sent: unknown = await req.json();
      if (sent && typeof sent === 'object') body = sent as { query?: unknown; chosen?: unknown };
    } catch {
      // Not JSON: treated as nothing asked.
    }
    const key = secret();
    try {
      if (body && body.chosen !== undefined) {
        const told = await tellChosen(body.chosen, key, fetch);
        console.log(`chosen: ${told ? 'Unsplash was told' : 'Unsplash was not told'}`);
        return Response.json({ told });
      }
      const answer = await search(body?.query, key, fetch);
      console.log(`search: ${answer.photos.length} photos${answer.why ? `, ${answer.why}` : ''}`);
      return Response.json(answer);
    } catch (e) {
      // Unsplash was slow or could not be reached. The app says to try again.
      console.log(`failed: ${e instanceof Error ? e.name : 'unknown'}`);
      return Response.json(body && body.chosen !== undefined ? { told: false } : { photos: [], why: 'failed' });
    }
  }),
};
