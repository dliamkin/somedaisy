import { coverOf, coverChange, type Cover } from '../covers';
import { cleanSearch, creditFor, creditName, forgetSearches, foundFrom, reportChosen, searchedCover, searchedPhoto, searchPhotos, SEARCH_MAX, SEARCH_SAYS, UNSPLASH, type FoundPhoto } from '../photo-search';
import { db } from '../supabase';

jest.mock('../supabase', () => ({ db: jest.fn() }));

/** A stand-in for Supabase: `invoke` answers as the helper would. */
function fakeClient(invoke: (name: string, options: { body: unknown }) => Promise<{ data: unknown; error: unknown }>) {
  const client = { functions: { invoke: jest.fn(invoke) } };
  jest.mocked(db).mockReturnValue(client as never);
  return client;
}

const LOCATION = 'https://api.unsplash.com/photos/abc/download?ixid=1';

/** One photo, the way the helper sends it. */
const sent = (change: Record<string, unknown> = {}) => ({
  id: 'abc',
  thumb: 'https://images.unsplash.com/photo-1?ixid=1&w=400',
  url: 'https://images.unsplash.com/photo-1?ixid=1&w=1080',
  alt: 'a beach at sunset',
  name: 'Ann Example',
  profile: 'https://unsplash.com/@ann?utm_source=somedaisy&utm_medium=referral',
  chosen: LOCATION,
  ...change,
});

const found: FoundPhoto = {
  id: 'abc',
  thumb: 'https://images.unsplash.com/photo-1?ixid=1&w=400',
  url: 'https://images.unsplash.com/photo-1?ixid=1&w=1080',
  alt: 'a beach at sunset',
  name: 'Ann Example',
  credit: 'Photo by Ann Example on Unsplash',
  creditUrl: 'https://unsplash.com/@ann?utm_source=somedaisy&utm_medium=referral',
  report: LOCATION,
};

beforeEach(() => forgetSearches());

describe('cleanSearch', () => {
  it('tidies what was typed, and wants at least two letters', () => {
    expect(cleanSearch('  sunny   beach ')).toBe('sunny beach');
    expect(cleanSearch('a')).toBeNull();
    expect(cleanSearch('   ')).toBeNull();
    expect(cleanSearch('x'.repeat(200))).toHaveLength(SEARCH_MAX);
  });
});

describe('the credit', () => {
  it('is worded the way Unsplash asks', () => {
    expect(creditFor('Ann Example')).toBe('Photo by Ann Example on Unsplash');
  });

  it('gives the name back, so it can be a link of its own', () => {
    expect(creditName(creditFor('Ann Example'))).toBe('Ann Example');
    // A name with the same words in it is still read whole.
    expect(creditName(creditFor('Photo by Jo on Unsplash'))).toBe('Photo by Jo on Unsplash');
  });

  it('gives no name for a credit worded any other way', () => {
    for (const other of ['Ann Example', 'Photo by Ann', 'Ann on Unsplash', 'Photo by  on Unsplash', '']) expect(creditName(other)).toBeNull();
  });

  it('links to Unsplash with the words Unsplash asks for', () => {
    expect(UNSPLASH).toBe('https://unsplash.com/?utm_source=somedaisy&utm_medium=referral');
  });
});

describe('foundFrom', () => {
  it('reads the photos in the helper’s answer', () => {
    expect(foundFrom({ photos: [sent()] })).toEqual([found]);
  });

  it('does without a description, or an address to tell Unsplash on', () => {
    expect(foundFrom({ photos: [sent({ alt: null, chosen: null })] })).toEqual([{ ...found, alt: null, report: null }]);
  });

  it('never shows a photo, or a credit, that is not on Unsplash', () => {
    for (const bad of [
      sent({ url: 'https://images.example.org/a' }),
      sent({ thumb: 'https://images.example.org/a' }),
      sent({ url: 'http://images.unsplash.com/a' }),
      sent({ profile: 'https://example.org/@ann' }),
      sent({ name: '  ' }),
      sent({ id: 7 }),
      null,
      'photo',
    ]) {
      expect(foundFrom({ photos: [bad] })).toEqual([]);
    }
  });

  it('leaves out the same photo given twice', () => {
    expect(foundFrom({ photos: [sent(), sent(), sent({ id: 'other' })] })).toHaveLength(1);
  });

  it('is empty for an answer that is not one', () => {
    for (const bad of [null, undefined, 'x', {}, { photos: 'none' }]) expect(foundFrom(bad)).toEqual([]);
  });

  it('keeps the credit short enough to be saved', () => {
    const [photo] = foundFrom({ photos: [sent({ name: 'A'.repeat(300) })] });
    expect(photo.credit.length).toBeLessThanOrEqual(120);
  });
});

