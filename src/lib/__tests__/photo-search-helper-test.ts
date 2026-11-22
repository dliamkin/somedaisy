// Tests for the server-side helper in supabase/functions/photo-search/index.ts. It runs on
// Supabase, not in the app, but its rules are plain functions that can be checked here. The
// Supabase wrapper it imports only exists on the server, so it is replaced.

jest.mock('npm:@supabase/server@^1', () => ({ withSupabase: (_options: unknown, handler: unknown) => handler }), { virtual: true });

type Photo = { id: string; thumb: string; url: string; alt: string | null; name: string; profile: string; chosen: string | null };
type Fetcher = (url: string, init?: { headers?: Record<string, string> }) => Promise<Response>;
type Helper = {
  SECRET: string;
  cleanQuery: (input: unknown) => string | null;
  chosenTarget: (input: unknown) => string | null;
  profileLink: (input: unknown) => string | null;
  photoFrom: (result: unknown) => Photo | null;
  search: (query: unknown, key: string | null | undefined, fetcher: Fetcher) => Promise<{ photos: Photo[]; why?: string }>;
  tellChosen: (location: unknown, key: string | null | undefined, fetcher: Fetcher) => Promise<boolean>;
  withinShare: (client: Asker | null | undefined, kind: 'search' | 'chosen') => Promise<boolean>;
  default: { fetch: (req: Request, ctx?: { supabase?: Asker }) => Promise<Response> };
};
type Asker = { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> };
const helper = jest.requireActual<Helper>('../../../supabase/functions/photo-search/index');
const { cleanQuery, chosenTarget, profileLink, photoFrom, search, tellChosen, withinShare } = helper;

const LOCATION = 'https://api.unsplash.com/photos/LBI7cgq3pbM/download?ixid=abc123';

/** One result, the way Unsplash sends it. */
const result = (change: Record<string, unknown> = {}) => ({
  id: 'LBI7cgq3pbM',
  width: 5000,
  height: 3000,
  alt_description: 'a beach at sunset',
  urls: {
    raw: 'https://images.unsplash.com/photo-1?ixid=abc123',
    regular: 'https://images.unsplash.com/photo-1?ixid=abc123&w=1080&q=80&fit=max',
    small: 'https://images.unsplash.com/photo-1?ixid=abc123&w=400&q=80&fit=max',
  },
  links: { html: 'https://unsplash.com/photos/LBI7cgq3pbM', download: 'https://unsplash.com/photos/LBI7cgq3pbM/download', download_location: LOCATION },
  user: { name: 'Ann Example', username: 'ann', links: { html: 'https://unsplash.com/@ann' } },
  ...change,
});

const answers = (body: unknown, status = 200, headers: Record<string, string> = {}): Fetcher => jest.fn(async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers }));

describe('cleanQuery', () => {
  it('tidies what was typed', () => {
    expect(cleanQuery('  sunny   beach \n')).toBe('sunny beach');
    expect(cleanQuery('x'.repeat(200))).toHaveLength(60);
  });

  it('is nothing for too little, or for anything that is not words', () => {
    for (const bad of [null, undefined, 42, {}, '', ' ', 'a']) expect(cleanQuery(bad)).toBeNull();
  });
});

describe('chosenTarget', () => {
  it('accepts the address Unsplash gives with a photo, unchanged', () => {
    expect(chosenTarget(LOCATION)).toBe(LOCATION);
    expect(chosenTarget('https://api.unsplash.com/photos/a-b_C1/download')).toBe('https://api.unsplash.com/photos/a-b_C1/download');
  });

  it('refuses any other address, so the helper cannot be made to call anywhere else', () => {
    for (const bad of [
      null,
      42,
      '',
      'http://api.unsplash.com/photos/abc/download',
      'https://api.unsplash.com/photos/abc',
      'https://api.unsplash.com/photos/abc/download/extra',
      'https://api.unsplash.com/users/abc/download',
      'https://api.unsplash.com.example.org/photos/abc/download',
      'https://example.org/photos/abc/download',
      'https://someone@api.unsplash.com/photos/abc/download',
      'https://api.unsplash.com:8443/photos/abc/download',
      'https://localhost/photos/abc/download',
      'https://api.unsplash.com/photos/a b/download',
    ]) {
      expect(chosenTarget(bad)).toBeNull();
    }
  });
});

