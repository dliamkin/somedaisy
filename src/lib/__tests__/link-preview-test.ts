// Tests for the server-side helper in supabase/functions/link-preview/index.ts. It runs on
// Supabase, not in the app, but its page-reading and safety rules are plain functions that can
// be checked here. The Supabase wrapper it imports only exists on the server, so it is replaced.

jest.mock('npm:@supabase/server@^1', () => ({ withSupabase: (_options: unknown, handler: unknown) => handler }), { virtual: true });

type Helper = {
  safeTarget: (input: unknown) => URL | null;
  pictureFrom: (html: string, pageUrl: string) => string | null;
  titleFrom: (html: string) => string | null;
  searchedFor: (at: URL) => string | null;
  preview: (input: unknown, fetcher: (url: string, init?: unknown) => Promise<Response>) => Promise<{ image: string | null; title: string | null }>;
  previewPicture: (input: unknown, fetcher: (url: string, init?: unknown) => Promise<Response>) => Promise<string | null>;
  default: { fetch: (req: Request) => Promise<Response> };
};
const helper = jest.requireActual<Helper>('../../../supabase/functions/link-preview/index');
const { safeTarget, pictureFrom, previewPicture, titleFrom, searchedFor, preview } = helper;

const page = (head: string) => `<!doctype html><html><head>${head}</head><body>hi</body></html>`;

describe('safeTarget', () => {
  it('accepts ordinary web addresses', () => {
    expect(safeTarget('https://example.org/menu?x=1')?.toString()).toBe('https://example.org/menu?x=1');
    expect(safeTarget('http://www.example.org')?.hostname).toBe('www.example.org');
    expect(safeTarget('https://example.org:443/a')).not.toBeNull();
  });

  it('refuses anything that is not a web address', () => {
    for (const bad of [null, 42, '', 'tacos', 'ftp://example.org/a', 'file:///etc/passwd', 'javascript:alert(1)', 'data:text/html,hi']) {
      expect(safeTarget(bad)).toBeNull();
    }
  });

  it('refuses addresses that point at the server itself or a private network', () => {
    for (const bad of [
      'http://localhost/admin',
      'http://127.0.0.1/',
      'http://10.0.0.5/',
      'http://192.168.1.1/router',
      'http://169.254.169.254/latest/meta-data',
      'http://[::1]/',
      'http://0x7f.0.0.1/',
      'http://2130706433/',
      'http://intranet/',
      'http://db.internal/',
      'http://printer.local/',
      'http://example.org.127.0.0.1/',
    ]) {
      expect(safeTarget(bad)).toBeNull();
    }
  });

  it('refuses odd ports, sign-in details in the address, and very long addresses', () => {
    expect(safeTarget('https://example.org:8443/')).toBeNull();
    expect(safeTarget('https://example.org:22/')).toBeNull();
    expect(safeTarget('https://user:pass@example.org/')).toBeNull();
    expect(safeTarget(`https://example.org/${'a'.repeat(2000)}`)).toBeNull();
  });
});

