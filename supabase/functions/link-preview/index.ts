// SomeDaisy server-side helper: find the preview picture of a web page.
//
// An idea can carry a link. The app asks this helper for the page's preview picture (the one a
// chat app would show for the link) and saves only that picture's web address on the idea.
// A browser cannot read another site's page itself, which is why this runs on the server.
//
// Deploying: see "Link previews" in README.md. This is one file on purpose, so it can be pasted
// into the Supabase dashboard's function editor.
//
// Safety, since this fetches addresses that people type:
//   * Only signed-in people can call it (auth: 'user').
//   * Only ordinary web addresses on the usual ports. Addresses that point at this server's own
//     network (localhost, private ranges, bare IP numbers) are refused, including after a redirect.
//   * At most three redirects and eight seconds. It reads a page only as far as the end of its
//     heading section, where the picture is named, and never more than the first 2 MB.
//   * It checks that the picture really is one, by asking for it under the same rules. If the
//     page names none that works, it offers the first real photo shown on the page instead.
//   * It returns one thing: the address of a picture, or nothing. Never the page itself.

import { withSupabase } from 'npm:@supabase/server@^1';

// Some large sites (video sites especially) name their picture most of a megabyte into the page.
const MAX_BYTES = 2_000_000;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 8000;
const MAX_URL = 2000;

/** The web address to fetch, or null if this is not one the helper will touch. */
export function safeTarget(input: unknown): URL | null {
  if (typeof input !== 'string' || input.length > MAX_URL) return null;
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (url.username || url.password) return null;
  if (url.port && url.port !== '80' && url.port !== '443') return null;
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  // A name with no dot (localhost, a machine on the local network) or a bare IP number, v4 or v6.
  if (!host.includes('.') || /^[\d.]+$/.test(host) || host.includes(':') || host.startsWith('[')) return null;
  if (/(^|\.)(localhost|local|internal|intranet|lan|home|corp|test|invalid|example)$/.test(host)) return null;
  // Numeric tricks such as 0x7f.0.0.1 or a name ending in a number.
  if (/^(0x[0-9a-f]+|\d+)$/.test(host.split('.').pop() ?? '')) return null;
  return url;
}

const decode = (s: string) =>
  s
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&#x0*27;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');

/** The value of one attribute inside a tag's text, or null. */
function attribute(tag: string, name: string): string | null {
  const match = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i').exec(tag);
  if (!match) return null;
  return decode(match[1] ?? match[2] ?? match[3] ?? '').trim();
}

// Where pages say what their preview picture is, best first.
const PICTURE_TAGS = ['og:image:secure_url', 'og:image:url', 'og:image', 'twitter:image', 'twitter:image:src'];

/**
 * A picture address found in a page, as a full https address friends' phones and browsers can
 * load safely, or null if it is not one. `pageUrl` is for pictures given as relative paths.
 */
function pictureAddress(value: string, pageUrl: string): string | null {
  let picture: URL;
  try {
    picture = new URL(value, pageUrl);
  } catch {
    return null;
  }
  if (picture.protocol === 'http:') picture.protocol = 'https:';
  const safe = safeTarget(picture.toString());
  if (!safe || safe.protocol !== 'https:' || /\s/.test(safe.toString())) return null;
  return safe.toString();
}

/** Every preview picture a page names for itself, best first, as full https addresses. */
export function picturesFrom(html: string, pageUrl: string): string[] {
  const found = new Map<string, string>();
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const key = (attribute(tag, 'property') ?? attribute(tag, 'name') ?? '').toLowerCase();
    const value = attribute(tag, 'content');
    if (key && value && PICTURE_TAGS.includes(key) && !found.has(key)) found.set(key, value);
  }
  const pictures: string[] = [];
  for (const key of PICTURE_TAGS) {
    const value = found.get(key);
    const picture = value ? pictureAddress(value, pageUrl) : null;
    if (picture && !pictures.includes(picture)) pictures.push(picture);
  }
  return pictures;
}

// Where pages say what they are called, best first.
const TITLE_TAGS = ['og:title', 'twitter:title'];
/** The longest page title passed on. The app shortens it further for an idea's name. */
const TITLE_MAX = 200;

/**
 * What a page calls itself, as one line of plain text: the title it gives for previews, or
 * failing that its own <title>. Null if it has neither.
 */
export function titleFrom(html: string): string | null {
  const found = new Map<string, string>();
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const key = (attribute(tag, 'property') ?? attribute(tag, 'name') ?? '').toLowerCase();
    const value = attribute(tag, 'content');
    if (key && value && TITLE_TAGS.includes(key) && !found.has(key)) found.set(key, value);
  }
  const own = /<title\b[^>]*>([^<]*)<\/title>/i.exec(html)?.[1];
  const title = (TITLE_TAGS.map((key) => found.get(key)).find(Boolean) ?? (own ? decode(own) : ''))
    // Tags and control characters have no place in a name.
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return title ? title.slice(0, TITLE_MAX).trim() : null;
}

