import {
  ago,
  amAdmin,
  barWidth,
  cleanFind,
  count,
  countOf,
  coverSays,
  dayOf,
  groupDetailFrom,
  isId,
  listedFrom,
  loadGroup,
  loadGroups,
  loadOverview,
  loadPeople,
  loadPerson,
  NOT_LOADED,
  overviewFrom,
  PAGE,
  personDetailFrom,
  SEARCH_MAX,
  share,
  signsInWith,
  weekLabel,
} from '../admin';
import { db } from '../supabase';

jest.mock('../supabase', () => ({ db: jest.fn() }));

/** A stand-in for Supabase: `rpc` answers as the database would. */
function fakeClient(rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>) {
  const client = { rpc: jest.fn(rpc) };
  jest.mocked(db).mockReturnValue(client as never);
  return client;
}

const ID = '0f0e0d0c-0b0a-4908-8706-050403020100';
const OTHER = '11111111-2222-4333-8444-555555555555';

/** The overview, the way the database sends it. */
const sent = () => ({
  totals: { people: 4, accounts: 3, guests: 1, groups: 2, shared_groups: 1, ideas: 3, plans: 1, done: 1, reactions: 1, comments: 1, phones: 1 },
  week: { new_people: 4, new_groups: 2, active_people: 4, active_groups: 2, ideas: 3, done: 1 },
  weeks: [
    { start: '2026-11-09', people: 0, groups: 0 },
    { start: '2026-11-16', people: 4, groups: 2 },
  ],
  funnel: { named: 4, in_group: 4, added_idea: 3, did_one: 3 },
  invited: 2,
  lasting: { old_groups: 2, still_used: 1 },
  covers: { classic: 1, look: 1, uploaded: 0, searched: 0 },
  idea_pictures: 1,
});

const personRow = (change: Record<string, unknown> = {}) => ({
  id: ID,
  name: 'Ann',
  color: '#CFE3FF',
  email: 'ann@example.com',
  guest: false,
  google: true,
  joined: '2026-11-01T10:00:00+00:00',
  last_active: '2026-11-20T10:00:00+00:00',
  groups: 2,
  ideas: 5,
  total: '7',
  ...change,
});

const groupRow = (change: Record<string, unknown> = {}) => ({
  id: OTHER,
  name: 'Friends',
  created_at: '2026-10-01T10:00:00+00:00',
  members: 3,
  ideas: 12,
  done: 4,
  points: 60,
  recent: 9,
  last_active: '2026-11-20T10:00:00+00:00',
  total: 2,
  ...change,
});

describe('count', () => {
  it('reads a number however the database sends it', () => {
    expect(count(12)).toBe(12);
    expect(count('12')).toBe(12);
    expect(count(3.9)).toBe(3);
  });

  it('is zero for anything that is not a count', () => {
    for (const bad of [null, undefined, '', 'many', '1e9', -4, NaN, Infinity, {}, [3], true]) expect(count(bad)).toBe(0);
  });
});

describe('overviewFrom', () => {
  it('reads what the database sends', () => {
    expect(overviewFrom(sent())).toEqual(sent());
  });

  it('fills in zeros for anything missing, so the page never shows a blank', () => {
    const overview = overviewFrom({ totals: { people: 2 } });
    expect(overview?.totals.people).toBe(2);
    expect(overview?.totals.groups).toBe(0);
    expect(overview?.week.new_people).toBe(0);
    expect(overview?.weeks).toEqual([]);
    expect(overview?.funnel).toEqual({ named: 0, in_group: 0, added_idea: 0, did_one: 0 });
    expect(overview?.covers.searched).toBe(0);
    expect(overview?.invited).toBe(0);
  });

  it('leaves out a week that is not one', () => {
    const overview = overviewFrom({ ...sent(), weeks: [{ start: 'last week', people: 3 }, null, 'x', { start: '2026-11-16', people: '4', groups: 1 }] });
    expect(overview?.weeks).toEqual([{ start: '2026-11-16', people: 4, groups: 1 }]);
  });

  it('is nothing for an answer that is not an overview', () => {
    for (const bad of [null, undefined, 'x', 4, [], {}, { totals: 'lots' }]) expect(overviewFrom(bad)).toBeNull();
  });

  it('never passes on anything it was not asked to read', () => {
    const overview = overviewFrom({ ...sent(), totals: { ...sent().totals, secret: 9 }, notes: ['Secret picnic'] });
    expect(JSON.stringify(overview)).not.toMatch(/secret/i);
  });
});

