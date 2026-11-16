import { addComment, cleanComment, COMMENT_MAX, countByIdea, fetchComments, latestByIdea, removeComment, timeAgo } from '../comments';
import { db } from '../supabase';

jest.mock('../supabase', () => ({ db: jest.fn() }));

type Result = { data?: unknown; error?: { message: string } | null };

/** A stand-in for the Supabase client that records the chain of calls and resolves to `result`. */
function fakeClient(result: Result = {}) {
  const steps: [method: string, ...args: unknown[]][] = [];
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'insert', 'delete', 'eq', 'order']) {
    builder[method] = (...args: unknown[]) => {
      steps.push([method, ...args]);
      return builder;
    };
  }
  builder.then = (resolve: (r: Result) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve({ data: null, error: null, ...result }).then(resolve, reject);
  const from = jest.fn((_table: string) => builder);
  jest.mocked(db).mockReturnValue({ from } as never);
  return { from, steps };
}

describe('cleanComment', () => {
  it('trims the text', () => {
    expect(cleanComment('  Sounds fun \n')).toBe('Sounds fun');
  });

  it('is null when there is nothing to say', () => {
    expect(cleanComment('')).toBeNull();
    expect(cleanComment('   \n ')).toBeNull();
  });

  it('cuts text the database would refuse as too long', () => {
    expect(cleanComment('x'.repeat(COMMENT_MAX + 50))).toHaveLength(COMMENT_MAX);
  });
});

describe('latestByIdea', () => {
  const row = (id: string, idea: string, day: number) => ({ id, idea_id: idea, user_id: 'u', body: id, created_at: `2026-01-0${day}T10:00:00Z` });

  it('keeps the newest two per idea, older one first, whatever order the rows come in', () => {
    const latest = latestByIdea([row('c3', 'a', 3), row('b1', 'b', 2), row('c1', 'a', 1), row('c2', 'a', 2)]);
    expect(latest.a.map((c) => c.id)).toEqual(['c2', 'c3']);
    expect(latest.b.map((c) => c.id)).toEqual(['b1']);
  });

  it('can keep a different number, and is empty when there are no rows', () => {
    expect(latestByIdea([row('c1', 'a', 1), row('c2', 'a', 2)], 1).a.map((c) => c.id)).toEqual(['c2']);
    expect(latestByIdea([])).toEqual({});
    expect(latestByIdea(null)).toEqual({});
  });
});

describe('countByIdea', () => {
  it('counts comments per idea and leaves out ideas with none', () => {
    expect(countByIdea([{ idea_id: 'a' }, { idea_id: 'b' }, { idea_id: 'a' }])).toEqual({ a: 2, b: 1 });
  });

  it('is empty when there are no rows', () => {
    expect(countByIdea([])).toEqual({});
    expect(countByIdea(null)).toEqual({});
  });
});

describe('timeAgo', () => {
  const now = new Date('2026-11-14T12:00:00Z');
  const before = (minutes: number) => new Date(now.getTime() - minutes * 60000).toISOString();

  it('says "just now" for the last minute, and for a clock that is slightly ahead', () => {
    expect(timeAgo(before(0), now)).toBe('just now');
    expect(timeAgo(before(0.5), now)).toBe('just now');
    expect(timeAgo(before(-2), now)).toBe('just now');
  });

  it('counts minutes, then hours', () => {
    expect(timeAgo(before(5), now)).toBe('5 min ago');
    expect(timeAgo(before(59), now)).toBe('59 min ago');
    expect(timeAgo(before(60), now)).toBe('1 hr ago');
    expect(timeAgo(before(23 * 60 + 59), now)).toBe('23 hr ago');
  });

  it('gives the date once it is a day old', () => {
    const text = timeAgo(before(3 * 24 * 60), now);
    expect(text).not.toContain('ago');
    expect(text).toMatch(/\d/);
  });
});

describe('fetchComments', () => {
  it('reads one idea\'s comments, oldest first', async () => {
    const comment = { id: 'c1', idea_id: 'i1', user_id: 'bo', body: 'Hi', created_at: 'now' };
    const { from, steps } = fakeClient({ data: [comment] });
    expect(await fetchComments('i1')).toEqual([comment]);
    expect(from).toHaveBeenCalledWith('comments');
    expect(steps).toContainEqual(['eq', 'idea_id', 'i1']);
    expect(steps).toContainEqual(['order', 'created_at', { ascending: true }]);
  });

  it('fails with the database message', async () => {
    fakeClient({ error: { message: 'relation "comments" does not exist' } });
    await expect(fetchComments('i1')).rejects.toThrow('does not exist');
  });
});

describe('addComment', () => {
  it('saves the trimmed comment under the idea, group and author', async () => {
    const { steps } = fakeClient();
    await addComment({ groupId: 'g1', ideaId: 'i1', userId: 'bo', text: '  Count me in ' });
    expect(steps).toEqual([['insert', { group_id: 'g1', idea_id: 'i1', user_id: 'bo', body: 'Count me in' }]]);
  });

  it('saves nothing when the comment is blank', async () => {
    const { from } = fakeClient();
    await addComment({ groupId: 'g1', ideaId: 'i1', userId: 'bo', text: '   ' });
    expect(from).not.toHaveBeenCalled();
  });

  it('fails when the database refuses', async () => {
    fakeClient({ error: { message: 'new row violates row-level security policy' } });
    await expect(addComment({ groupId: 'g1', ideaId: 'i1', userId: 'bo', text: 'Hi' })).rejects.toThrow('row-level security');
  });
});

describe('removeComment', () => {
  it('removes that one comment', async () => {
    const { steps } = fakeClient();
    await removeComment('c1');
    expect(steps).toEqual([['delete'], ['eq', 'id', 'c1']]);
  });
});
