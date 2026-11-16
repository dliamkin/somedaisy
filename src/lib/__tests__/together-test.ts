import { db } from '../supabase';
import { canUndoDone, doItAgain, fetchAgainPrompts, fetchCompletions, fetchDoAgainVotes, fetchFreshCompletion, fetchPointsByGroup, setDoAgain, undoDone, UNDO_MINUTES } from '../together';

jest.mock('../supabase', () => ({ db: jest.fn() }));

type Result = { data?: unknown; error?: { message: string; code?: string } | null };
type Call = { table: string; steps: [method: string, ...args: unknown[]][] };

/** A stand-in for the Supabase client: each query on a table resolves to the next result queued for it. */
function fakeClient(results: Record<string, Result[]> = {}) {
  const calls: Call[] = [];
  const query = (table: string) => {
    const call: Call = { table, steps: [] };
    calls.push(call);
    const builder: Record<string, unknown> = {};
    for (const method of ['select', 'update', 'upsert', 'eq', 'gte', 'order', 'limit']) {
      builder[method] = (...args: unknown[]) => {
        call.steps.push([method, ...args]);
        return builder;
      };
    }
    builder.then = (resolve: (r: Result) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null, ...(results[table]?.shift() ?? {}) }).then(resolve, reject);
    return builder;
  };
  jest.mocked(db).mockReturnValue({ from: jest.fn(query) } as never);
  return calls;
}

const stepsFor = (calls: Call[], table: string) => calls.filter((c) => c.table === table).map((c) => c.steps);
const argsOf = (steps: Call['steps'], method: string) => steps.find(([m]) => m === method)?.slice(1);
const allArgsOf = (steps: Call['steps'], method: string) => steps.filter(([m]) => m === method).map((s) => s.slice(1));
const missing = { error: { message: "Could not find the table 'public.completions' in the schema cache", code: 'PGRST205' } };
const offline = { error: { message: 'TypeError: Failed to fetch' } };
const now = new Date('2026-11-14T12:00:00.000Z');

describe('fetchCompletions', () => {
  it('asks for that group\'s completions, newest first', async () => {
    const calls = fakeClient({ completions: [{ data: [{ id: 'c1', points: 20 }] }] });
    expect(await fetchCompletions('g1')).toEqual([{ id: 'c1', points: 20 }]);
    const [query] = stepsFor(calls, 'completions');
    expect(argsOf(query, 'eq')).toEqual(['group_id', 'g1']);
    expect(argsOf(query, 'order')).toEqual(['done_at', { ascending: false }]);
  });

  it('is an empty list for a group that has done nothing', async () => {
    fakeClient();
    expect(await fetchCompletions('g1')).toEqual([]);
  });

  it('says "not available" instead of failing when points are not set up', async () => {
    fakeClient({ completions: [missing] });
    expect(await fetchCompletions('g1')).toBeNull();
  });

  it('fails for any other reason, so a dropped connection is not mistaken for "not set up"', async () => {
    fakeClient({ completions: [offline] });
    await expect(fetchCompletions('g1')).rejects.toThrow('Failed to fetch');
  });
});

describe('fetchPointsByGroup', () => {
  it('adds the points up for each group', async () => {
    fakeClient({ completions: [{ data: [{ group_id: 'g1', points: 20 }, { group_id: 'g2', points: 15 }, { group_id: 'g1', points: 15 }] }] });
    expect(await fetchPointsByGroup()).toEqual({ g1: 35, g2: 15 });
  });

  it('is empty when nothing has been done, and "not available" when points are not set up', async () => {
    fakeClient();
    expect(await fetchPointsByGroup()).toEqual({});
    fakeClient({ completions: [missing] });
    expect(await fetchPointsByGroup()).toBeNull();
  });
});

describe('fetchFreshCompletion', () => {
  it('returns the completion just recorded for the idea', async () => {
    const fresh = { id: 'c1', done_at: '2026-11-14T11:59:30.000Z', points: 20 };
    const calls = fakeClient({ completions: [{ data: [fresh] }] });
    expect(await fetchFreshCompletion('i1', now)).toEqual(fresh);
    const [query] = stepsFor(calls, 'completions');
    expect(argsOf(query, 'eq')).toEqual(['idea_id', 'i1']);
    expect(argsOf(query, 'limit')).toEqual([1]);
  });

  it('ignores an old completion: the same outing marked twice earns nothing new', async () => {
    fakeClient({ completions: [{ data: [{ id: 'c1', done_at: '2026-11-14T09:00:00.000Z', points: 20 }] }] });
    expect(await fetchFreshCompletion('i1', now)).toBeNull();
  });

  it('is nothing when there is none, or points are not set up', async () => {
    fakeClient();
    expect(await fetchFreshCompletion('i1', now)).toBeNull();
    fakeClient({ completions: [missing] });
    expect(await fetchFreshCompletion('i1', now)).toBeNull();
  });
});