describe('listedFrom and the lists', () => {
  it('reads a page of people, with how many there are in all', async () => {
    const client = fakeClient(async () => ({ data: [personRow(), personRow({ id: OTHER, name: 'Bo', email: null, guest: true, google: false })], error: null }));
    const found = await loadPeople('  ann  ', 50);
    expect(found.total).toBe(7);
    expect(found.rows.map((p) => [p.name, p.email, p.guest, p.google, p.groups, p.ideas])).toEqual([
      ['Ann', 'ann@example.com', false, true, 2, 5],
      ['Bo', null, true, false, 2, 5],
    ]);
    expect(client.rpc).toHaveBeenCalledWith('admin_people', { p_search: 'ann', p_limit: PAGE, p_offset: 50 });
  });

  it('asks for everyone when nothing was typed, from the start', async () => {
    const client = fakeClient(async () => ({ data: [], error: null }));
    expect(await loadPeople('   ')).toEqual({ rows: [], total: 0 });
    expect(client.rpc).toHaveBeenCalledWith('admin_people', { p_search: null, p_limit: PAGE, p_offset: 0 });
  });

  it('reads a page of groups, in the order asked for', async () => {
    const client = fakeClient(async () => ({ data: [groupRow()], error: null }));
    const found = await loadGroups('big', 'fri');
    expect(found).toEqual({ rows: [{ id: OTHER, name: 'Friends', created_at: '2026-10-01T10:00:00+00:00', members: 3, ideas: 12, done: 4, points: 60, recent: 9, last_active: '2026-11-20T10:00:00+00:00' }], total: 2 });
    expect(client.rpc).toHaveBeenCalledWith('admin_groups', { p_sort: 'big', p_search: 'fri', p_limit: PAGE, p_offset: 0 });
  });

  it('leaves out a row with no id, and is never fewer in all than it shows', () => {
    const found = listedFrom([personRow({ total: 0 }), { name: 'Nobody' }, null, 'x'], (row) => (row && typeof row === 'object' && 'id' in row ? row : null));
    expect(found.rows).toHaveLength(1);
    expect(found.total).toBe(1);
    expect(listedFrom('nothing', () => 1)).toEqual({ rows: [], total: 0 });
  });

  it('has a name and dates it can show for a row that is missing them', async () => {
    fakeClient(async () => ({ data: [personRow({ name: '  ', joined: 'soon', last_active: null, color: null })], error: null }));
    const [person] = (await loadPeople('')).rows;
    expect([person.name, person.joined, person.last_active, person.color]).toEqual(['No name', null, null, '']);
  });
});

describe('one person and one group', () => {
  it('reads a person and the groups they are in', async () => {
    const client = fakeClient(async () => ({
      data: {
        ...personRow({ groups: [{ id: OTHER, name: 'Friends', joined: '2026-11-02T10:00:00+00:00', started: true, members: 3 }, { name: 'No id' }] }),
        last_sign_in: '2026-11-19T10:00:00+00:00',
        reactions: 4,
        comments: 2,
        phones: 1,
      },
      error: null,
    }));
    const person = await loadPerson(ID);
    expect(client.rpc).toHaveBeenCalledWith('admin_person', { p_user: ID });
    expect(person?.in).toEqual([{ id: OTHER, name: 'Friends', joined: '2026-11-02T10:00:00+00:00', started: true, members: 3 }]);
    expect([person?.groups, person?.reactions, person?.comments, person?.phones, person?.last_sign_in]).toEqual([1, 4, 2, 1, '2026-11-19T10:00:00+00:00']);
  });

  it('reads a group, its people and its lists', async () => {
    const client = fakeClient(async () => ({
      data: {
        id: OTHER,
        name: 'Friends',
        created_at: '2026-10-01T10:00:00+00:00',
        cover: 'search',
        ideas: 12,
        plans: 2,
        done: 4,
        points: 60,
        reactions: 30,
        comments: 8,
        last_active: null,
        members: [{ id: ID, name: 'Ann', color: '#CFE3FF', guest: false, joined: '2026-10-01T10:00:00+00:00', started: true }, { name: 'No id' }],
        lists: [{ id: 'l1', name: 'Food', ideas: 7 }, null],
      },
      error: null,
    }));
    const group = await loadGroup(OTHER);
    expect(client.rpc).toHaveBeenCalledWith('admin_group', { p_group: OTHER });
    expect(group?.members).toEqual([{ id: ID, name: 'Ann', color: '#CFE3FF', guest: false, joined: '2026-10-01T10:00:00+00:00', started: true }]);
    expect(group?.lists).toEqual([{ id: 'l1', name: 'Food', ideas: 7 }]);
    expect([group?.cover, group?.plans, group?.points, group?.last_active]).toEqual(['search', 2, 60, null]);
  });

  it('is nothing when there is nobody, or no group, with that id', async () => {
    fakeClient(async () => ({ data: null, error: null }));
    expect(await loadPerson(ID)).toBeNull();
    expect(await loadGroup(ID)).toBeNull();
    expect(personDetailFrom('x')).toBeNull();
    expect(groupDetailFrom({ name: 'No id' })).toBeNull();
  });
});