describe('pictureFrom', () => {
  it('finds the picture a page names for sharing', () => {
    expect(pictureFrom(page('<meta property="og:image" content="https://cdn.example.org/a.jpg">'), 'https://example.org/x')).toBe('https://cdn.example.org/a.jpg');
  });

  it('reads the attributes in either order and with either kind of quote, or none', () => {
    expect(pictureFrom(page(`<meta content='https://cdn.example.org/b.jpg' property='og:image' />`), 'https://example.org')).toBe('https://cdn.example.org/b.jpg');
    expect(pictureFrom(page('<META NAME=twitter:image CONTENT=https://cdn.example.org/c.jpg>'), 'https://example.org')).toBe('https://cdn.example.org/c.jpg');
  });

  it('prefers the sharing picture over the Twitter one, wherever they sit', () => {
    const html = page('<meta name="twitter:image" content="https://cdn.example.org/t.jpg"><meta property="og:image" content="https://cdn.example.org/o.jpg">');
    expect(pictureFrom(html, 'https://example.org')).toBe('https://cdn.example.org/o.jpg');
  });

  it('completes a picture given as a path, and undoes the page\'s own escaping', () => {
    expect(pictureFrom(page('<meta property="og:image" content="/img/a.jpg?w=1&amp;h=2">'), 'https://example.org/posts/1')).toBe('https://example.org/img/a.jpg?w=1&h=2');
    expect(pictureFrom(page('<meta property="og:image" content="//cdn.example.org/a.jpg">'), 'https://example.org/')).toBe('https://cdn.example.org/a.jpg');
  });

  it('always answers with a secure address', () => {
    expect(pictureFrom(page('<meta property="og:image" content="http://cdn.example.org/a.jpg">'), 'http://example.org/')).toBe('https://cdn.example.org/a.jpg');
  });

  it('refuses a picture that is not an ordinary web address, and falls back to the next one', () => {
    expect(pictureFrom(page('<meta property="og:image" content="javascript:alert(1)">'), 'https://example.org')).toBeNull();
    expect(pictureFrom(page('<meta property="og:image" content="data:image/png;base64,AAAA">'), 'https://example.org')).toBeNull();
    expect(pictureFrom(page('<meta property="og:image" content="http://192.168.1.1/cam.jpg">'), 'https://example.org')).toBeNull();
    const html = page('<meta property="og:image" content="http://localhost/a.jpg"><meta name="twitter:image" content="https://cdn.example.org/t.jpg">');
    expect(pictureFrom(html, 'https://example.org')).toBe('https://cdn.example.org/t.jpg');
  });

  it('answers nothing for a page with no picture, or no page at all', () => {
    expect(pictureFrom(page('<title>Hi</title><meta name="description" content="x">'), 'https://example.org')).toBeNull();
    expect(pictureFrom('', 'https://example.org')).toBeNull();
    expect(pictureFrom(page('<meta property="og:image" content="">'), 'https://example.org')).toBeNull();
  });
});

