import type { DoneIdea, List } from '../data';
import {
  buildWalls,
  cardFile,
  creditWords,
  dayWords,
  finishedIdeas,
  finishedLine,
  localDay,
  sharedLine,
  sharedWords,
  sourceWords,
  thingsWords,
  toMemories,
  toMemory,
  wallCaption,
  wallLabel,
  whereHung,
  type Finished,
} from '../garden-house';

const NOW = new Date(2026, 10, 23, 12);

let made = 0;
/** `count` finished ideas on days of one month, such as "2026-11". */
const month = (ym: string, count: number): Finished[] =>
  Array.from({ length: count }, (_, i) => ({ id: `idea-${made++}`, title: `Thing ${made}`, list: 'Food', color: '#E0489E', picture: null, source: null, credit: null, kept: null, day: `${ym}-${String(1 + (i % 28)).padStart(2, '0')}` }));

describe('hanging the walls', () => {
  it('hangs nothing when nothing is done', () => {
    expect(buildWalls([])).toEqual([]);
  });

  it('gives every finished idea one frame, and drops none', () => {
    const list = [...month('2026-08', 1), ...month('2026-09', 1), ...month('2026-10', 1)];
    const walls = buildWalls(list);
    expect(walls).toHaveLength(1);
    expect(walls[0].items).toEqual(list);
    const many = [...month('2024-01', 30), ...month('2024-02', 7), ...month('2024-03', 13), ...month('2024-05', 2)];
    expect(buildWalls(many).flatMap((w) => w.items)).toEqual(many);
  });

  it('lets quiet months share a wall, for as long as it holds twelve or fewer', () => {
    const walls = buildWalls([...month('2026-07', 3), ...month('2026-08', 4), ...month('2026-09', 5), ...month('2026-10', 1)]);
    expect(walls.map((w) => [w.label, w.items.length])).toEqual([
      ['Jul – Sep 2026', 12],
      ['October 2026', 1],
    ]);
  });

  it('never splits a month of twelve or fewer across two walls', () => {
    const walls = buildWalls([...month('2026-07', 8), ...month('2026-08', 8)]);
    expect(walls.map((w) => [w.label, w.items.length])).toEqual([
      ['July 2026', 8],
      ['August 2026', 8],
    ]);
  });

  it('runs a busy month on to more walls, and lets nothing share them', () => {
    const walls = buildWalls([...month('2026-09', 2), ...month('2026-10', 15), ...month('2026-11', 2)]);
    expect(walls.map((w) => [w.label, w.items.length])).toEqual([
      ['September 2026', 2],
      ['October 2026 · 1 of 2', 12],
      ['October 2026 · 2 of 2', 3],
      ['November 2026', 2],
    ]);
  });

  it('fills walls from the oldest month forward, so finishing something only changes the newest wall', () => {
    const before = [...month('2025-12', 6), ...month('2026-01', 5), ...month('2026-02', 4), ...month('2026-11', 3)];
    const after = [...before, ...month('2026-11', 1)];
    const was = buildWalls(before);
    const is = buildWalls(after);
    expect(is.slice(0, -1)).toEqual(was.slice(0, -1));
    expect(is[is.length - 1].items).toHaveLength(was[was.length - 1].items.length + 1);
  });

  it('handles hundreds without a wall ever holding more than twelve', () => {
    const list: Finished[] = [];
    const per = [6, 9, 4, 13, 7, 15, 10, 8, 5, 12, 9, 3];
    for (let year = 2023; year <= 2026; year++) for (let m = 0; m < 12; m++) list.push(...month(`${year}-${String(m + 1).padStart(2, '0')}`, per[(m + year * 5) % 12]));
    const walls = buildWalls(list);
    expect(list.length).toBeGreaterThan(300);
    expect(walls.every((w) => w.items.length >= 1 && w.items.length <= 12)).toBe(true);
    expect(walls.flatMap((w) => w.items)).toEqual(list);
  });
});

describe('what a wall is called', () => {
  it('names one month in full', () => {
    expect(wallLabel('2026-11', '2026-11')).toBe('November 2026');
    expect(wallLabel('2026-11', '2026-11', '1 of 2')).toBe('November 2026 · 1 of 2');
  });

  it('names a span in one year, and a span across New Year', () => {
    expect(wallLabel('2026-07', '2026-10')).toBe('Jul – Oct 2026');
    expect(wallLabel('2025-12', '2026-02')).toBe('Dec 2025 – Feb 2026');
  });
});

