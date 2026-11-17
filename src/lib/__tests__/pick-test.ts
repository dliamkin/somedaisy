import type { Idea, Member, Reaction } from '../data';
import { ANY, approved, isSetting, isTakes, pickOne, pickPool, tagLine } from '../pick';

const members: Member[] = [
  { user_id: 'ann', name: 'Ann', color: '#fff', photo: null },
  { user_id: 'bo', name: 'Bo', color: '#fff', photo: null },
];

const idea = (id: string, over: Partial<Idea> = {}): Idea => ({
  id,
  list_id: 'food',
  title: id,
  link: null,
  note: null,
  added_by: 'ann',
  planned_for: null,
  created_at: '2026-11-01T00:00:00Z',
  ...over,
});

const up = (ideaId: string, ...who: string[]): Reaction[] => who.map((user_id) => ({ idea_id: ideaId, user_id, emoji: '👍' }));
const down = (ideaId: string, user_id: string): Reaction => ({ idea_id: ideaId, user_id, emoji: '👎' });
const ids = (ideas: Idea[]) => ideas.map((i) => i.id);

describe('approved', () => {
  it('needs a thumbs up from everyone', () => {
    expect(approved('a', members, up('a', 'ann', 'bo'), false)).toBe(true);
    expect(approved('a', members, up('a', 'ann'), false)).toBe(false);
    expect(approved('a', members, [], false)).toBe(false);
  });

  it('with undecided, one yes is enough as long as nobody said no', () => {
    expect(approved('a', members, up('a', 'ann'), true)).toBe(true);
    expect(approved('a', members, [...up('a', 'ann'), down('a', 'bo')], true)).toBe(false);
    expect(approved('a', members, [], true)).toBe(false);
    expect(approved('a', members, [{ idea_id: 'a', user_id: 'bo', emoji: '🔥' }], true)).toBe(false);
  });

  it('ignores people who have left the group', () => {
    expect(approved('a', members, [...up('a', 'ann', 'bo'), down('a', 'gone')], true)).toBe(true);
    expect(approved('a', members, up('a', 'gone'), true)).toBe(false);
  });

  it('counts a thumbs up from the only member of a group of one', () => {
    expect(approved('a', [members[0]], up('a', 'ann'), false)).toBe(true);
    expect(approved('a', [members[0]], [], false)).toBe(false);
  });
});

describe('pickPool', () => {
  const ideas = [
    idea('plain'),
    idea('quick-in', { takes: 'short', setting: 'in' }),
    idea('evening-out', { takes: 'medium', setting: 'out' }),
    idea('day-out', { takes: 'long', setting: 'out', list_id: 'trips' }),
    idea('dated', { planned_for: '2026-12-01T18:00:00Z' }),
    idea('half', { takes: 'short' }),
    idea('refused'),
  ];
  const reactions = [
    ...['plain', 'quick-in', 'evening-out', 'day-out', 'dated'].flatMap((i) => up(i, 'ann', 'bo')),
    ...up('half', 'ann'),
    ...up('refused', 'ann'),
    down('refused', 'bo'),
  ];
  const group = { ideas, members, reactions };

  it('holds what everyone is in on and has no date yet', () => {
    expect(ids(pickPool(group, ANY))).toEqual(['plain', 'quick-in', 'evening-out', 'day-out']);
  });

  it('leaves out what takes longer than the time there is, and keeps untagged ideas', () => {
    expect(ids(pickPool(group, { ...ANY, time: 'short' }))).toEqual(['plain', 'quick-in']);
    expect(ids(pickPool(group, { ...ANY, time: 'medium' }))).toEqual(['plain', 'quick-in', 'evening-out']);
    expect(ids(pickPool(group, { ...ANY, time: 'long' }))).toEqual(['plain', 'quick-in', 'evening-out', 'day-out']);
  });

  it('matches staying in or going out, and keeps untagged ideas', () => {
    expect(ids(pickPool(group, { ...ANY, setting: 'in' }))).toEqual(['plain', 'quick-in']);
    expect(ids(pickPool(group, { ...ANY, setting: 'out' }))).toEqual(['plain', 'evening-out', 'day-out']);
  });

  it('can keep to one list', () => {
    expect(ids(pickPool(group, { ...ANY, listId: 'trips' }))).toEqual(['day-out']);
  });

  it('can take in ideas still waiting on someone, but never one somebody refused', () => {
    expect(ids(pickPool(group, { ...ANY, undecided: true }))).toEqual(['plain', 'quick-in', 'evening-out', 'day-out', 'half']);
  });

  it('treats a tag it does not know as no tag', () => {
    const odd = { ideas: [idea('odd', { takes: 'forever', setting: 'space' })], members, reactions: up('odd', 'ann', 'bo') };
    expect(ids(pickPool(odd, { ...ANY, time: 'short', setting: 'in' }))).toEqual(['odd']);
  });
});

describe('pickOne', () => {
  const pool = [idea('a'), idea('b'), idea('c')];

  it('picks by chance from the pool', () => {
    expect(pickOne(pool, null, () => 0)?.id).toBe('a');
    expect(pickOne(pool, null, () => 0.5)?.id).toBe('b');
    expect(pickOne(pool, null, () => 0.999)?.id).toBe('c');
    expect(pickOne(pool, null, () => 1)?.id).toBe('c');
  });

  it('does not pick the same idea twice in a row', () => {
    for (const r of [0, 0.3, 0.6, 0.99]) expect(pickOne(pool, 'a', () => r)?.id).not.toBe('a');
  });

  it('picks the only idea again when there is nothing else, and nothing from an empty pool', () => {
    expect(pickOne([pool[0]], 'a')?.id).toBe('a');
    expect(pickOne([])).toBeNull();
  });
});

describe('tags', () => {
  it('knows its own values only', () => {
    expect(['short', 'medium', 'long'].every(isTakes)).toBe(true);
    expect(['in', 'out'].every(isSetting)).toBe(true);
    expect([null, undefined, '', 'Short', 'quick'].some(isTakes)).toBe(false);
    expect([null, undefined, '', 'both'].some(isSetting)).toBe(false);
  });

  it('puts them in words', () => {
    expect(tagLine({ takes: 'medium', setting: 'out' })).toBe('A few hours · Going out');
    expect(tagLine({ takes: 'short', setting: null })).toBe('An hour or so');
    expect(tagLine({ setting: 'in' })).toBe('Staying in');
    expect(tagLine({})).toBe('');
  });
});