describe('searchPhotos', () => {
  it('asks the helper, with the words tidied', async () => {
    const client = fakeClient(async () => ({ data: { photos: [sent()] }, error: null }));
    expect(await searchPhotos('  sunny  beach ')).toEqual({ photos: [found], trouble: null });
    expect(client.functions.invoke).toHaveBeenCalledWith('photo-search', { body: { query: 'sunny beach' } });
  });

  it('asks only once for the same words, whatever their capitals', async () => {
    const client = fakeClient(async () => ({ data: { photos: [sent()] }, error: null }));
    await searchPhotos('beach');
    expect((await searchPhotos(' Beach ')).photos).toEqual([found]);
    expect(client.functions.invoke).toHaveBeenCalledTimes(1);
  });

  it('asks nobody when nothing was typed', async () => {
    const client = fakeClient(async () => ({ data: { photos: [sent()] }, error: null }));
    expect(await searchPhotos(' a ')).toEqual({ photos: [], trouble: null });
    expect(client.functions.invoke).not.toHaveBeenCalled();
  });

  it('passes on why the helper could not search, and asks again next time', async () => {
    for (const why of ['off', 'busy', 'failed'] as const) {
      const client = fakeClient(async () => ({ data: { photos: [], why }, error: null }));
      expect(await searchPhotos('beach')).toEqual({ photos: [], trouble: why });
      await searchPhotos('beach');
      expect(client.functions.invoke).toHaveBeenCalledTimes(2);
    }
  });

  it('says search is not set up when the helper is not there', async () => {
    fakeClient(async () => ({ data: null, error: { message: 'not found', context: { status: 404 } } }));
    expect(await searchPhotos('beach')).toEqual({ photos: [], trouble: 'off' });
  });

  it('says it failed, and never throws, for anything else', async () => {
    fakeClient(async () => ({ data: null, error: { message: 'boom', context: { status: 500 } } }));
    expect(await searchPhotos('beach')).toEqual({ photos: [], trouble: 'failed' });
    fakeClient(async () => {
      throw new Error('offline');
    });
    expect(await searchPhotos('beach')).toEqual({ photos: [], trouble: 'failed' });
    jest.mocked(db).mockImplementation(() => {
      throw new Error('not set up');
    });
    expect(await searchPhotos('beach')).toEqual({ photos: [], trouble: 'failed' });
  });

  it('has something to say for each kind of trouble, with no dash in it', () => {
    for (const said of Object.values(SEARCH_SAYS)) {
      expect(said.length).toBeGreaterThan(10);
      expect(said).not.toMatch(/[–—]/);
    }
  });
});

describe('reportChosen', () => {
  it('sends the helper the address that came with the photo', async () => {
    const client = fakeClient(async () => ({ data: { told: true }, error: null }));
    reportChosen(found);
    await new Promise((done) => setTimeout(done, 0));
    expect(client.functions.invoke).toHaveBeenCalledWith('photo-search', { body: { chosen: LOCATION } });
  });

  it('sends nothing for a photo that came with none, and never fails out loud', async () => {
    const client = fakeClient(async () => {
      throw new Error('offline');
    });
    reportChosen({ ...found, report: null });
    expect(client.functions.invoke).not.toHaveBeenCalled();
    expect(() => reportChosen(found)).not.toThrow();
    await new Promise((done) => setTimeout(done, 0));
  });
});

describe('a cover with a found photo', () => {
  const base: Cover = { kind: 'look', background: '#4B2A8C', shape1: '#6D2FC4', shape2: '#B8339A', pattern: false };

  it('keeps the colour it had, and only the address and the credit of the photo', () => {
    const cover = searchedCover(base, found);
    expect(cover).toEqual({ kind: 'photo', background: '#4B2A8C', pattern: false, photo: { source: 'search', url: found.url, credit: found.credit, creditUrl: found.creditUrl } });
    expect(searchedPhoto(cover)).toEqual({ source: 'search', url: found.url, credit: found.credit, creditUrl: found.creditUrl });
  });

  it('is saved and read back the same', () => {
    const cover = searchedCover(base, found);
    expect(coverOf({ id: '0f0e0d0c-0b0a-4908-8706-050403020100', cover: 'sky', cover_style: coverChange(cover).cover_style })).toEqual(cover);
  });

  it('is not what colours or an uploaded photo have', () => {
    expect(searchedPhoto(base)).toBeNull();
    expect(searchedPhoto({ kind: 'photo', background: '#CDEFE0', pattern: true, photo: { source: 'upload', path: 'g/cover.jpg', version: 1 } })).toBeNull();
  });
});