describe('the words under a wall', () => {
  const walls = buildWalls([...month('2026-09', 12), ...month('2026-11', 1)]);

  it('says what the wall is and where it stands among the others', () => {
    expect(wallCaption(walls, 0, null, NOW)).toEqual({ title: 'September 2026', line: '12 things · wall 1 of 2' });
    expect(wallCaption(walls, 1, null, NOW)).toEqual({ title: 'November 2026', line: '1 thing · wall 2 of 2' });
  });

  it('leaves the count of walls out when there is only one', () => {
    expect(wallCaption(buildWalls(month('2026-11', 3)), 0, null, NOW).line).toBe('3 things');
  });

  it('says which idea a chosen frame holds, and when it was done', () => {
    const idea = walls[1].items[0];
    expect(wallCaption(walls, 1, 0, NOW)).toEqual({ title: idea.title, line: `Food · ${dayWords(idea.day, NOW)}` });
  });

  it('invites a group that has done nothing yet', () => {
    expect(wallCaption([], 0, null, NOW)).toEqual({ title: 'Nothing here yet', line: 'Finish an idea and it hangs here' });
  });

  it('writes a day without its year only in the current year', () => {
    expect(dayWords('2026-11-07', NOW)).toBe('Nov 7');
    expect(dayWords('2025-11-07', NOW)).toBe('Nov 7, 2025');
    expect(finishedLine({ list: 'Day trips', day: '2026-01-02' }, NOW)).toBe('Day trips · Jan 2');
    expect(finishedLine({ list: '', day: '2026-01-02' }, NOW)).toBe('Jan 2');
    expect(thingsWords(1)).toBe('1 thing');
    expect(thingsWords(0)).toBe('0 things');
  });

  it('finds the wall and the place an idea hangs in', () => {
    const idea = walls[0].items[4];
    expect(whereHung(walls, idea.id)).toEqual({ wall: 0, frame: 4 });
    expect(whereHung(walls, 'gone')).toBeNull();
  });
});

describe("a finished idea's card", () => {
  const credit = { url: 'https://images.unsplash.com/photo-1', credit: 'Photo by Ann Lee on Unsplash', creditUrl: 'https://unsplash.com/@ann' };

  it('says where its picture is from', () => {
    expect(sourceWords({ source: 'own', credit: null }, true)).toBe('Your photo');
    expect(sourceWords({ source: 'link', credit: null }, true)).toBe('Photo from the link');
    expect(sourceWords({ source: 'found', credit }, true)).toBe('Photo by Ann Lee on Unsplash');
    expect(sourceWords({ source: null, credit: null }, false)).toBe('Pressed flower');
  });

  it('says it shows the pressed flower when the picture could not be loaded', () => {
    expect(sourceWords({ source: 'link', credit: null }, false)).toBe('Pressed flower');
    expect(sourceWords({ source: 'found', credit }, false)).toBe('Pressed flower');
  });

  it('credits a photo found by search on the picture it shares, and nothing else', () => {
    expect(creditWords(credit)).toBe('Photo by Ann Lee on Unsplash');
    expect(creditWords({ ...credit, credit: 'Ann Lee / Unsplash' })).toBe('Ann Lee / Unsplash');
    expect(creditWords(null)).toBeNull();
  });

  it('writes the group, the list and the day under the title on the shared picture', () => {
    expect(sharedLine('Weekend crew', { list: 'Day trips', day: '2026-11-07' }, NOW)).toBe('Weekend crew · Day trips · Nov 7');
    expect(sharedLine('Weekend crew', { list: '', day: '2025-11-07' }, NOW)).toBe('Weekend crew · Nov 7, 2025');
    expect(sharedWords('Mini golf', 'Weekend crew')).toBe('Mini golf, with Weekend crew');
  });

  it('names the file after the idea', () => {
    expect(cardFile('Mini golf')).toBe('somedaisy-mini-golf.jpg');
    expect(cardFile("  Ramen at Tom's!  ")).toBe('somedaisy-ramen-at-tom-s.jpg');
    expect(cardFile('寿司')).toBe('somedaisy-memory.jpg');
    expect(cardFile('a'.repeat(200))).toBe(`somedaisy-${'a'.repeat(60)}.jpg`);
  });
});