/** The first preview picture a page names for itself, or null if it names none we can use. */
export function pictureFrom(html: string, pageUrl: string): string | null {
  return picturesFrom(html, pageUrl)[0] ?? null;
}

// Words in a picture's tag that mean it is decoration, not a photo of the thing itself.
const NOT_A_PHOTO = /logo|icon|sprite|pixel|avatar|badge|spinner|emoji|flag|placeholder|tracking/i;

/**
 * The photos shown on a page itself, in page order, for pages that name no working preview
 * picture. Leaves out logos, icons, drawings and anything the page says is small.
 */
export function photosFrom(html: string, pageUrl: string): string[] {
  const photos: string[] = [];
  for (const [tag] of html.matchAll(/<img\b[^>]*>/gi)) {
    if (NOT_A_PHOTO.test(tag)) continue;
    const source = attribute(tag, 'src') || attribute(tag, 'data-src');
    if (!source || /^data:/i.test(source) || /\.(svg|gif)([?#]|$)/i.test(source)) continue;
    const small = ['width', 'height'].some((side) => {
      const size = attribute(tag, side);
      return size !== null && /^\d+$/.test(size) && Number(size) < 200;
    });
    if (small) continue;
    const photo = pictureAddress(source, pageUrl);
    if (photo && !photos.includes(photo)) photos.push(photo);
  }
  return photos;
}

const HEAD_END = '</head>';

/**
 * Reads a page as text a piece at a time, never more than `limit` bytes in all. `upTo(mark)`
 * gives the text as far as the first `mark`, reading only as much as that takes; `upTo(null)`
 * gives everything up to the limit.
 */
function reading(response: Response, limit: number) {
  const reader = response.body?.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: false });
  let text = '';
  let size = 0;
  let ended = !reader;
  return {
    async upTo(mark: string | null): Promise<string> {
      let from = 0;
      for (;;) {
        if (mark) {
          const end = text.slice(from).toLowerCase().indexOf(mark);
          if (end !== -1) return text.slice(0, from + end + mark.length);
          // Next time look only at the new text, plus a little before it in case the mark was split.
          from = Math.max(0, text.length - mark.length);
        }
        if (ended || size >= limit || !reader) return text;
        const { done, value } = await reader.read();
        if (done || !value) {
          ended = true;
          continue;
        }
        const part = value.subarray(0, Math.min(value.length, limit - size));
        size += part.length;
        text += decoder.decode(part, { stream: true });
      }
    },
    async close(): Promise<void> {
      await reader?.cancel().catch(() => {});
    },
  };
}

/**
 * The picture for a YouTube video, worked out from the address alone. YouTube keeps every video's
 * picture at a fixed address, and often turns away servers that ask for the page itself, so this
 * is both quicker and more dependable than reading the page. Null for anything else.
 */
export function videoPicture(target: URL): string | null {
  const host = target.hostname.toLowerCase().replace(/^(www|m|music)\./, '');
  let id: string | null = null;
  if (host === 'youtu.be') id = target.pathname.split('/')[1] ?? null;
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const [, first, second] = target.pathname.split('/');
    if (first === 'watch') id = target.searchParams.get('v');
    else if (first === 'shorts' || first === 'embed' || first === 'live') id = second ?? null;
  }
  return id && /^[\w-]{6,20}$/.test(id) ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}

const AGENT = 'Mozilla/5.0 (compatible; SomeDaisyLinkPreview/1.0; +https://somedaisy.com)';

type Visit = { response: Response; at: URL } | { response: null; why: string };

/** Ask for an address, following a few redirects by hand so each stop can be checked. */
async function visit(start: URL, accept: string, fetcher: typeof fetch, signal: AbortSignal): Promise<Visit> {
  let target: URL | null = start;
  for (let hop = 0; target && hop <= MAX_REDIRECTS; hop++) {
    const response = await fetcher(target.toString(), { redirect: 'manual', signal, headers: { Accept: accept, 'User-Agent': AGENT } });
    if (response.status >= 300 && response.status < 400) {
      const next = response.headers.get('location');
      await response.body?.cancel().catch(() => {});
      target = next ? safeTarget(new URL(next, target).toString()) : null;
      continue;
    }
    return { response, at: target };
  }
  return { response: null, why: target ? 'too many redirects' : 'redirected somewhere this helper will not go' };
}

