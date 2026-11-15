import {
  addIdea,
  deleteIdea,
  everyoneIn,
  fetchDone,
  fetchGroup,
  fetchGroups,
  leaveGroup,
  markChanged,
  markDone,
  newlyAllIn,
  ownerOf,
  planIdea,
  previewGroup,
  removeList,
  removeMember,
  renameList,
  resetInviteCode,
  restoreIdea,
  setReaction,
  takeChanged,
  updateGroup,
  updateIdea,
  type Member,
  type Reaction,
} from '../data';
import { db } from '../supabase';

jest.mock('../supabase', () => ({ db: jest.fn() }));

type Result = { data?: unknown; error?: { message: string } | null };
type Call = { table: string; steps: [method: string, ...args: unknown[]][] };

/**
 * A stand-in for the Supabase client. Every query on a table resolves to the next result queued
 * for that table (or to empty data), and each query's chain of calls is recorded in `calls`.
 */
function fakeClient(results: Record<string, Result[]> = {}) {
  const calls: Call[] = [];
  const next = (key: string): Result => ({ data: null, error: null, ...(results[key]?.shift() ?? {}) });
  const query = (table: string) => {
    const call: Call = { table, steps: [] };
    calls.push(call);
    const builder: Record<string, unknown> = {};
    for (const method of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'is', 'not', 'match', 'order', 'limit', 'single', 'maybeSingle']) {
      builder[method] = (...args: unknown[]) => {
        call.steps.push([method, ...args]);
        return builder;
      };
    }
    builder.then = (resolve: (r: Result) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve(next(table)).then(resolve, reject);
    return builder;
  };
  const client = {
    from: jest.fn(query),
    rpc: jest.fn((name: string, _args?: unknown) => Promise.resolve(next(`rpc:${name}`))),
  };
  jest.mocked(db).mockReturnValue(client as never);
  return { client, calls };
}

/** The recorded queries on one table, each reduced to the methods it called, e.g. ['delete', 'match']. */
const stepsFor = (calls: Call[], table: string) => calls.filter((c) => c.table === table).map((c) => c.steps);
const argsOf = (steps: Call['steps'], method: string) => steps.find(([m]) => m === method)?.slice(1);

const member = (id: string): Member => ({ user_id: id, name: id, color: '#fff', photo: null });
const react = (idea: string, user: string, emoji: string): Reaction => ({ idea_id: idea, user_id: user, emoji });

describe('everyoneIn', () => {
  const members = [member('ann'), member('bo')];

  it('is true when every member gave the idea a thumbs up', () => {
    expect(everyoneIn('i1', members, [react('i1', 'ann', '👍'), react('i1', 'bo', '👍')])).toBe(true);
  });

  it('is false while one member has not given a thumbs up', () => {
    expect(everyoneIn('i1', members, [react('i1', 'ann', '👍')])).toBe(false);
  });

  it('does not count other emoji or thumbs on other ideas', () => {
    expect(everyoneIn('i1', members, [react('i1', 'ann', '👍'), react('i1', 'bo', '🎉')])).toBe(false);
    expect(everyoneIn('i1', members, [react('i1', 'ann', '👍'), react('i2', 'bo', '👍')])).toBe(false);
  });

  it('is never true for a group of one', () => {
    expect(everyoneIn('i1', [member('ann')], [react('i1', 'ann', '👍')])).toBe(false);
  });
});

describe('markChanged / takeChanged', () => {
  it('reports a marked group once, then clears it', () => {
    markChanged('g1');
    expect(takeChanged('g1')).toBe(true);
    expect(takeChanged('g1')).toBe(false);
  });

  it('keeps groups separate', () => {
    markChanged('g2');
    expect(takeChanged('g3')).toBe(false);
    expect(takeChanged('g2')).toBe(true);
  });
});

