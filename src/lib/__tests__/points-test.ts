import {
  answersFor,
  breakdown,
  categoryEmoji,
  levelFor,
  levelLine,
  levelUp,
  myAnswer,
  onShelf,
  POINTS,
  stampsFor,
  TITLES,
  totalPoints,
  type Completion,
  type DoAgainVote,
} from '../points';

let n = 0;
const done = (over: Partial<Completion> = {}): Completion => ({
  id: `c${++n}`,
  idea_id: `i${n}`,
  title: `Idea ${n}`,
  list_name: 'Food',
  done_at: new Date(2026, 10, n).toISOString(),
  waited_days: 3,
  repeat: false,
  first_in_list: false,
  long_wait: false,
  points: 15,
  ...over,
});

describe('titles', () => {
  it('are the eight from the roadmap, in order, starting at zero', () => {
    expect(TITLES.map((t) => t.title)).toEqual(['Homebodies', 'Dabblers', 'Weekenders', 'Go-Getters', 'Thrill Seekers', 'Trailblazers', 'Daredevils', 'Legends']);
    expect(TITLES[0].at).toBe(0);
    for (let i = 1; i < TITLES.length; i++) expect(TITLES[i].at).toBeGreaterThan(TITLES[i - 1].at);
  });

  it('give the first new title within two or three completions', () => {
    // A group's first completion is worth 20; ordinary ones after it are worth 15.
    expect(levelFor(20).title).toBe('Homebodies');
    expect(levelFor(20 + 15).title).toBe('Dabblers');
  });
});

describe('levelFor', () => {
  it('starts everyone as Homebodies', () => {
    expect(levelFor(0)).toEqual({ index: 0, title: 'Homebodies', points: 0, next: TITLES[1], toNext: 30, progress: 0 });
  });

  it('changes title exactly at each threshold', () => {
    for (let i = 1; i < TITLES.length; i++) {
      expect(levelFor(TITLES[i].at - 1).title).toBe(TITLES[i - 1].title);
      expect(levelFor(TITLES[i].at).title).toBe(TITLES[i].title);
    }
  });

  it('says how far there is to go', () => {
    const level = levelFor(90);
    expect(level.title).toBe('Weekenders');
    expect(level.toNext).toBe(40);
    expect(level.progress).toBeCloseTo(20 / 60);
  });

  it('is full, with nothing after it, at the top', () => {
    expect(levelFor(5000)).toMatchObject({ title: 'Legends', next: null, toNext: 0, progress: 1 });
  });

  it('treats nonsense as no points', () => {
    expect(levelFor(-5).points).toBe(0);
    expect(levelFor(Number.NaN).title).toBe('Homebodies');
  });
});

describe('levelLine', () => {
  it('reads like the roadmap\'s example', () => {
    expect(levelLine(levelFor(90))).toBe('Weekenders, 40 points to Go-Getters');
  });

  it('uses the singular for one point', () => {
    expect(levelLine(levelFor(29))).toBe('Homebodies, 1 point to Dabblers');
  });

  it('shows the total at the top', () => {
    expect(levelLine(levelFor(700))).toBe('Legends, 700 points');
  });
});

describe('levelUp', () => {
  it('is the new level when a title was reached', () => {
    expect(levelUp(20, 35)?.title).toBe('Dabblers');
    expect(levelUp(0, 500)?.title).toBe('Daredevils');
  });

  it('is nothing when the title stayed the same, or there is nothing to compare', () => {
    expect(levelUp(35, 50)).toBeNull();
    expect(levelUp(50, 50)).toBeNull();
    expect(levelUp(50, 20)).toBeNull();
  });
});

describe('totalPoints', () => {
  it('adds the completions up', () => {
    expect(totalPoints([done({ points: 20 }), done({ points: 15 }), done({ points: 10 })])).toBe(45);
    expect(totalPoints([])).toBe(0);
  });
});

describe('breakdown', () => {
  it('lists an ordinary completion', () => {
    expect(breakdown(done({ points: 15 }))).toEqual([
      { label: 'Did it together', points: 10 },
      { label: 'Everyone was there', points: 5 },
    ]);
  });

  it('adds the bonuses for a first and a long wait', () => {
    expect(breakdown(done({ points: 30, first_in_list: true, long_wait: true, waited_days: 143, list_name: 'Movies' }))).toEqual([
      { label: 'Did it together', points: 10 },
      { label: 'Everyone was there', points: 5 },
      { label: 'First from Movies', points: 5 },
      { label: 'Waited 143 days', points: 10 },
    ]);
  });

  it('gives a repeat less', () => {
    expect(breakdown(done({ points: 10, repeat: true }))).toEqual([
      { label: 'Did it again', points: 5 },
      { label: 'Everyone was there', points: 5 },
    ]);
  });

  it('always adds up to the points recorded, even if the database counted differently', () => {
    for (const c of [done({ points: 15 }), done({ points: 30, first_in_list: true, long_wait: true }), done({ points: 42 }), done({ points: 7, repeat: true })]) {
      expect(breakdown(c).reduce((sum, line) => sum + line.points, 0)).toBe(c.points);
    }
  });

  it('uses the numbers the database update awards (supabase/tests/you-did-it.test.mjs pins those)', () => {
    expect(POINTS).toEqual({ done: 10, again: 5, everyone: 5, firstInList: 5, longWait: 10 });
  });
});