describe('profileLink', () => {
  it('adds what Unsplash asks every link to carry', () => {
    expect(profileLink('https://unsplash.com/@ann')).toBe('https://unsplash.com/@ann?utm_source=somedaisy&utm_medium=referral');
    // Whatever the address already said about where it came from is replaced.
    expect(profileLink('https://unsplash.com/@ann?utm_source=other#top')).toBe('https://unsplash.com/@ann?utm_source=somedaisy&utm_medium=referral');
  });

  it('refuses a page that is not on Unsplash', () => {
    for (const bad of [null, 'https://example.org/@ann', 'http://unsplash.com/@ann', 'https://unsplash.com.example.org/@ann', 'javascript:alert(1)']) expect(profileLink(bad)).toBeNull();
  });
});

describe('photoFrom', () => {
  it('passes on what the app needs, with the photo addresses exactly as Unsplash gives them', () => {
    expect(photoFrom(result())).toEqual({
      id: 'LBI7cgq3pbM',
      thumb: 'https://images.unsplash.com/photo-1?ixid=abc123&w=400&q=80&fit=max',
      url: 'https://images.unsplash.com/photo-1?ixid=abc123&w=1080&q=80&fit=max',
      alt: 'a beach at sunset',
      name: 'Ann Example',
      profile: 'https://unsplash.com/@ann?utm_source=somedaisy&utm_medium=referral',
      chosen: LOCATION,
    });
  });

  it('never passes on the address that downloads the file', () => {
    expect(JSON.stringify(photoFrom(result()))).not.toContain('/photos/LBI7cgq3pbM/download"');
  });

  it('does without a description, and without an address to tell Unsplash on', () => {
    expect(photoFrom(result({ alt_description: null }))?.alt).toBeNull();
    expect(photoFrom(result({ links: {} }))?.chosen).toBeNull();
    expect(photoFrom(result({ links: { download_location: 'https://example.org/photos/abc/download' } }))?.chosen).toBeNull();
  });

  it('tidies the name, and keeps it short', () => {
    expect(photoFrom(result({ user: { name: '  Ann \n Example ', links: { html: 'https://unsplash.com/@ann' } } }))?.name).toBe('Ann Example');
    expect(photoFrom(result({ user: { name: 'A'.repeat(300), links: { html: 'https://unsplash.com/@ann' } } }))?.name).toHaveLength(80);
  });

  it('leaves out a result with anything missing, or with a photo that is not on Unsplash', () => {
    for (const bad of [
      null,
      'photo',
      {},
      result({ id: 42 }),
      result({ id: 'a/b' }),
      result({ urls: null }),
      result({ urls: { regular: 'https://images.unsplash.com/a' } }),
      result({ urls: { small: 'https://images.example.org/a', regular: 'https://images.unsplash.com/a' } }),
      result({ urls: { small: 'https://images.unsplash.com/a', regular: 'http://images.unsplash.com/a' } }),
      result({ user: null }),
      result({ user: { name: '  ', links: { html: 'https://unsplash.com/@ann' } } }),
      result({ user: { name: 'Ann', links: { html: 'https://example.org/@ann' } } }),
    ]) {
      expect(photoFrom(bad)).toBeNull();
    }
  });
});