describe('do-again answers', () => {
  it('reads the group\'s answers', async () => {
    const votes = [{ idea_id: 'i1', user_id: 'ann', again: true }];
    const calls = fakeClient({ do_again_votes: [{ data: votes }] });
    expect(await fetchDoAgainVotes('g1')).toEqual(votes);
    expect(argsOf(stepsFor(calls, 'do_again_votes')[0], 'eq')).toEqual(['group_id', 'g1']);
  });

  it('says "not available" when they are not set up', async () => {
    fakeClient({ do_again_votes: [missing] });
    expect(await fetchDoAgainVotes('g1')).toBeNull();
  });

  it('fails for any other reason, so a dropped connection cannot bring back the old way of putting ideas back', async () => {
    fakeClient({ do_again_votes: [offline] });
    await expect(fetchDoAgainVotes('g1')).rejects.toThrow('Failed to fetch');
  });

  it('saves an answer so that answering again replaces it', async () => {
    const calls = fakeClient();
    await setDoAgain('g1', 'i1', 'ann', false);
    const [row, options] = argsOf(stepsFor(calls, 'do_again_votes')[0], 'upsert') as [Record<string, unknown>, unknown];
    expect(row).toMatchObject({ idea_id: 'i1', group_id: 'g1', user_id: 'ann', again: false });
    expect(options).toEqual({ onConflict: 'idea_id,user_id' });
  });

  it('throws when the answer could not be saved', async () => {
    fakeClient({ do_again_votes: [{ error: { message: 'not a member' } }] });
    await expect(setDoAgain('g1', 'i1', 'ann', true)).rejects.toThrow('not a member');
  });
});

describe('doItAgain', () => {
  it('puts the idea back on its list with no date', async () => {
    const calls = fakeClient();
    await doItAgain('i1');
    const [update] = stepsFor(calls, 'ideas');
    expect(argsOf(update, 'update')).toEqual([{ done_at: null, planned_for: null }]);
    expect(argsOf(update, 'eq')).toEqual(['id', 'i1']);
  });

  it('throws the database error', async () => {
    fakeClient({ ideas: [{ error: { message: 'not a member' } }] });
    await expect(doItAgain('i1')).rejects.toThrow('not a member');
  });
});

describe('fetchAgainPrompts', () => {
  const done = [{ id: 'i1', title: 'Picnic', done_at: 'x' }, { id: 'i2', title: 'Tacos', done_at: 'y' }];

  it('lists recent done ideas this person has not answered for', async () => {
    const calls = fakeClient({ ideas: [{ data: done }], do_again_votes: [{ data: [{ idea_id: 'i1' }] }] });
    expect(await fetchAgainPrompts('g1', 'ann', now)).toEqual([{ id: 'i2', title: 'Tacos' }]);
    const [ideas] = stepsFor(calls, 'ideas');
    expect(argsOf(ideas, 'eq')).toEqual(['group_id', 'g1']);
    expect(argsOf(ideas, 'gte')).toEqual(['done_at', '2026-10-15T12:00:00.000Z']);
    expect(allArgsOf(stepsFor(calls, 'do_again_votes')[0], 'eq')).toEqual([['group_id', 'g1'], ['user_id', 'ann']]);
  });

  it('asks about everything when nothing has been answered', async () => {
    fakeClient({ ideas: [{ data: done }] });
    expect(await fetchAgainPrompts('g1', 'ann', now)).toEqual([{ id: 'i1', title: 'Picnic' }, { id: 'i2', title: 'Tacos' }]);
  });

  it('asks nothing when answers are not set up, rather than asking what cannot be saved', async () => {
    fakeClient({ ideas: [{ data: done }], do_again_votes: [missing] });
    expect(await fetchAgainPrompts('g1', 'ann', now)).toEqual([]);
  });
});

describe('canUndoDone', () => {
  it('is true for ten minutes after the mark, and not after', () => {
    expect(canUndoDone('2026-11-14T11:59:00.000Z', now)).toBe(true);
    expect(canUndoDone('2026-11-14T11:50:01.000Z', now)).toBe(true);
    expect(canUndoDone('2026-11-14T11:50:00.000Z', now)).toBe(false);
    expect(canUndoDone('2026-11-13T12:00:00.000Z', now)).toBe(false);
    expect(UNDO_MINUTES).toBe(10);
  });

  it('allows for a phone clock a little ahead, and is false with no time at all', () => {
    expect(canUndoDone('2026-11-14T12:00:30.000Z', now)).toBe(true);
    expect(canUndoDone('2026-11-14T12:05:00.000Z', now)).toBe(false);
    expect(canUndoDone(null, now)).toBe(false);
    expect(canUndoDone(undefined, now)).toBe(false);
  });
});

describe('undoDone', () => {
  const withRpc = (result: Result) => {
    const rpc = jest.fn(() => Promise.resolve({ data: null, error: null, ...result }));
    jest.mocked(db).mockReturnValue({ rpc } as never);
    return rpc;
  };

  it('asks the database to undo that idea, and says whether it did', async () => {
    const rpc = withRpc({ data: true });
    expect(await undoDone('i1')).toBe(true);
    expect(rpc).toHaveBeenCalledWith('undo_done', { p_idea: 'i1' });
    withRpc({ data: false });
    expect(await undoDone('i1')).toBe(false);
  });

  it('explains itself when undo is not set up, and passes on any other failure', async () => {
    withRpc({ error: { message: 'Could not find the function public.undo_done', code: 'PGRST202' } });
    await expect(undoDone('i1')).rejects.toThrow('Undo is not set up yet');
    withRpc({ error: { message: 'You are not in that group' } });
    await expect(undoDone('i1')).rejects.toThrow('You are not in that group');
  });
});
