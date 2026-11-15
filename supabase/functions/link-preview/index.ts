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
//   * At most three redirects, eight seconds, and the first 300 KB of the page.
//   * It returns one thing: the address of a picture, or nothing. Never the page itself.

import { withSupabase } from 'npm:@supabase/server@^1';

const MAX_BYTES = 300_000;
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
 * The preview picture a page names for itself, as a full https address, or null if it names none
 * we can use. `pageUrl` is where the page was fetched from, for pictures given as relative paths.
 */
export function pictureFrom(html: string, pageUrl: string): string | null {
  const found = new Map<string, string>();
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const key = (attribute(tag, 'property') ?? attribute(tag, 'name') ?? '').toLowerCase();
    const value = attribute(tag, 'content');
    if (key && value && PICTURE_TAGS.includes(key) && !found.has(key)) found.set(key, value);
  }
  for (const key of PICTURE_TAGS) {
    const value = found.get(key);
    if (!value) continue;
    let picture: URL;
    try {
      picture = new URL(value, pageUrl);
    } catch {
      continue;
    }
    // Friends' phones and browsers load this, so it has to be a safe, secure, ordinary address.
    if (picture.protocol === 'http:') picture.protocol = 'https:';
    const safe = safeTarget(picture.toString());
    if (!safe || safe.protocol !== 'https:' || /\s/.test(safe.toString())) continue;
    return safe.toString();
  }
  return null;
}

/** Read at most `limit` bytes of a response as text. */
async function readStart(response: Response, limit: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < limit) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    size += value.length;
  }
  await reader.cancel().catch(() => {});
  const all = new Uint8Array(Math.min(size, limit));
  let at = 0;
  for (const chunk of chunks) {
    const part = chunk.subarray(0, Math.min(chunk.length, all.length - at));
    all.set(part, at);
    at += part.length;
    if (at >= all.length) break;
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(all);
}

/** Fetch a page, following a few redirects by hand so each stop can be checked, and find its picture. */
export async function previewPicture(input: unknown, fetcher: typeof fetch = fetch): Promise<string | null> {
  let target = safeTarget(input);
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  for (let hop = 0; target && hop <= MAX_REDIRECTS; hop++) {
    const response = await fetcher(target.toString(), {
      redirect: 'manual',
      signal,
      headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': 'Mozilla/5.0 (compatible; SomeDaisyLinkPreview/1.0; +https://somedaisy.com)' },
    });
    if (response.status >= 300 && response.status < 400) {
      const next = response.headers.get('location');
      await response.body?.cancel().catch(() => {});
      target = next ? safeTarget(new URL(next, target).toString()) : null;
      continue;
    }
    if (!response.ok || !/html/i.test(response.headers.get('content-type') ?? '')) {
      await response.body?.cancel().catch(() => {});
      return null;
    }
    return pictureFrom(await readStart(response, MAX_BYTES), target.toString());
  }
  return null;
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
      return Response.json({ image: await previewPicture(url) });
    } catch {
      // The page was slow, unreachable or odd. A missing picture is never an error for the app.
      return Response.json({ image: null });
    }
  }),
};
