import {
  DOUBLE_TAP_EMOJI,
  DOUBLE_TAP_MS,
  fetchCommentReactions,
  isDoubleTap,
  nextReaction,
  NO_COMMENT_REACTIONS,
  reactionCount,
  setCommentReaction,
  SHOWN,
  summarize,
  summaryWords,
  withReaction,
  type CommentReaction,
} from '../comment-reactions';
import { db } from '../supabase';
import { COMMENT_REACTIONS } from '../theme';

jest.mock('../supabase', () => ({ db: jest.fn() }));

type Result = { data?: unknown; error?: { message: string; code?: string } | null; count?: number | null };

/** A stand-in for the Supabase client that records the chain of calls and resolves to `result`. */
function fakeClient(result: Result = {}) {
  const steps: [method: string, ...args: unknown[]][] = [];
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'upsert', 'delete', 'match', 'eq', 'order', 'range']) {
    builder[method] = (...args: unknown[]) => {
      steps.push([method, ...args]);
      return builder;
    };
  }
  builder.then = (resolve: (r: Result) => unknown, reject: (e: unknown) => unknown) => Promise.resolve({ data: null, error: null, ...result }).then(resolve, reject);
  const from = jest.fn((_table: string) => builder);
  jest.mocked(db).mockReturnValue({ from } as never);
  return { from, steps };
}

const at = (minute: number) => `2026-11-24T10:${String(minute).padStart(2, '0')}:00Z`;
const reaction = (comment_id: string, user_id: string, emoji: string, minute = 0): CommentReaction => ({ comment_id, user_id, emoji, created_at: at(minute) });

describe('summarize', () => {
  it('leaves out a comment nobody has reacted to', () => {
    expect(summarize([], 'me')).toEqual({});
    expect(summarize(null, 'me')).toEqual({});
    expect(summarize([reaction('c1', 'ann', '😂')], 'me').c2).toBeUndefined();
  });

  it('counts the people who reacted, and says who they were in the order they did', () => {
    const rows = [reaction('c1', 'bo', '❤️', 2), reaction('c1', 'ann', '😂', 1), reaction('c2', 'ann', '👍', 3)];
    const { c1, c2 } = summarize(rows, 'me');
    expect(c1.total).toBe(2);
    expect(c1.people).toEqual([
      { userId: 'ann', emoji: '😂' },
      { userId: 'bo', emoji: '❤️' },
    ]);
    expect(c2).toMatchObject({ total: 1, top: ['👍'] });
  });

  it('puts the emoji used most first, and among equals the one used first', () => {
    const rows = [reaction('c1', 'ann', '👍', 1), reaction('c1', 'bo', '😂', 2), reaction('c1', 'cy', '😂', 3), reaction('c1', 'di', '❤️', 4)];
    expect(summarize(rows, null).c1.top).toEqual(['😂', '👍', '❤️']);
  });

  it(`shows no more than ${SHOWN} different emoji, while still counting everyone`, () => {
    const rows = ['👍', '❤️', '😂', '😮', '😢'].map((emoji, i) => reaction('c1', `user-${i}`, emoji, i));
    const { c1 } = summarize(rows, null);
    expect(c1.top).toEqual(['👍', '❤️', '😂']);
    expect(c1.total).toBe(5);
    expect(summarize(rows, null, 2).c1.top).toHaveLength(2);
  });

  it("knows the reaction of the person looking, and that a stranger's is not theirs", () => {
    const rows = [reaction('c1', 'ann', '😂'), reaction('c1', 'me', '❤️', 1)];
    expect(summarize(rows, 'me').c1.mine).toBe('❤️');
    expect(summarize(rows, 'zed').c1.mine).toBeNull();
    expect(summarize(rows, null).c1.mine).toBeNull();
  });
});

describe('reacting', () => {
  it('makes a tapped emoji the reaction, changes to another, and takes the same one away', () => {
    expect(nextReaction(null, '😂')).toBe('😂');
    expect(nextReaction('😂', '❤️')).toBe('❤️');
    expect(nextReaction('😂', '😂')).toBeNull();
  });

  it('shows a new reaction at once, after the ones already there', () => {
    const rows = [reaction('c1', 'ann', '😂')];
    const next = withReaction(rows, 'c1', 'me', '❤️', new Date(at(5)));
    expect(next).toEqual([...rows, { comment_id: 'c1', user_id: 'me', emoji: '❤️', created_at: new Date(at(5)).toISOString() }]);
    expect(rows).toHaveLength(1);
  });

  it('changes a reaction where it stands, and nobody else\'s', () => {
    const rows = [reaction('c1', 'me', '😂', 1), reaction('c1', 'ann', '😂', 2), reaction('c2', 'me', '👍', 3)];
    expect(withReaction(rows, 'c1', 'me', '❤️', new Date())).toEqual([reaction('c1', 'me', '❤️', 1), rows[1], rows[2]]);
  });

  it('takes a reaction away, and does nothing when there was none', () => {
    const rows = [reaction('c1', 'me', '😂'), reaction('c1', 'ann', '😂')];
    expect(withReaction(rows, 'c1', 'me', null, new Date())).toEqual([rows[1]]);
    expect(withReaction(rows, 'c2', 'me', null, new Date())).toEqual(rows);
  });
});