describe('setReaction', () => {
  it('removes the thumbs down before saving a thumbs up', async () => {
    const { calls } = fakeClient();
    await setReaction('g1', 'i1', 'ann', '👍', true);
    const [remove, save] = stepsFor(calls, 'reactions');
    expect(argsOf(remove, 'match')).toEqual([{ idea_id: 'i1', user_id: 'ann', emoji: '👎' }]);
    expect(argsOf(save, 'upsert')?.[0]).toEqual({ idea_id: 'i1', group_id: 'g1', user_id: 'ann', emoji: '👍' });
  });

  it('leaves an existing reaction alone instead of overwriting it, which the database would refuse', async () => {
    const { calls } = fakeClient();
    await setReaction('g1', 'i1', 'ann', '🎉', true);
    expect(argsOf(stepsFor(calls, 'reactions')[0], 'upsert')?.[1]).toEqual({ onConflict: 'idea_id,user_id,emoji', ignoreDuplicates: true });
  });

  it('removes the thumbs up before saving a thumbs down', async () => {
    const { calls } = fakeClient();
    await setReaction('g1', 'i1', 'ann', '👎', true);
    const [remove] = stepsFor(calls, 'reactions');
    expect(argsOf(remove, 'match')).toEqual([{ idea_id: 'i1', user_id: 'ann', emoji: '👍' }]);
  });

  it('saves other emoji without removing anything', async () => {
    const { calls } = fakeClient();
    await setReaction('g1', 'i1', 'ann', '🎉', true);
    const queries = stepsFor(calls, 'reactions');
    expect(queries).toHaveLength(1);
    expect(argsOf(queries[0], 'upsert')?.[0]).toMatchObject({ emoji: '🎉' });
  });

  it('only deletes that one reaction when turning it off', async () => {
    const { calls } = fakeClient();
    await setReaction('g1', 'i1', 'ann', '👍', false);
    const queries = stepsFor(calls, 'reactions');
    expect(queries).toHaveLength(1);
    expect(queries[0].map(([m]) => m)).toEqual(['delete', 'match']);
    expect(argsOf(queries[0], 'match')).toEqual([{ idea_id: 'i1', user_id: 'ann', emoji: '👍' }]);
  });

  it('throws the database error and does not save when the removal fails', async () => {
    const { calls } = fakeClient({ reactions: [{ error: { message: 'no access' } }] });
    await expect(setReaction('g1', 'i1', 'ann', '👍', true)).rejects.toThrow('no access');
    expect(stepsFor(calls, 'reactions')).toHaveLength(1);
  });
});

describe('addIdea', () => {
  const input = { groupId: 'g1', listId: 'l1', title: 'Picnic', userId: 'ann' };

  it('stores an empty link and note as null', async () => {
    const { calls } = fakeClient({ ideas: [{ data: { id: 'i1' } }] });
    await addIdea({ ...input, link: '', thumbsUp: false });
    const [insert] = stepsFor(calls, 'ideas');
    expect(argsOf(insert, 'insert')).toEqual([
      { group_id: 'g1', list_id: 'l1', title: 'Picnic', link: null, note: null, added_by: 'ann' },
    ]);
    expect(stepsFor(calls, 'reactions')).toHaveLength(0);
  });

  it("adds the author's thumbs up to the new idea when asked", async () => {
    const { calls } = fakeClient({ ideas: [{ data: { id: 'i1' } }] });
    await addIdea({ ...input, link: 'https://example.com', note: 'Bring snacks', thumbsUp: true });
    expect(argsOf(stepsFor(calls, 'ideas')[0], 'insert')?.[0]).toMatchObject({
      link: 'https://example.com',
      note: 'Bring snacks',
    });
    expect(argsOf(stepsFor(calls, 'reactions')[0], 'insert')).toEqual([
      { idea_id: 'i1', group_id: 'g1', user_id: 'ann', emoji: '👍' },
    ]);
  });

  it('throws and adds no thumbs up when the idea cannot be saved', async () => {
    const { calls } = fakeClient({ ideas: [{ error: { message: 'title too long' } }] });
    await expect(addIdea({ ...input, thumbsUp: true })).rejects.toThrow('title too long');
    expect(stepsFor(calls, 'reactions')).toHaveLength(0);
  });
});

describe('planIdea', () => {
  it('saves the date on that one idea', async () => {
    const { calls } = fakeClient();
    const when = new Date(2026, 10, 21, 19, 0);
    await planIdea('i1', when);
    const [update] = stepsFor(calls, 'ideas');
    expect(argsOf(update, 'update')).toEqual([{ planned_for: when.toISOString() }]);
    expect(argsOf(update, 'eq')).toEqual(['id', 'i1']);
  });

  it('clears the date when given null', async () => {
    const { calls } = fakeClient();
    await planIdea('i1', null);
    expect(argsOf(stepsFor(calls, 'ideas')[0], 'update')).toEqual([{ planned_for: null }]);
  });

  it('throws the database error', async () => {
    fakeClient({ ideas: [{ error: { message: 'not a member' } }] });
    await expect(planIdea('i1', null)).rejects.toThrow('not a member');
  });
});

