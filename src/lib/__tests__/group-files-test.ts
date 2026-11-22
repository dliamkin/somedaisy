import { removeGroupPictures } from '../group-files';
import { db } from '../supabase';

jest.mock('../supabase', () => ({ db: jest.fn() }));

const GROUP = '11111111-2222-4333-8444-555555555555';
const file = (n: number) => `${String(n).padStart(8, '0')}-aaaa-4bbb-8ccc-dddddddddddd.jpg`;

type Listed = { data: { name: string }[] | null; error: { message: string } | null };

/**
 * A stand-in for the place pictures are kept: a folder of file names. Listing gives the first
 * hundred, and removing takes them out, unless `refuse` says the removal is not allowed.
 */
function folder(names: string[], { refuse = false, listFails = false }: { refuse?: boolean; listFails?: boolean } = {}) {
  let held = [...names];
  const bucket = {
    list: jest.fn(async (_path: string, options: { limit: number }): Promise<Listed> =>
      listFails ? { data: null, error: { message: 'no access' } } : { data: held.slice(0, options.limit).map((name) => ({ name })), error: null },
    ),
    remove: jest.fn(async (places: string[]) => {
      if (refuse) return { data: [], error: null };
      const gone = new Set(places.map((place) => place.slice(GROUP.length + 1)));
      held = held.filter((name) => !gone.has(name));
      return { data: places.map((name) => ({ name })), error: null };
    }),
  };
  const from = jest.fn((_bucket: string) => bucket);
  jest.mocked(db).mockReturnValue({ storage: { from } } as never);
  return { bucket, from, left: () => held };
}

describe('removeGroupPictures', () => {
  it("removes every picture in the group's folder", async () => {
    const place = folder([file(1), file(2), file(3)]);
    await removeGroupPictures(GROUP);
    expect(place.from).toHaveBeenCalledWith('idea-pictures');
    expect(place.bucket.list).toHaveBeenCalledWith(GROUP, { limit: 100 });
    expect(place.bucket.remove).toHaveBeenCalledWith([`${GROUP}/${file(1)}`, `${GROUP}/${file(2)}`, `${GROUP}/${file(3)}`]);
    expect(place.left()).toEqual([]);
  });

  it('carries on, a batch at a time, until the folder is empty', async () => {
    const place = folder(Array.from({ length: 250 }, (_, n) => file(n)));
    await removeGroupPictures(GROUP);
    expect(place.left()).toEqual([]);
    expect(place.bucket.remove).toHaveBeenCalledTimes(3);
    // The last look finds nothing, and that is the end.
    expect(place.bucket.list).toHaveBeenCalledTimes(4);
  });

  it('removes nothing from an empty folder', async () => {
    const place = folder([]);
    await removeGroupPictures(GROUP);
    expect(place.bucket.remove).not.toHaveBeenCalled();
  });

  it('leaves alone anything not named the way the app names pictures', async () => {
    const place = folder(['notes.txt', '.emptyFolderPlaceholder', 'sub', file(1)]);
    await removeGroupPictures(GROUP);
    expect(place.bucket.remove).toHaveBeenCalledTimes(1);
    expect(place.bucket.remove).toHaveBeenCalledWith([`${GROUP}/${file(1)}`]);
    expect(place.left()).toEqual(['notes.txt', '.emptyFolderPlaceholder', 'sub']);
  });

  it('never asks about a folder that is not a group', async () => {
    const place = folder([file(1)]);
    await removeGroupPictures('../somewhere-else');
    await removeGroupPictures('');
    expect(place.bucket.list).not.toHaveBeenCalled();
    expect(place.bucket.remove).not.toHaveBeenCalled();
  });

  it('stops, without going round for ever, when the files cannot be removed', async () => {
    const place = folder([file(1), file(2)], { refuse: true });
    await removeGroupPictures(GROUP);
    expect(place.bucket.remove).toHaveBeenCalledTimes(1);
    expect(place.left()).toHaveLength(2);
  });

  it('never fails out loud', async () => {
    folder([], { listFails: true });
    await expect(removeGroupPictures(GROUP)).resolves.toBeUndefined();
    jest.mocked(db).mockImplementation(() => {
      throw new Error('not set up');
    });
    await expect(removeGroupPictures(GROUP)).resolves.toBeUndefined();
    jest.mocked(db).mockReturnValue({ storage: { from: () => ({ list: () => Promise.reject(new Error('offline')) }) } } as never);
    await expect(removeGroupPictures(GROUP)).resolves.toBeUndefined();
  });
});
