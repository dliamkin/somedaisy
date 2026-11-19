import { attachPreview, fetchPreview, fetchPreviewPicture, nameFromTitle, usablePicture, usableTitle, previewState } from '../preview';
import { db } from '../supabase';

jest.mock('../supabase', () => ({ db: jest.fn() }));

const PIC = 'https://cdn.example.org/a.jpg';

/** A stand-in for Supabase: `invoke` answers as the helper would, and updates to ideas are recorded. */
function fakeClient(invoke: () => Promise<{ data: unknown; error: unknown }>, updateError: { message: string } | null = null) {
  const updates: { change: unknown; filters: [string, unknown][] }[] = [];
  const client = {
    functions: { invoke: jest.fn(invoke) },
    from: jest.fn((_table: string) => ({
      update: (change: unknown) => {
        const record = { change, filters: [] as [string, unknown][] };
        const builder = {
          eq: (column: string, value: unknown) => {
            record.filters.push([column, value]);
            return builder;
          },
          then: (resolve: (r: { error: unknown }) => unknown) => {
            if (!updateError) updates.push(record);
            return Promise.resolve({ error: updateError }).then(resolve);
          },
        };
        return builder;
      },
    })),
  };
  jest.mocked(db).mockReturnValue(client as never);
  return { client, updates };
}

describe('usablePicture', () => {
  it('accepts a secure web address', () => {
    expect(usablePicture(PIC)).toBe(PIC);
  });

  it('refuses anything else', () => {
    for (const bad of [null, undefined, 42, '', 'http://cdn.example.org/a.jpg', 'javascript:alert(1)', 'data:image/png;base64,AAAA', 'https://cdn.example.org/a b.jpg', `https://cdn.example.org/${'a'.repeat(2000)}`]) {
      expect(usablePicture(bad)).toBeNull();
    }
  });
});

describe('fetchPreviewPicture', () => {
  it('asks the helper about the link and returns its picture', async () => {
    const { client } = fakeClient(async () => ({ data: { image: PIC }, error: null }));
    expect(await fetchPreviewPicture('https://example.org/page')).toBe(PIC);
    expect(client.functions.invoke).toHaveBeenCalledWith('link-preview', { body: { url: 'https://example.org/page' } });
  });

  it('is nothing when the page has no picture', async () => {
    fakeClient(async () => ({ data: { image: null }, error: null }));
    expect(await fetchPreviewPicture('https://example.org/page')).toBeNull();
  });

  it('is nothing, not a failure, when the helper is not set up or cannot be reached', async () => {
    fakeClient(async () => ({ data: null, error: { message: 'Function not found' } }));
    expect(await fetchPreviewPicture('https://example.org/page')).toBeNull();
    fakeClient(async () => {
      throw new Error('Failed to fetch');
    });
    expect(await fetchPreviewPicture('https://example.org/page')).toBeNull();
  });

  it('does not trust the helper with anything but a secure picture address', async () => {
    fakeClient(async () => ({ data: { image: 'javascript:alert(1)' }, error: null }));
    expect(await fetchPreviewPicture('https://example.org/page')).toBeNull();
    fakeClient(async () => ({ data: 'not an object', error: null }));
    expect(await fetchPreviewPicture('https://example.org/page')).toBeNull();
  });
});

describe('attachPreview', () => {
  it('saves the picture on the idea, as long as it still has that link', async () => {
    const { updates } = fakeClient(async () => ({ data: { image: PIC }, error: null }));
    expect(await attachPreview('i1', 'https://example.org/page')).toBe(true);
    expect(updates).toEqual([{ change: { image_url: PIC }, filters: [['id', 'i1'], ['link', 'https://example.org/page']] }]);
  });

  it('saves nothing when there is no picture', async () => {
    const { updates, client } = fakeClient(async () => ({ data: { image: null }, error: null }));
    expect(await attachPreview('i1', 'https://example.org/page')).toBe(false);
    expect(updates).toEqual([]);
    expect(client.from).not.toHaveBeenCalled();
  });

  it('stays quiet when the database has no place for pictures yet', async () => {
    fakeClient(async () => ({ data: { image: PIC }, error: null }), { message: 'column "image_url" does not exist' });
    expect(await attachPreview('i1', 'https://example.org/page')).toBe(false);
  });
});