describe('amAdmin', () => {
  it('is true only when the database says so', async () => {
    const client = fakeClient(async () => ({ data: true, error: null }));
    expect(await amAdmin()).toBe(true);
    expect(client.rpc).toHaveBeenCalledWith('is_admin');
  });

  it('is false for anything else, so the page stays shut', async () => {
    for (const data of [false, null, 'true', 1, {}]) {
      fakeClient(async () => ({ data, error: null }));
      expect(await amAdmin()).toBe(false);
    }
    // The update has not been run, or the database refused.
    fakeClient(async () => ({ data: true, error: { message: 'Could not find the function public.is_admin' } }));
    expect(await amAdmin()).toBe(false);
    fakeClient(async () => {
      throw new Error('offline');
    });
    expect(await amAdmin()).toBe(false);
    jest.mocked(db).mockImplementation(() => {
      throw new Error('not set up');
    });
    expect(await amAdmin()).toBe(false);
  });
});

describe('when the database refuses or cannot be reached', () => {
  it('says the same plain thing, whatever went wrong', async () => {
    const asks = [() => loadOverview(), () => loadPeople(''), () => loadGroups('busy', ''), () => loadPerson(ID), () => loadGroup(ID)];
    fakeClient(async () => ({ data: null, error: { message: 'Not allowed', code: '42501' } }));
    for (const ask of asks) await expect(ask()).rejects.toThrow(NOT_LOADED);
    fakeClient(async () => {
      throw new Error('offline');
    });
    for (const ask of asks) await expect(ask()).rejects.toThrow(NOT_LOADED);
  });

  it('says so too when the overview is not an overview', async () => {
    fakeClient(async () => ({ data: 'nothing', error: null }));
    await expect(loadOverview()).rejects.toThrow(NOT_LOADED);
    expect(NOT_LOADED).not.toMatch(/[–—]/);
  });
});

describe('cleanFind and isId', () => {
  it('tidies what was typed', () => {
    expect(cleanFind('  ann   example ')).toBe('ann example');
    expect(cleanFind('   ')).toBeNull();
    expect(cleanFind('x'.repeat(200))).toHaveLength(SEARCH_MAX);
  });

  it('knows an id from anything else in the address', () => {
    expect(isId(ID)).toBe(true);
    for (const bad of [undefined, null, '', 'ann', `${ID}x`, `${ID}/../x`, [ID], 7]) expect(isId(bad)).toBe(false);
  });
});

describe('the words on the page', () => {
  it('gives a share as a percentage', () => {
    expect(share(3, 4)).toBe('75%');
    expect(share(4, 4)).toBe('100%');
    expect(share(0, 4)).toBe('0%');
    expect(share(3, 0)).toBe('0%');
    // More than everything is everything.
    expect(share(9, 4)).toBe('100%');
  });

  it('does not round a little down to nothing, or nearly all up to all', () => {
    expect(share(1, 1000)).toBe('<1%');
    expect(share(999, 1000)).toBe('99%');
  });

  it('sizes a bar against the biggest in its set', () => {
    expect(barWidth(5, 10)).toBe(0.5);
    expect(barWidth(10, 10)).toBe(1);
    expect(barWidth(20, 10)).toBe(1);
    expect(barWidth(0, 10)).toBe(0);
    expect(barWidth(5, 0)).toBe(0);
  });

  it('writes a day and a week', () => {
    expect(dayOf('2026-11-16T12:00:00')).toBe('16 Nov 2026');
    expect(dayOf(null)).toBe('Not known');
    expect(dayOf('soon')).toBe('Not known');
    expect(weekLabel('2026-11-16')).toBe('16 Nov');
    expect(weekLabel('2026-01-05')).toBe('5 Jan');
    expect(weekLabel('whenever')).toBe('whenever');
  });

  it('says how long ago something was', () => {
    const now = new Date('2026-11-21T12:00:00Z');
    const daysBack = (days: number) => new Date(now.getTime() - days * 86400000).toISOString();
    expect(ago(daysBack(0), now)).toBe('Today');
    expect(ago(daysBack(1), now)).toBe('Yesterday');
    expect(ago(daysBack(5), now)).toBe('5 days ago');
    expect(ago(daysBack(21), now)).toBe('3 weeks ago');
    expect(ago(daysBack(90), now)).toBe('3 months ago');
    expect(ago(daysBack(800), now)).toBe('2 years ago');
    expect(ago(null, now)).toBe('Never');
    expect(ago('soon', now)).toBe('Never');
    // A clock that is a little out does not put something in the future.
    expect(ago(daysBack(-1), now)).toBe('Today');
  });

  it('uses the right word after a count', () => {
    expect(countOf(1, 'person', 'people')).toBe('1 person');
    expect(countOf(0, 'person', 'people')).toBe('0 people');
    expect(countOf(3, 'person', 'people')).toBe('3 people');
  });

  it('says how someone signs in, and what a cover is', () => {
    expect(signsInWith({ guest: true, google: false })).toBe('Guest');
    expect(signsInWith({ guest: false, google: true })).toBe('Google');
    expect(signsInWith({ guest: false, google: false })).toBe('Email');
    expect(coverSays('look')).toBe('A three-colour look');
    expect(coverSays('search')).toBe('A photo from search');
    expect(coverSays('something new')).toBe('A classic colour');
  });
});