describe('tapping a comment twice', () => {
  const first = { commentId: 'c-1', at: 1000 };

  it('is two taps on the same comment, close together', () => {
    expect(isDoubleTap(first, { commentId: 'c-1', at: 1180 })).toBe(true);
    expect(isDoubleTap(first, { commentId: 'c-1', at: 1000 + DOUBLE_TAP_MS })).toBe(true);
  });

  it('is not a first tap, a slow second tap, or a tap on another comment', () => {
    expect(isDoubleTap(null, first)).toBe(false);
    expect(isDoubleTap(first, { commentId: 'c-1', at: 1001 + DOUBLE_TAP_MS })).toBe(false);
    expect(isDoubleTap(first, { commentId: 'c-2', at: 1100 })).toBe(false);
  });

  it('is not a tap from before the last one, as when the clock is put back', () => {
    expect(isDoubleTap(first, { commentId: 'c-1', at: 900 })).toBe(false);
  });

  it('leaves an emoji that is one of those offered', () => {
    expect(COMMENT_REACTIONS).toContain(DOUBLE_TAP_EMOJI);
  });
});

describe('the words for a screen reader', () => {
  it('counts one reaction and several', () => {
    expect(reactionCount(1)).toBe('1 reaction');
    expect(reactionCount(4)).toBe('4 reactions');
  });

  it('says how many reacted, with what, and that tapping shows who', () => {
    expect(summaryWords({ total: 3, top: ['😂', '❤️'] })).toBe('3 reactions: 😂 ❤️. See who reacted');
  });
});

describe('fetchCommentReactions', () => {
  it("asks for an idea's reactions, oldest first, in an order no two rows share", async () => {
    const rows = [reaction('c1', 'ann', '😂')];
    const { from, steps } = fakeClient({ data: rows, count: 1 });
    await expect(fetchCommentReactions('idea-1')).resolves.toEqual(rows);
    expect(from).toHaveBeenCalledWith('comment_reactions');
    expect(steps).toContainEqual(['eq', 'idea_id', 'idea-1']);
    expect(steps.filter(([method]) => method === 'order').map(([, column]) => column)).toEqual(['created_at', 'comment_id', 'user_id']);
  });

  it('gives none, without failing, when the database does not have the update yet', async () => {
    fakeClient({ error: { message: 'Could not find the table', code: 'PGRST205' } });
    await expect(fetchCommentReactions('idea-1')).resolves.toEqual([]);
    fakeClient({ error: { message: 'relation does not exist', code: '42P01' } });
    await expect(fetchCommentReactions('idea-1')).resolves.toEqual([]);
  });

  it('passes on any other failure', async () => {
    fakeClient({ error: { message: 'No connection' } });
    await expect(fetchCommentReactions('idea-1')).rejects.toThrow('No connection');
  });
});

describe('setCommentReaction', () => {
  const input = { groupId: 'g1', ideaId: 'idea-1', commentId: 'c1', userId: 'me' };

  it('saves a reaction so that it takes the place of the one already there', async () => {
    const { from, steps } = fakeClient();
    await setCommentReaction({ ...input, emoji: '😂' });
    expect(from).toHaveBeenCalledWith('comment_reactions');
    expect(steps).toEqual([['upsert', { comment_id: 'c1', idea_id: 'idea-1', group_id: 'g1', user_id: 'me', emoji: '😂' }, { onConflict: 'comment_id,user_id' }]]);
  });

  it("takes away only this person's reaction to this comment", async () => {
    const { steps } = fakeClient();
    await setCommentReaction({ ...input, emoji: null });
    expect(steps).toEqual([['delete'], ['match', { comment_id: 'c1', user_id: 'me' }]]);
  });

  it('names the missing update when the database does not have it', async () => {
    fakeClient({ error: { message: 'Could not find the table', code: 'PGRST205' } });
    await expect(setCommentReaction({ ...input, emoji: '😂' })).rejects.toThrow(NO_COMMENT_REACTIONS);
    fakeClient({ error: { message: 'Could not find the table', code: 'PGRST205' } });
    await expect(setCommentReaction({ ...input, emoji: null })).rejects.toThrow(NO_COMMENT_REACTIONS);
  });

  it('passes on any other failure', async () => {
    fakeClient({ error: { message: 'new row violates row-level security policy' } });
    await expect(setCommentReaction({ ...input, emoji: '😂' })).rejects.toThrow('row-level security');
  });
});