describe('previewPicture', () => {
  const html = (body: string, status = 200, headers: Record<string, string> = { 'content-type': 'text/html; charset=utf-8' }) =>
    new Response(body, { status, headers });
  const redirect = (to: string) => new Response(null, { status: 302, headers: { location: to } });
  const og = page('<meta property="og:image" content="https://cdn.example.org/a.jpg">');
  const jpeg = () => new Response('', { status: 200, headers: { 'content-type': 'image/jpeg' } });
  // A pretend web: anything on cdn.example.org is a photo, everything else is answered by `pages`.
  const web = (pages: (url: string) => Response) => jest.fn(async (url: string) => (url.startsWith('https://cdn.example.org/') ? jpeg() : pages(url)));

  it('fetches the page, checks its picture and returns it', async () => {
    const fetcher = web(() => html(og));
    expect(await previewPicture('https://example.org/x', fetcher)).toBe('https://cdn.example.org/a.jpg');
    expect(fetcher.mock.calls.map((c) => c[0])).toEqual(['https://example.org/x', 'https://cdn.example.org/a.jpg']);
    expect(fetcher.mock.calls[0]).toMatchObject(['https://example.org/x', { redirect: 'manual' }]);
  });

  it('passes over a named picture that is really a web page, and uses the first photo on the page', async () => {
    const body =
      '<img class="logo" src="https://cdn.example.org/logo.png"><img src="/art/drawing.svg"><img src="https://cdn.example.org/tiny.jpg" width="40">' +
      '<img class="Hero-image" src="//cdn.example.org/hero.jpg" alt=""><img src="https://cdn.example.org/second.jpg">';
    const broken = `<html><head><meta property="og:image" content="https://example.org/"></head><body>${body}</body></html>`;
    const fetcher = web(() => html(broken));
    expect(await previewPicture('https://example.org/place', fetcher)).toBe('https://cdn.example.org/hero.jpg');
    expect(fetcher.mock.calls.map((c) => c[0])).toEqual(['https://example.org/place', 'https://example.org/', 'https://cdn.example.org/hero.jpg']);
  });

  it('stops at a site that only lets browsers in, and takes nothing from its puzzle page', async () => {
    const puzzle = () => html(og, 202, { 'content-type': 'text/html', 'x-amzn-waf-action': 'challenge' });
    const fetcher = web(puzzle);
    expect(await previewPicture('https://example.org/x', fetcher)).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('passes over a named picture that is gone', async () => {
    const fetcher = jest.fn(async (url: string) => (url.endsWith('.jpg') ? html('gone', 404) : html(og)));
    expect(await previewPicture('https://example.org/x', fetcher)).toBeNull();
  });

  it('keeps a named picture when its site will not say either way', async () => {
    const refused = jest.fn(async (url: string) => (url.endsWith('.jpg') ? html('no robots', 403) : html(og)));
    expect(await previewPicture('https://example.org/x', refused)).toBe('https://cdn.example.org/a.jpg');
    const down = jest.fn(async (url: string) => {
      if (url.endsWith('.jpg')) throw new Error('network');
      return html(og);
    });
    expect(await previewPicture('https://example.org/x', down)).toBe('https://cdn.example.org/a.jpg');
  });

  it('only uses a photo from the page when it certainly loads, and tries no more than three', async () => {
    const photos = [1, 2, 3, 4].map((n) => `<img src="https://photos.example.org/${n}.jpg">`).join('');
    const fetcher = jest.fn(async (url: string) => (url.endsWith('.jpg') ? html('no robots', 403) : html(page('') + photos)));
    expect(await previewPicture('https://example.org/x', fetcher)).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it('never fetches an address it should not touch', async () => {
    const fetcher = jest.fn(async () => html(og));
    expect(await previewPicture('http://169.254.169.254/latest/meta-data', fetcher)).toBeNull();
    expect(await previewPicture('file:///etc/passwd', fetcher)).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('follows a redirect to another site', async () => {
    const fetcher = web((url) => (url === 'https://short.example.org/a' ? redirect('https://example.org/long') : html(og)));
    expect(await previewPicture('https://short.example.org/a', fetcher)).toBe('https://cdn.example.org/a.jpg');
    expect(fetcher.mock.calls.map((c) => c[0])).toEqual(['https://short.example.org/a', 'https://example.org/long', 'https://cdn.example.org/a.jpg']);
  });

  it('stops when a redirect points somewhere it should not go', async () => {
    const fetcher = jest.fn(async () => redirect('http://127.0.0.1/admin'));
    expect(await previewPicture('https://example.org/x', fetcher)).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('gives up after a few redirects', async () => {
    const fetcher = jest.fn(async () => redirect('https://example.org/again'));
    expect(await previewPicture('https://example.org/x', fetcher)).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it('answers nothing for a missing page or something that is not a web page', async () => {
    expect(await previewPicture('https://example.org/x', async () => html('gone', 404))).toBeNull();
    expect(await previewPicture('https://example.org/x', async () => html(og, 200, { 'content-type': 'application/pdf' }))).toBeNull();
  });

  it('works out a video picture from the address without fetching anything', async () => {
    const fetcher = jest.fn(async () => html(og));
    const picture = 'https://i.ytimg.com/vi/IeFWNtMo1Fs/hqdefault.jpg';
    expect(await previewPicture('https://www.youtube.com/watch?v=IeFWNtMo1Fs', fetcher)).toBe(picture);
    expect(await previewPicture('https://youtu.be/IeFWNtMo1Fs?t=10', fetcher)).toBe(picture);
    expect(await previewPicture('https://m.youtube.com/shorts/IeFWNtMo1Fs', fetcher)).toBe(picture);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('reads the page as usual for a video site address that is not a video', async () => {
    const fetcher = web(() => html(og));
    expect(await previewPicture('https://www.youtube.com/@somechannel', fetcher)).toBe('https://cdn.example.org/a.jpg');
    expect(await previewPicture('https://www.youtube.com/watch?v=bad id!', fetcher)).toBe('https://cdn.example.org/a.jpg');
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it('stops reading at the end of the heading section', async () => {
    const big = page('<meta property="og:image" content="https://cdn.example.org/a.jpg">') + 'x'.repeat(400_000) + '<meta property="og:image:secure_url" content="https://cdn.example.org/late.jpg">';
    expect(await previewPicture('https://example.org/x', web(() => html(big)))).toBe('https://cdn.example.org/a.jpg');
  });

  it('finds a picture named a long way into the heading section, as video sites do', async () => {
    const deep = page(`<style>${'x'.repeat(800_000)}</style><meta property="og:image" content="https://cdn.example.org/a.jpg">`);
    expect(await previewPicture('https://example.org/x', web(() => html(deep)))).toBe('https://cdn.example.org/a.jpg');
  });

  it('gives up on a page that names its picture beyond the first 2 MB', async () => {
    const endless = page(`<style>${'x'.repeat(2_100_000)}</style><meta property="og:image" content="https://cdn.example.org/a.jpg">`);
    expect(await previewPicture('https://example.org/x', web(() => html(endless)))).toBeNull();
  });
});

describe('the helper itself', () => {
  const call = (body: unknown, method = 'POST') =>
    helper.default.fetch(new Request('https://project.example.org/functions/v1/link-preview', { method, body: method === 'POST' ? JSON.stringify(body) : undefined }));

  it('answers with no picture, not an error, for an address it will not fetch', async () => {
    const response = await call({ url: 'http://localhost/' });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ image: null, title: null });
  });

  it('answers with no picture when given nothing sensible', async () => {
    expect(await (await call({})).json()).toEqual({ image: null, title: null });
    expect(await (await call('nonsense')).json()).toEqual({ image: null, title: null });
  });

  it('only takes POST', async () => {
    expect((await call(null, 'GET')).status).toBe(405);
  });
});

describe('titleFrom', () => {
  it('prefers the title a page gives for previews', () => {
    expect(titleFrom(page('<title>Home</title><meta property="og:title" content="Sunrise Mini Golf: 18 holes">'))).toBe('Sunrise Mini Golf: 18 holes');
    expect(titleFrom(page('<meta name="twitter:title" content="Taco Spot">'))).toBe('Taco Spot');
  });

  it('falls back to the page title, as one tidy line', () => {
    expect(titleFrom(page('<title>\n  Dune &amp; friends \n</title>'))).toBe('Dune & friends');
  });

  it('is nothing when the page does not say', () => {
    expect(titleFrom(page(''))).toBeNull();
    expect(titleFrom(page('<title>   </title>'))).toBeNull();
  });
});

describe('searchedFor', () => {
  it('gives the words searched for on a page of Google results, in any country', () => {
    expect(searchedFor(new URL('https://www.google.com/search?sa=X&kgmid=/g/11ghq_r34j&q=Native+Rhythms+Festival&shem=dlvs1,epsd1'))).toBe('Native Rhythms Festival');
    expect(searchedFor(new URL('https://www.google.co.uk/search?q=fish%20and%20chips'))).toBe('fish and chips');
    expect(searchedFor(new URL('https://google.de/search?q=%20%20Kino%20%20heute%20'))).toBe('Kino heute');
  });

  it('is nothing for a Google page that was not a search, or a search for nothing', () => {
    expect(searchedFor(new URL('https://www.google.com/searchviewer/10?svid=abc'))).toBeNull();
    expect(searchedFor(new URL('https://www.google.com/search?q='))).toBeNull();
    expect(searchedFor(new URL('https://www.google.com/maps/place/Taco+Spot'))).toBeNull();
  });

  it('is nothing for any other site, whatever its address says', () => {
    expect(searchedFor(new URL('https://example.org/search?q=tacos'))).toBeNull();
    expect(searchedFor(new URL('https://notgoogle.com/search?q=tacos'))).toBeNull();
    expect(searchedFor(new URL('https://google.example.org/search?q=tacos'))).toBeNull();
  });
});

describe('preview, for a result shared from Google', () => {
  const html = (body: string, status = 200) => new Response(body, { status, headers: { 'content-type': 'text/html; charset=UTF-8' } });
  const redirect = (to: string) => new Response(null, { status: 302, headers: { location: to } });
  const results = 'https://www.google.com/search?sa=X&q=Native+Rhythms+Festival';
  const shared = (answer: () => Response) =>
    jest.fn(async (url: string) => {
      if (url === 'https://share.google/5FWY') return redirect('https://www.google.com/share.google?q=5FWY');
      if (url === 'https://www.google.com/share.google?q=5FWY') return redirect(results);
      return answer();
    });

  it('names the idea for what was searched, not "Google Search"', async () => {
    const fetcher = shared(() => html(page('<title>Google Search</title>')));
    expect(await preview('https://share.google/5FWY', fetcher)).toEqual({ image: null, title: 'Native Rhythms Festival' });
  });

  it('still gives the name when Google turns the helper away', async () => {
    const fetcher = shared(() => html('Too many requests', 429));
    expect(await preview('https://share.google/5FWY', fetcher)).toEqual({ image: null, title: 'Native Rhythms Festival' });
  });

  it('gives no name for a Google page that does not say what it shows', async () => {
    const fetcher = jest.fn(async () => html(page('<title>Place Viewer</title>')));
    expect(await preview('https://www.google.com/searchviewer/10?svid=abc', fetcher)).toEqual({ image: null, title: null });
  });

  it('leaves every other site named by its own page', async () => {
    const fetcher = jest.fn(async () => html(page('<title>Taco Spot</title>')));
    expect(await preview('https://example.org/search?q=tacos', fetcher)).toEqual({ image: null, title: 'Taco Spot' });
  });
});
