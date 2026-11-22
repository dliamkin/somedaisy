import { FIND_FROM, findIdeas, findWords, foundLine, type Findable } from '../search';

const lists = [
  { id: 'films', name: 'Movies' },
  { id: 'food', name: 'Places to eat' },
];

const idea = (id: string, title: string, more: Partial<Findable> = {}): Findable => ({ id, list_id: 'films', title, link: null, note: null, takes: null, setting: null, ...more });

const ideas: Findable[] = [
  idea('dune', 'Dune: Part Two', { note: 'In IMAX if we can', link: 'https://www.imdb.com/title/tt15239678/?ref_=nv_sr_1' }),
  idea('pizza', 'Pizza night', { list_id: 'food', note: 'The place Ann found', takes: 'short', setting: 'in' }),
  idea('cafe', 'Café Río', { list_id: 'food', setting: 'out' }),
  idea('heat', 'Heat', { note: 'Pizza first' }),
];

const found = (typed: string, among = ideas) => findIdeas(typed, among, lists).map((i) => i.id);

describe('findWords', () => {
  it('makes what was typed plain: small letters, no accents, no punctuation', () => {
    expect(findWords('  Café,  RÍO! ')).toEqual(['cafe', 'rio']);
  });

  it('is empty until enough has been typed', () => {
    expect(FIND_FROM).toBe(2);
    expect(findWords('')).toEqual([]);
    expect(findWords('   ')).toEqual([]);
    expect(findWords('d')).toEqual([]);
    expect(findWords('!?')).toEqual([]);
    expect(findWords('du')).toEqual(['du']);
    // Two single letters are two letters.
    expect(findWords('a b')).toEqual(['a', 'b']);
  });
});

describe('findIdeas', () => {
  it('gives every idea back, in the order given, when too little has been typed', () => {
    expect(found('')).toEqual(['dune', 'pizza', 'cafe', 'heat']);
    expect(found('d')).toEqual(['dune', 'pizza', 'cafe', 'heat']);
  });

  it('finds an idea by part of its name, whatever the capitals', () => {
    expect(found('dun')).toEqual(['dune']);
    expect(found('NIGHT')).toEqual(['pizza']);
    expect(found('izz')).toEqual(['pizza', 'heat']);
  });

  it('finds a name whatever its accents and punctuation', () => {
    expect(found('cafe rio')).toEqual(['cafe']);
    expect(found('dune part two')).toEqual(['dune']);
    expect(found('Dune: Part')).toEqual(['dune']);
  });

  it('wants every typed word, in any order', () => {
    expect(found('two dune')).toEqual(['dune']);
    expect(found('dune three')).toEqual([]);
  });

  it('looks in notes too, and puts ideas found by their name first', () => {
    expect(found('pizza')).toEqual(['pizza', 'heat']);
    expect(found('imax')).toEqual(['dune']);
    // Words can be spread over the name and the note.
    expect(found('heat pizza')).toEqual(['heat']);
  });

  it('looks in links by their site and what follows, not by "https" or "www"', () => {
    expect(found('imdb')).toEqual(['dune']);
    expect(found('tt15239678')).toEqual(['dune']);
    expect(found('https')).toEqual([]);
    expect(found('www')).toEqual([]);
    // What comes after the "?" is for the site, not for people.
    expect(found('ref')).toEqual([]);
  });

  it('looks in tags by the words shown for them', () => {
    expect(found('staying in')).toEqual(['pizza']);
    expect(found('going out')).toEqual(['cafe']);
    expect(found('hour')).toEqual(['pizza']);
  });

  it("looks in the name of each idea's list", () => {
    expect(found('movies')).toEqual(['dune', 'heat']);
    expect(found('eat cafe')).toEqual(['cafe']);
  });

  it('only looks among the ideas it is given', () => {
    expect(found('pizza', ideas.filter((i) => i.list_id === 'films'))).toEqual(['heat']);
  });

  it('copes with an idea whose list is gone, and with missing tags', () => {
    const lost = [{ id: 'x', list_id: 'gone', title: 'Kayaking', link: null, note: null }];
    expect(findIdeas('kayak', lost, lists).map((i) => i.id)).toEqual(['x']);
    expect(findIdeas('movies', lost, lists)).toEqual([]);
  });

  it('never changes the list it was given', () => {
    const before = [...ideas];
    found('pizza');
    expect(ideas).toEqual(before);
    expect(findIdeas('', ideas, lists)).not.toBe(ideas);
  });
});

describe('foundLine', () => {
  it('says how many were found', () => {
    expect(foundLine(1)).toBe('1 idea found');
    expect(foundLine(12)).toBe('12 ideas found');
  });
});