/**
 * Whether an address really gives a picture. Some pages name a "picture" that is another web
 * page or is long gone, which would leave a card with nothing to show. 'unsure' is for a site
 * that will not tell this helper either way, though it may well show the picture to a person.
 */
async function isPicture(address: string, fetcher: typeof fetch, signal: AbortSignal): Promise<'yes' | 'no' | 'unsure'> {
  const target = safeTarget(address);
  if (!target) return 'no';
  try {
    const got = await visit(target, 'image/*', fetcher, signal);
    if (!got.response) return 'no';
    await got.response.body?.cancel().catch(() => {});
    if (got.response.status === 404 || got.response.status === 410) return 'no';
    if (!got.response.ok) return 'unsure';
    const kind = (got.response.headers.get('content-type') ?? '').toLowerCase();
    if (kind.startsWith('text/') || kind.includes('svg')) return 'no';
    return kind.startsWith('image/') ? 'yes' : 'unsure';
  } catch {
    return 'unsure';
  }
}

// How many photos from the page itself are tried before giving up.
const PHOTOS_TRIED = 3;

/** What a look-up found, and in a few words why, for the helper's log. */
type Found = { image: string | null; title?: string | null; why: string };

/** Find the preview picture for a web address, or null if there is none to show. */
export async function previewPicture(input: unknown, fetcher: typeof fetch = fetch): Promise<string | null> {
  return (await lookUp(input, fetcher)).image;
}

/** The preview picture and the page's title for a web address. Either can be null. */
export async function preview(input: unknown, fetcher: typeof fetch = fetch): Promise<{ image: string | null; title: string | null }> {
  const found = await lookUp(input, fetcher);
  return { image: found.image, title: found.title ?? null };
}

async function lookUp(input: unknown, fetcher: typeof fetch): Promise<Found> {
  const target = safeTarget(input);
  if (!target) return { image: null, why: 'not an address this helper will fetch' };
  const video = videoPicture(target);
  if (video) return { image: video, why: 'video address' };
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  const got = await visit(target, 'text/html,application/xhtml+xml', fetcher, signal);
  if (!got.response) return { image: null, why: got.why };
  const { response, at } = got;
  const kind = response.headers.get('content-type') ?? '';
  // Some sites answer anything that is not a person's browser with a puzzle page instead of the
  // real one. That is their choice to make, so the helper stops there and says so in its log.
  if (response.headers.get('x-amzn-waf-action') || response.headers.get('cf-mitigated')) {
    await response.body?.cancel().catch(() => {});
    return { image: null, why: 'the site only lets browsers in' };
  }
  if (!response.ok || !/html/i.test(kind)) {
    await response.body?.cancel().catch(() => {});
    return { image: null, why: response.ok ? `not a web page (${kind.slice(0, 40)})` : `the site answered ${response.status}` };
  }
  const page = reading(response, MAX_BYTES);
  try {
    // First the picture the page names for itself, as long as it is not plainly broken.
    const head = await page.upTo(HEAD_END);
    const title = titleFrom(head);
    const named = picturesFrom(head, at.toString());
    for (const picture of named) {
      if ((await isPicture(picture, fetcher, signal)) !== 'no') return { image: picture, title, why: 'named by the page' };
    }
    // Otherwise the first real photo on the page, and only one that certainly loads.
    const photos = photosFrom(await page.upTo(null), at.toString());
    for (const photo of photos.slice(0, PHOTOS_TRIED)) {
      if ((await isPicture(photo, fetcher, signal)) === 'yes') return { image: photo, title, why: 'first photo on the page' };
    }
    return { image: null, title, why: `${named.length ? 'the picture the page names does not load' : 'the page names no picture'}, and it shows no usable photo` };
  } finally {
    await page.close();
  }
}

/** The site's name only, for the log: never the whole address someone typed. */
function siteOf(input: unknown): string {
  return safeTarget(input)?.hostname ?? 'unknown';
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (req: Request) => {
    if (req.method !== 'POST') return Response.json({ image: null }, { status: 405 });
    let url: unknown = null;
    try {
      url = ((await req.json()) as { url?: unknown } | null)?.url;
    } catch {
      // Not JSON: treated as no address.
    }
    try {
      const found = await lookUp(url, fetch);
      console.log(`${siteOf(url)}: ${found.image ? 'picture found' : 'no picture'}, ${found.why}`);
      return Response.json({ image: found.image, title: found.title ?? null });
    } catch (e) {
      // The page was slow, unreachable or odd. A missing picture is never an error for the app.
      console.log(`${siteOf(url)}: no picture, ${e instanceof Error ? e.name : 'failed'}`);
      return Response.json({ image: null });
    }
  }),
};