describe('ownerOf', () => {
  const members = [member('bo'), member('ann'), member('cy')];

  it('is the person who started the group, while they are in it', () => {
    expect(ownerOf('ann', members)).toBe('ann');
  });

  it('is whoever joined first once the starter has gone', () => {
    expect(ownerOf('zed', members)).toBe('bo');
    expect(ownerOf(null, members)).toBe('bo');
    expect(ownerOf(undefined, members)).toBe('bo');
  });

  it('is nobody in a group with no members', () => {
    expect(ownerOf('ann', [])).toBeNull();
  });
});

describe('group settings', () => {
  it('renames a group and changes its cover, and nothing else', async () => {
    const { calls } = fakeClient();
    await updateGroup('g1', { name: 'Best friends', cover: 'mint' });
    const [update] = stepsFor(calls, 'groups');
    expect(argsOf(update, 'update')).toEqual([{ name: 'Best friends', cover: 'mint' }]);
    expect(argsOf(update, 'eq')).toEqual(['id', 'g1']);
  });

  it('renames a list', async () => {
    const { calls } = fakeClient();
    await renameList('l1', 'Dinners');
    const [update] = stepsFor(calls, 'lists');
    expect(argsOf(update, 'update')).toEqual([{ name: 'Dinners' }]);
    expect(argsOf(update, 'eq')).toEqual(['id', 'l1']);
  });

  it('removes a list with nothing on it', async () => {
    const { calls } = fakeClient({ ideas: [{ data: [] }] });
    await removeList('l1');
    expect(argsOf(stepsFor(calls, 'ideas')[0], 'eq')).toEqual(['list_id', 'l1']);
    const [query] = stepsFor(calls, 'lists');
    expect(query.map(([method]) => method)).toEqual(['delete', 'eq']);
    expect(argsOf(query, 'eq')).toEqual(['id', 'l1']);
  });

  it('refuses to remove a list that has ideas, done ones included', async () => {
    const { calls } = fakeClient({ ideas: [{ data: [{ id: 'i1' }] }] });
    await expect(removeList('l1')).rejects.toThrow('still has ideas');
    // The check must not look only at ideas that are still to do.
    expect(stepsFor(calls, 'ideas')[0].some(([method]) => method === 'is')).toBe(false);
    expect(stepsFor(calls, 'lists')).toEqual([]);
  });

  it('leaves, removes a member and replaces the invite link through the database', async () => {
    const { client } = fakeClient({ 'rpc:reset_invite_code': [{ data: 'newcode123' }] });
    await leaveGroup('g1');
    await removeMember('g1', 'bo');
    expect(await resetInviteCode('g1')).toBe('newcode123');
    expect(client.rpc.mock.calls).toEqual([
      ['leave_group', { p_group: 'g1' }],
      ['remove_member', { p_group: 'g1', p_user: 'bo' }],
      ['reset_invite_code', { p_group: 'g1' }],
    ]);
  });

  it('passes on the database\'s refusal', async () => {
    fakeClient({ 'rpc:remove_member': [{ error: { message: "Only the group's owner can remove someone" } }] });
    await expect(removeMember('g1', 'bo')).rejects.toThrow("Only the group's owner");
  });

  it('says so plainly when the database has not been updated yet', async () => {
    fakeClient({ 'rpc:leave_group': [{ error: { message: 'Could not find the function public.leave_group', code: 'PGRST202' } as never }] });
    await expect(leaveGroup('g1')).rejects.toThrow('not available yet');
  });
});

describe('newlyAllIn', () => {
  const idea = (id: string) => ({ id, list_id: 'l1', title: id, link: null, note: null, added_by: 'a', planned_for: null, created_at: '2026-11-01T10:00:00.000Z' });
  const members = [member('a'), member('b')];
  const ideas = [idea('i1'), idea('i2')];
  const bothIn = (id: string) => [react(id, 'a', '👍'), react(id, 'b', '👍')];

  it('finds the idea everyone has just come in on', () => {
    expect(newlyAllIn({ ideas, members, reactions: bothIn('i2') }, new Set(['i1', 'i2']))?.id).toBe('i2');
  });

  it('ignores ideas everyone was already in on', () => {
    expect(newlyAllIn({ ideas, members, reactions: bothIn('i2') }, new Set(['i1']))).toBeNull();
    expect(newlyAllIn({ ideas, members, reactions: [...bothIn('i1'), ...bothIn('i2')] }, new Set(['i2']))?.id).toBe('i2');
  });

  it('finds nothing while someone has yet to say yes', () => {
    expect(newlyAllIn({ ideas, members, reactions: [react('i1', 'a', '👍'), react('i1', 'b', '👎')] }, new Set(['i1', 'i2']))).toBeNull();
  });

  it('ignores an idea that arrives already agreed on, such as one brought back to do again', () => {
    expect(newlyAllIn({ ideas, members, reactions: bothIn('i2') }, new Set(['i1']))).toBeNull();
    expect(newlyAllIn({ ideas, members, reactions: bothIn('i2') }, new Set())).toBeNull();
  });

  it('celebrates nothing on the first look', () => {
    expect(newlyAllIn({ ideas, members, reactions: bothIn('i1') }, null)).toBeNull();
  });
});