describe('previewState', () => {
  const link = 'https://example.com/film';
  const picture = 'https://example.com/film.jpg';

  it('has nothing to show without a link', () => {
    expect(previewState(null, null)).toEqual({ state: 'none' });
    expect(previewState(null, { link, picture })).toEqual({ state: 'none' });
  });

  it('is looking until an answer comes back for this link', () => {
    expect(previewState(link, null)).toEqual({ state: 'looking' });
    expect(previewState(link, { link: 'https://example.com/fil', picture })).toEqual({ state: 'looking' });
  });

  it('shows the picture found for this link', () => {
    expect(previewState(link, { link, picture })).toEqual({ state: 'found', link, picture, title: null });
    expect(previewState(link, { link, picture, title: '  Dune:  Part Two ' })).toEqual({ state: 'found', link, picture, title: 'Dune: Part Two' });
  });

  it('says there is none when the page has no usable picture', () => {
    expect(previewState(link, { link, picture: null })).toEqual({ state: 'missing', link, title: null });
    expect(previewState(link, { link, picture: 'http://example.com/not-secure.jpg' })).toEqual({ state: 'missing', link, title: null });
    expect(previewState(link, { link, picture: null, title: 'Dune' })).toEqual({ state: 'missing', link, title: 'Dune' });
  });
});

describe('fetchPreview', () => {
  it('returns the picture and the page title', async () => {
    fakeClient(async () => ({ data: { image: PIC, title: ' Sunrise Mini Golf: 18 holes by the water ' }, error: null }));
    expect(await fetchPreview('https://example.org/page')).toEqual({ picture: PIC, title: 'Sunrise Mini Golf: 18 holes by the water' });
  });

  it('has no title from a helper that does not read titles yet', async () => {
    fakeClient(async () => ({ data: { image: PIC }, error: null }));
    expect(await fetchPreview('https://example.org/page')).toEqual({ picture: PIC, title: null });
  });

  it('is nothing, not a failure, when the helper cannot be reached', async () => {
    fakeClient(async () => {
      throw new Error('offline');
    });
    expect(await fetchPreview('https://example.org/page')).toEqual({ picture: null, title: null });
  });
});

describe('usableTitle', () => {
  it('makes one tidy line of it', () => {
    expect(usableTitle('  Dune:\n  Part Two ')).toBe('Dune: Part Two');
    expect(usableTitle('a'.repeat(300))).toHaveLength(200);
  });

  it('refuses anything that is not words', () => {
    for (const bad of [null, undefined, 42, '', '   ']) expect(usableTitle(bad)).toBeNull();
  });
});

describe('nameFromTitle', () => {
  it('keeps the part before the site name or strapline', () => {
    expect(nameFromTitle('Sunrise Mini Golf | Book a tee time')).toBe('Sunrise Mini Golf');
    expect(nameFromTitle('Dune | Official Trailer - YouTube')).toBe('Dune');
    expect(nameFromTitle('Taco Spot - Menu')).toBe('Taco Spot');
  });

  it('leaves a plain title alone, hyphens, colons and all', () => {
    expect(nameFromTitle('Spider-Man: Homecoming')).toBe('Spider-Man: Homecoming');
    expect(nameFromTitle('Dune: Part Two - YouTube')).toBe('Dune: Part Two');
    expect(nameFromTitle('Drive-in movie night')).toBe('Drive-in movie night');
  });

  it('keeps the whole title when the first part is too short to be a name', () => {
    expect(nameFromTitle('Up | Pixar')).toBe('Up | Pixar');
  });

  it('never runs past the longest name an idea can have', () => {
    expect(nameFromTitle('a'.repeat(300))).toHaveLength(120);
  });
});
