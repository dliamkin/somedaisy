import { deleteGroup, deleteOverview, NO_DELETE_GROUP, removeGroupPictures } from '../group-files';
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

describe('deleteGroup', () => {
  /** A stand-in for the database and the place files are kept, which writes down what was asked of it, in order. */
  function backend(answers: ({ code?: string; message: string } | null)[] = []) {
    const asked: string[] = [];
    let call = 0;
    const bucket = (name: string) => ({
      list: jest.fn(async () => ({ data: asked.includes(`remove ${name}`) || name !== 'idea-pictures' ? [] : [{ name: file(1) }], error: null })),
      remove: jest.fn(async (places: string[]) => {
        asked.push(`remove ${name}`);
        return { data: places.map((n) => ({ name: n })), error: null };
      }),
    });
    const rpc = jest.fn(async (name: string, args: { p_check_only: boolean }) => {
      asked.push(`${name} ${args.p_check_only ? 'check' : 'for real'}`);
      return { error: answers[call++] ?? null };
    });
    jest.mocked(db).mockReturnValue({ rpc, storage: { from: (name: string) => bucket(name) } } as never);
    return { asked, rpc };
  }

  it('asks whether it may, then removes the files, and only then deletes the group', async () => {
    const { asked, rpc } = backend();
    await deleteGroup(GROUP);
    expect(asked[0]).toBe('delete_group check');
    expect(asked[asked.length - 1]).toBe('delete_group for real');
    expect(asked.slice(1, -1).sort()).toEqual(['remove group-covers', 'remove idea-pictures']);
    expect(rpc).toHaveBeenCalledWith('delete_group', { p_group: GROUP, p_check_only: true });
  });

  it('removes no file when the database says no', async () => {
    const { asked } = backend([{ message: "Only the group's owner can delete it" }]);
    await expect(deleteGroup(GROUP)).rejects.toThrow("Only the group's owner can delete it");
    expect(asked).toEqual(['delete_group check']);
  });

  it('says which update is missing when the database cannot delete groups yet, and removes no file', async () => {
    const { asked } = backend([{ code: 'PGRST202', message: 'Could not find the function' }]);
    await expect(deleteGroup(GROUP)).rejects.toThrow(NO_DELETE_GROUP);
    expect(asked).toEqual(['delete_group check']);
  });

  it('refuses anything that is not a group, without asking the database', async () => {
    const { asked } = backend();
    await expect(deleteGroup('../somewhere')).rejects.toThrow('not a group');
    expect(asked).toEqual([]);
  });
});

describe('what deleting a group takes away', () => {
  const ann = { user_id: 'ann', name: 'Ann' };
  const bo = { user_id: 'bo', name: 'Bo' };
  const cy = { user_id: 'cy', name: 'Cy' };

  it('counts what the group holds and names who else loses it', () => {
    expect(deleteOverview({ members: [ann, bo, cy] }, { ideas: 14, done: 9, pictures: 3 }, true, 'ann')).toEqual([
      '14 ideas, with their votes, comments and plans',
      '3 pictures your group added, and its cover photo',
      'The record of the 9 things you did together, with your points and stamps',
      'Bo and Cy lose the group too',
    ]);
  });

  it('says one of a thing as one', () => {
    expect(deleteOverview({ members: [ann, bo] }, { ideas: 1, done: 1, pictures: 1 }, false, 'ann')).toEqual([
      '1 idea, with its votes, comments and plans',
      '1 picture your group added',
      'The record of the 1 thing you did together, with your points and stamps',
      'Bo loses the group too',
    ]);
  });

  it('leaves out what the group does not have', () => {
    expect(deleteOverview({ members: [ann] }, { ideas: 0, done: 0, pictures: 0 }, false, 'ann')).toEqual(['Its lists']);
    expect(deleteOverview({ members: [ann] }, { ideas: 2, done: 0, pictures: 0 }, true, 'ann')).toEqual(['2 ideas, with their votes, comments and plans', 'Its cover photo']);
  });

  it('still says what goes before anything has been counted', () => {
    expect(deleteOverview({ members: [ann, bo] }, null, true, 'ann')).toEqual([
      'Every idea, with its votes, comments and plans',
      'Every picture your group added, and its cover photo',
      'The record of what you did together, with your points and stamps',
      'Bo loses the group too',
    ]);
  });

  it('counts a crowd instead of naming everyone', () => {
    const many = [ann, bo, cy, { user_id: 'di', name: 'Di' }, { user_id: 'ed', name: 'Ed' }];
    expect(deleteOverview({ members: many }, { ideas: 2, done: 0, pictures: 0 }, false, 'ann').pop()).toBe('4 other people lose the group too');
  });
});