describe('updateIdea', () => {
  it('changes the words and list of that one idea, and nothing else about it', async () => {
    const { calls } = fakeClient();
    await updateIdea('i1', { title: 'Tacos', link: 'https://example.com', note: 'Yum', listId: 'l2' });
    const [update] = stepsFor(calls, 'ideas');
    expect(argsOf(update, 'update')).toEqual([{ title: 'Tacos', link: 'https://example.com', note: 'Yum', list_id: 'l2' }]);
    expect(argsOf(update, 'eq')).toEqual(['id', 'i1']);
  });

  it('saves an emptied link or note as none', async () => {
    const { calls } = fakeClient();
    await updateIdea('i1', { title: 'Tacos', link: '', note: null, listId: 'l2' });
    expect(argsOf(stepsFor(calls, 'ideas')[0], 'update')).toEqual([{ title: 'Tacos', link: null, note: null, list_id: 'l2' }]);
  });

  it('throws the database error', async () => {
    fakeClient({ ideas: [{ error: { message: 'not a member' } }] });
    await expect(updateIdea('i1', { title: 'T', link: null, note: null, listId: 'l1' })).rejects.toThrow('not a member');
  });
});

describe('deleteIdea', () => {
  it('removes that one idea', async () => {
    const { calls } = fakeClient();
    await deleteIdea('i1');
    const [query] = stepsFor(calls, 'ideas');
    expect(query.map(([method]) => method)).toEqual(['delete', 'eq']);
    expect(argsOf(query, 'eq')).toEqual(['id', 'i1']);
  });

  it('throws the database error', async () => {
    fakeClient({ ideas: [{ error: { message: 'not a member' } }] });
    await expect(deleteIdea('i1')).rejects.toThrow('not a member');
  });
});

describe('markDone', () => {
  it('stamps that one idea with the current time and leaves its date alone', async () => {
    const { calls } = fakeClient();
    const before = Date.now();
    await markDone('i1');
    const [update] = stepsFor(calls, 'ideas');
    const [values] = argsOf(update, 'update') as [{ done_at: string }];
    expect(Object.keys(values)).toEqual(['done_at']);
    expect(new Date(values.done_at).getTime()).toBeGreaterThanOrEqual(before);
    expect(new Date(values.done_at).getTime()).toBeLessThanOrEqual(Date.now());
    expect(argsOf(update, 'eq')).toEqual(['id', 'i1']);
  });
});

describe('fetchDone', () => {
  it('asks for only the done ideas of that group, most recently done first', async () => {
    const { calls } = fakeClient();
    await fetchDone('g1');
    const [query] = stepsFor(calls, 'ideas');
    expect(argsOf(query, 'eq')).toEqual(['group_id', 'g1']);
    expect(argsOf(query, 'not')).toEqual(['done_at', 'is', null]);
    expect(argsOf(query, 'order')).toEqual(['done_at', { ascending: false }]);
  });

  it('returns the ideas, or an empty list when there are none', async () => {
    const idea = { id: 'i1', title: 'Picnic', done_at: '2026-11-14T10:00:00.000Z' };
    fakeClient({ ideas: [{ data: [idea] }] });
    expect(await fetchDone('g1')).toEqual([idea]);
    fakeClient();
    expect(await fetchDone('g1')).toEqual([]);
  });

  it('throws the database error', async () => {
    fakeClient({ ideas: [{ error: { message: 'no access' } }] });
    await expect(fetchDone('g1')).rejects.toThrow('no access');
  });
});

describe('restoreIdea', () => {
  it('clears only the done mark on that one idea', async () => {
    const { calls } = fakeClient();
    await restoreIdea('i1');
    const [update] = stepsFor(calls, 'ideas');
    expect(argsOf(update, 'update')).toEqual([{ done_at: null }]);
    expect(argsOf(update, 'eq')).toEqual(['id', 'i1']);
  });
});