describe('categoryEmoji', () => {
  it('recognises the starter lists', () => {
    expect(['Movies', 'Places', 'Food', 'Shows', 'Games', 'Trips', 'Day trips'].map(categoryEmoji)).toEqual(['🎬', '📍', '🍜', '📺', '🎲', '✈️', '🚗']);
  });

  it('falls back to the daisy', () => {
    expect(categoryEmoji('Whatever')).toBe('🌼');
    expect(categoryEmoji(null)).toBe('🌼');
  });
});

describe('stampsFor', () => {
  it('gives every completion a stamp for its list, newest first', () => {
    const first = done({ title: 'Picnic', done_at: new Date(2026, 5, 1).toISOString() });
    const second = done({ title: 'Film night', list_name: 'Movies', done_at: new Date(2026, 6, 1).toISOString() });
    const { ordinary, special } = stampsFor([first, second]);
    expect(ordinary.map((s) => [s.emoji, s.title, s.caption])).toEqual([['🎬', 'Film night', 'Movies'], ['🍜', 'Picnic', 'Food']]);
    expect(special).toEqual([]);
  });

  it('marks a repeat', () => {
    expect(stampsFor([done({ repeat: true })]).ordinary[0].caption).toBe('Food, again');
  });

  it('adds a special stamp for the first from each list', () => {
    const { special } = stampsFor([done({ title: 'Picnic', first_in_list: true }), done({ title: 'Tacos' }), done({ title: 'Film night', list_name: 'Movies', first_in_list: true })]);
    expect(special.map((s) => [s.title, s.caption])).toEqual([['First from Movies', 'Film night'], ['First from Food', 'Picnic']]);
    expect(special.every((s) => s.special)).toBe(true);
  });

  it('adds one special stamp for the first thing that waited over 100 days', () => {
    const early = done({ title: 'Balloon ride', waited_days: 250, done_at: new Date(2026, 1, 1).toISOString() });
    const later = done({ title: 'Opera', waited_days: 400, done_at: new Date(2026, 8, 1).toISOString() });
    const short = done({ title: 'Tacos', waited_days: 100, done_at: new Date(2026, 0, 1).toISOString() });
    const { special } = stampsFor([later, early, short]);
    expect(special).toHaveLength(1);
    expect(special[0]).toMatchObject({ title: 'Worth the wait', caption: 'Balloon ride, after 250 days', emoji: '⏳' });
  });

  it('gives an empty page to a group that has done nothing yet', () => {
    expect(stampsFor([])).toEqual({ special: [], ordinary: [] });
  });

  it('gives every stamp its own key', () => {
    const { special, ordinary } = stampsFor([done({ first_in_list: true, waited_days: 200 }), done()]);
    const keys = [...special, ...ordinary].map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('the do-again shelf', () => {
  const members = ['ann', 'bo', 'cy'];
  const vote = (idea: string, user: string, again: boolean): DoAgainVote => ({ idea_id: idea, user_id: user, again });

  it('counts the answers for an idea', () => {
    const votes = [vote('i1', 'ann', true), vote('i1', 'bo', false), vote('i2', 'cy', true)];
    expect(answersFor('i1', members, votes)).toEqual({ yes: 1, no: 1, waiting: 1 });
    expect(answersFor('i3', members, votes)).toEqual({ yes: 0, no: 0, waiting: 3 });
  });

  it('puts an idea on the shelf only when everyone says yes', () => {
    const allYes = members.map((m) => vote('i1', m, true));
    expect(onShelf('i1', members, allYes)).toBe(true);
    expect(onShelf('i1', members, allYes.slice(0, 2))).toBe(false);
    expect(onShelf('i1', members, [...allYes.slice(0, 2), vote('i1', 'cy', false)])).toBe(false);
  });

  it('ignores the answers of people who have left', () => {
    const votes = [vote('i1', 'ann', true), vote('i1', 'bo', true), vote('i1', 'gone', false)];
    expect(onShelf('i1', ['ann', 'bo'], votes)).toBe(true);
    expect(answersFor('i1', ['ann', 'bo'], votes)).toEqual({ yes: 2, no: 0, waiting: 0 });
  });

  it('has nothing on it for a group with no members', () => {
    expect(onShelf('i1', [], [])).toBe(false);
  });

  it('finds this person\'s own answer', () => {
    const votes = [vote('i1', 'ann', true), vote('i1', 'bo', false)];
    expect(myAnswer('i1', 'ann', votes)).toBe(true);
    expect(myAnswer('i1', 'bo', votes)).toBe(false);
    expect(myAnswer('i1', 'cy', votes)).toBeNull();
    expect(myAnswer('i1', null, votes)).toBeNull();
  });
});