describe('search', () => {
  it('asks Unsplash for wide photos, with its stricter filter, and the key in the heading', async () => {
    const fetcher = answers({ total: 1, total_pages: 1, results: [result()] });
    const found = await search('  sunny beach ', 'the-key', fetcher);
    expect(found.photos.map((photo) => photo.id)).toEqual(['LBI7cgq3pbM']);
    expect(found.why).toBeUndefined();
    const [asked, init] = jest.mocked(fetcher).mock.calls[0];
    const url = new URL(asked);
    expect(`${url.origin}${url.pathname}`).toBe('https://api.unsplash.com/search/photos');
    expect(Object.fromEntries(url.searchParams)).toEqual({ query: 'sunny beach', per_page: '12', orientation: 'landscape', content_filter: 'high' });
    expect(init?.headers).toMatchObject({ Authorization: 'Client-ID the-key', 'Accept-Version': 'v1' });
    // The key goes in the heading, never in the address.
    expect(asked).not.toContain('the-key');
  });

  it('leaves out results it cannot use, and gives no more than twelve', async () => {
    const many = Array.from({ length: 20 }, (_, i) => result({ id: `photo${i}` }));
    expect((await search('beach', 'k', answers({ results: [result({ urls: null }), ...many] }))).photos).toHaveLength(12);
    expect((await search('beach', 'k', answers({ results: 'none' }))).photos).toEqual([]);
  });

  it('says search is off when there is no key, without calling Unsplash', async () => {
    const fetcher = answers({ results: [result()] });
    for (const key of [null, undefined, '']) expect(await search('beach', key, fetcher)).toEqual({ photos: [], why: 'off' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('says search is off when Unsplash does not know the key', async () => {
    expect(await search('beach', 'wrong', answers({ errors: ['OAuth error: The access token is invalid'] }, 401))).toEqual({ photos: [], why: 'off' });
  });

  it('says search is busy when the hour is used up', async () => {
    expect(await search('beach', 'k', answers('Rate Limit Exceeded', 403))).toEqual({ photos: [], why: 'busy' });
    expect(await search('beach', 'k', answers('', 403, { 'X-Ratelimit-Remaining': '0' }))).toEqual({ photos: [], why: 'busy' });
    expect(await search('beach', 'k', answers('', 429))).toEqual({ photos: [], why: 'busy' });
  });

  it('says it failed for anything else Unsplash refuses', async () => {
    expect(await search('beach', 'k', answers('', 500))).toEqual({ photos: [], why: 'failed' });
    expect(await search('beach', 'k', answers({ errors: ['forbidden'] }, 403, { 'X-Ratelimit-Remaining': '31' }))).toEqual({ photos: [], why: 'failed' });
  });

  it('finds nothing, and calls nobody, when nothing was typed', async () => {
    const fetcher = answers({ results: [result()] });
    expect(await search(' ', 'k', fetcher)).toEqual({ photos: [] });
    expect(await search(undefined, 'k', fetcher)).toEqual({ photos: [] });
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('tellChosen', () => {
  it('calls the address that came with the photo, with the key', async () => {
    const fetcher = answers({ url: 'https://images.unsplash.com/photo-1' });
    expect(await tellChosen(LOCATION, 'the-key', fetcher)).toBe(true);
    const [asked, init] = jest.mocked(fetcher).mock.calls[0];
    expect(asked).toBe(LOCATION);
    expect(init?.headers).toMatchObject({ Authorization: 'Client-ID the-key' });
  });

  it('calls nobody for any other address, or without a key', async () => {
    const fetcher = answers({});
    expect(await tellChosen('https://example.org/photos/abc/download', 'k', fetcher)).toBe(false);
    expect(await tellChosen(LOCATION, null, fetcher)).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('says so when Unsplash refuses', async () => {
    expect(await tellChosen(LOCATION, 'k', answers('', 404))).toBe(false);
  });
});

describe('the helper itself', () => {
  const call = (body: unknown, method = 'POST') =>
    helper.default.fetch(new Request('https://project.example.org/functions/v1/photo-search', { method, body: method === 'POST' ? JSON.stringify(body) : undefined }));

  it('says search is off, not an error, until its key has been set', async () => {
    const response = await call({ query: 'beach' });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ photos: [], why: 'off' });
    expect(await (await call('nonsense')).json()).toEqual({ photos: [], why: 'off' });
  });

  it('does not tell Unsplash anything without a key', async () => {
    expect(await (await call({ chosen: LOCATION })).json()).toEqual({ told: false });
  });

  it('only takes POST', async () => {
    expect((await call(null, 'GET')).status).toBe(405);
  });

  it('reads its key from the secret it is named for', () => {
    expect(helper.SECRET).toBe('UNSPLASH_ACCESS_KEY');
  });
});

describe('withinShare', () => {
  const asker = (answer: { data?: unknown; error?: unknown }) => ({ rpc: jest.fn(async () => ({ data: null, error: null, ...answer })) });

  it('asks the database, as the person, about that kind of request', async () => {
    const client = asker({ data: true });
    expect(await withinShare(client, 'search')).toBe(true);
    expect(client.rpc).toHaveBeenCalledWith('take_photo_search', { p_kind: 'search' });
    await withinShare(client, 'chosen');
    expect(client.rpc).toHaveBeenLastCalledWith('take_photo_search', { p_kind: 'chosen' });
  });

  it('is no when the database says the share is used up', async () => {
    expect(await withinShare(asker({ data: false }), 'search')).toBe(false);
  });

  it('is yes when the count cannot be kept: the update is not run, the database is down, or there is nobody to ask', async () => {
    expect(await withinShare(asker({ error: { code: 'PGRST202', message: 'Could not find the function' } }), 'search')).toBe(true);
    expect(await withinShare(asker({ error: { message: 'timeout' } }), 'search')).toBe(true);
    expect(await withinShare({ rpc: () => Promise.reject(new Error('offline')) }, 'search')).toBe(true);
    expect(await withinShare(null, 'search')).toBe(true);
    expect(await withinShare(undefined, 'chosen')).toBe(true);
  });
});

describe("the helper and each person's share", () => {
  const world = globalThis as { Deno?: unknown; fetch: unknown };
  const realFetch = world.fetch;
  let calls: jest.Mock;

  beforeEach(() => {
    // The key is set, and Unsplash answers every call with one photo.
    world.Deno = { env: { get: (name: string) => (name === helper.SECRET ? 'k' : undefined) } };
    calls = jest.fn(async () => new Response(JSON.stringify({ results: [result()] }), { status: 200 }));
    world.fetch = calls;
  });
  afterEach(() => {
    delete world.Deno;
    world.fetch = realFetch;
  });

  const call = (body: unknown, share: boolean | 'missing') => {
    const supabase = { rpc: jest.fn(async () => (share === 'missing' ? { data: null, error: { code: 'PGRST202' } } : { data: share, error: null })) };
    const response = helper.default.fetch(new Request('https://project.example.org/functions/v1/photo-search', { method: 'POST', body: JSON.stringify(body) }), { supabase });
    return { response, supabase };
  };

  it('searches when the person is within their share', async () => {
    const { response, supabase } = call({ query: 'beach' }, true);
    const answer = (await (await response).json()) as { photos: Photo[]; why?: string };
    expect(answer.photos).toHaveLength(1);
    expect(answer.why).toBeUndefined();
    expect(supabase.rpc).toHaveBeenCalledWith('take_photo_search', { p_kind: 'search' });
    expect(calls).toHaveBeenCalledTimes(1);
  });

  it('does not call Unsplash once the share is used up, and says it is this person who is over', async () => {
    const { response } = call({ query: 'beach' }, false);
    expect(await (await response).json()).toEqual({ photos: [], why: 'busy', mine: true });
    expect(calls).not.toHaveBeenCalled();
  });

  it('searches without a share until update 021 has been run', async () => {
    const { response } = call({ query: 'beach' }, 'missing');
    expect(((await (await response).json()) as { photos: Photo[] }).photos).toHaveLength(1);
  });

  it('counts nothing for a search that would not be made anyway', async () => {
    const short = call({ query: ' a ' }, true);
    expect(await (await short.response).json()).toEqual({ photos: [] });
    expect(short.supabase.rpc).not.toHaveBeenCalled();
    world.Deno = undefined;
    const off = call({ query: 'beach' }, true);
    expect(await (await off.response).json()).toEqual({ photos: [], why: 'off' });
    expect(off.supabase.rpc).not.toHaveBeenCalled();
    expect(calls).not.toHaveBeenCalled();
  });

  it('tells Unsplash of a chosen photo within the share, and not past it', async () => {
    const within = call({ chosen: LOCATION }, true);
    expect(await (await within.response).json()).toEqual({ told: true });
    expect(within.supabase.rpc).toHaveBeenCalledWith('take_photo_search', { p_kind: 'chosen' });
    expect(calls).toHaveBeenCalledTimes(1);
    const past = call({ chosen: LOCATION }, false);
    expect(await (await past.response).json()).toEqual({ told: false });
    expect(calls).toHaveBeenCalledTimes(1);
  });

  it('counts nothing for an address it would never call', async () => {
    const { response, supabase } = call({ chosen: 'https://example.com/photos/x/download' }, true);
    expect(await (await response).json()).toEqual({ told: false });
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(calls).not.toHaveBeenCalled();
  });
});