describe('fetchGroup', () => {
  it('asks for each idea\'s planned date', async () => {
    const { calls } = fakeClient();
    await fetchGroup('g1');
    expect(String(argsOf(stepsFor(calls, 'ideas')[0], 'select')?.[0])).toContain('planned_for');
  });

  it('returns null when the group does not exist', async () => {
    fakeClient();
    expect(await fetchGroup('missing')).toBeNull();
  });

  it('combines the group with its members, lists, ideas and reactions', async () => {
    const list = { id: 'l1', name: 'Food', position: 0 };
    const idea = { id: 'i1', list_id: 'l1', title: 'Picnic', link: null, note: null, added_by: 'ann', created_at: 'now' };
    fakeClient({
      groups: [{ data: { id: 'g1', name: 'Friends', cover: '🌼', invite_code: 'abc' } }],
      group_members: [
        {
          data: [
            { user_id: 'ann', profiles: { name: 'Ann', color: '#111', photo_url: 'https://lh3.googleusercontent.com/a/ann' } },
            { user_id: 'bo', profiles: [{ name: 'Bo', color: '#222' }] },
            { user_id: 'cy', profiles: null },
          ],
        },
      ],
      lists: [{ data: [list] }],
      ideas: [{ data: [idea] }],
      reactions: [{ data: [react('i1', 'ann', '👍')] }],
      comments: [{ data: [{ idea_id: 'i1' }, { idea_id: 'i1' }] }],
    });
    expect(await fetchGroup('g1')).toEqual({
      id: 'g1',
      name: 'Friends',
      cover: '🌼',
      invite_code: 'abc',
      owner: 'ann',
      members: [
        { user_id: 'ann', name: 'Ann', color: '#111', photo: 'https://lh3.googleusercontent.com/a/ann' },
        { user_id: 'bo', name: 'Bo', color: '#222', photo: null },
        { user_id: 'cy', name: 'Someone', color: '#FFD9C7', photo: null },
      ],
      lists: [list],
      ideas: [idea],
      reactions: [react('i1', 'ann', '👍')],
      commentCounts: { i1: 2 },
    });
  });

  it('still shows the group when comments cannot be read, with no counts', async () => {
    fakeClient({
      groups: [{ data: { id: 'g1', name: 'Friends', cover: '🌼', invite_code: 'abc' } }],
      comments: [{ error: { message: 'relation "comments" does not exist' } }],
    });
    expect((await fetchGroup('g1'))?.commentCounts).toEqual({});
  });

  it('leaves out ideas that are marked done', async () => {
    const { calls } = fakeClient();
    await fetchGroup('g1');
    expect(argsOf(stepsFor(calls, 'ideas')[0], 'is')).toEqual(['done_at', null]);
  });

  it('throws when any one of the queries fails', async () => {
    fakeClient({
      groups: [{ data: { id: 'g1', name: 'Friends', cover: '🌼', invite_code: 'abc' } }],
      lists: [{ error: { message: 'lists unavailable' } }],
    });
    await expect(fetchGroup('g1')).rejects.toThrow('lists unavailable');
  });
});

describe('fetchGroups', () => {
  it('returns each group with its members', async () => {
    fakeClient({
      groups: [
        {
          data: [
            {
              id: 'g1',
              name: 'Friends',
              cover: '🌼',
              created_at: 'now',
              group_members: [{ user_id: 'ann', profiles: { name: 'Ann', color: '#111' } }],
            },
          ],
        },
      ],
    });
    expect(await fetchGroups()).toEqual([
      { id: 'g1', name: 'Friends', cover: '🌼', members: [{ user_id: 'ann', name: 'Ann', color: '#111', photo: null }] },
    ]);
  });

  it('returns an empty list when there is no data', async () => {
    fakeClient();
    expect(await fetchGroups()).toEqual([]);
  });
});

describe('previewGroup', () => {
  it('returns the group behind an invite code', async () => {
    const { client } = fakeClient({ 'rpc:group_preview': [{ data: [{ name: 'Friends', cover: '🌼', member_count: 3 }] }] });
    expect(await previewGroup('abc')).toEqual({ name: 'Friends', cover: '🌼', member_count: 3 });
    expect(client.rpc).toHaveBeenCalledWith('group_preview', { p_code: 'abc' });
  });

  it('returns null for an unknown code', async () => {
    fakeClient({ 'rpc:group_preview': [{ data: [] }] });
    expect(await previewGroup('nope')).toBeNull();
  });
});