describe('finished ideas as the house needs them', () => {
  const lists: List[] = [
    { id: 'l1', name: 'Movies', position: 0, color: '#7B3FE4' },
    { id: 'l2', name: 'Food', position: 1, color: '#E0489E' },
  ];
  const idea = (id: string, done_at: string, more: Partial<DoneIdea> = {}): DoneIdea => ({ id, list_id: 'l2', title: `Idea ${id}`, link: null, note: null, added_by: null, planned_for: null, created_at: '2026-01-01T00:00:00Z', done_at, ...more });
  const GROUP = '11111111-2222-3333-4444-555555555555';
  const FILE = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

  it('puts them oldest first, whatever order they came in', () => {
    const list = finishedIdeas([idea('b', '2026-11-20T12:00:00Z'), idea('a', '2026-08-30T12:00:00Z'), idea('c', '2026-11-20T12:00:00Z')], lists);
    expect(list.map((f) => f.id)).toEqual(['a', 'b', 'c']);
  });

  it('takes the list name and colour, and the day in the device\'s own time', () => {
    const when = new Date(2026, 10, 7, 23, 30);
    const [one] = finishedIdeas([idea('a', when.toISOString())], lists);
    expect(one).toMatchObject({ list: 'Food', color: '#E0489E', day: '2026-11-07', picture: null });
    expect(localDay(when)).toBe('2026-11-07');
  });

  const BASE = 'https://example.supabase.co';
  const PHOTO = { url: 'https://images.unsplash.com/photo-1', credit: 'Photo by Ann Lee on Unsplash', creditUrl: 'https://unsplash.com/@ann' };
  const LINKED = { link: 'https://example.com', image_url: 'https://example.com/a.jpg' };

  it("frames the group's own picture, and remembers where it is kept", () => {
    const [own] = finishedIdeas([idea('a', '2026-11-07T12:00:00Z', { picture: `${GROUP}/${FILE}.jpg` })], lists, BASE);
    expect(own.picture).toMatch(new RegExp(`/storage/v1/object/public/idea-pictures/${GROUP}/${FILE}[.]jpg$`));
    expect(own).toMatchObject({ source: 'own', credit: null, kept: `${GROUP}/${FILE}.jpg` });
  });

  it('frames a photo found by search, with who to credit', () => {
    const [found] = finishedIdeas([idea('b', '2026-11-07T12:00:00Z', { photo: PHOTO })], lists, BASE);
    expect(found).toMatchObject({ picture: PHOTO.url, source: 'found', credit: PHOTO, kept: null });
  });

  it("frames the picture of the page the idea links to, when it has no other", () => {
    const [linked] = finishedIdeas([idea('c', '2026-11-07T12:00:00Z', LINKED)], lists, BASE);
    expect(linked).toMatchObject({ picture: LINKED.image_url, source: 'link', credit: null, kept: null });
  });

  it("frames what the idea's card showed when it has more than one: its own, then the found photo, then the link's", () => {
    const all = { picture: `${GROUP}/${FILE}.jpg`, photo: PHOTO, ...LINKED };
    expect(finishedIdeas([idea('a', '2026-11-07T12:00:00Z', all)], lists, BASE)[0]).toMatchObject({ source: 'own', credit: null });
    expect(finishedIdeas([idea('a', '2026-11-07T12:00:00Z', { photo: PHOTO, ...LINKED })], lists, BASE)[0]).toMatchObject({ picture: PHOTO.url, source: 'found' });
  });

  it('has no picture to frame when the idea has none, or only one that cannot be shown', () => {
    expect(finishedIdeas([idea('a', '2026-11-07T12:00:00Z')], lists, BASE)[0]).toMatchObject({ picture: null, source: null, credit: null, kept: null });
    // A link's picture is only shown from a secure address.
    expect(finishedIdeas([idea('a', '2026-11-07T12:00:00Z', { link: 'https://example.com', image_url: 'http://example.com/a.jpg' })], lists, BASE)[0]).toMatchObject({ picture: null, source: null });
  });

  it('tells the hallway only what a frame shows', () => {
    const walls = buildWalls(finishedIdeas([idea('a', '2026-11-07T12:00:00Z', { title: 'A very long name for a thing we once did together' })], lists));
    expect(toMemories(walls)).toEqual([[{ title: 'A very long name for a thing we once did together', short: 'A very long name…', color: '#E0489E', picture: null }]]);
    // One frame's worth is the same, with its picture when it has one.
    const [found] = finishedIdeas([idea('b', '2026-11-07T12:00:00Z', { photo: PHOTO })], lists, BASE);
    expect(toMemory(found)).toEqual({ title: 'Idea b', short: 'Idea b', color: '#E0489E', picture: PHOTO.url });
  });
});
