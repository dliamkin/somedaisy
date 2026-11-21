import { alike, plainName, similarIdeas } from '../similar';

const idea = (id: string, title: string) => ({ id, title, list_id: 'l1' });

describe('plainName', () => {
  it('drops capitals, accents, punctuation and extra spaces', () => {
    expect(plainName('  Café   Río! ')).toBe('cafe rio');
    expect(plainName('Dune: Part Two')).toBe('dune part two');
    expect(plainName('Rock’n’Roll — night')).toBe('rock n roll night');
  });

  it('keeps letters that are not Latin', () => {
    expect(plainName('Суши бар')).toBe('суши бар');
  });
});

describe('alike', () => {
  it('says the same name is the same, however it is written', () => {
    expect(alike('mini golf', 'Mini Golf!')).toBe(0);
  });

  it('finds a name that starts the way the typed one does', () => {
    expect(alike('mini g', 'Mini golf')).toBe(1);
    expect(alike('Dun', 'Dune: Part Two')).toBe(1);
  });

  it('finds the same words in another order, with the last one half typed', () => {
    expect(alike('dune two', 'Dune: Part Two')).toBe(2);
    expect(alike('golf mi', 'Mini golf')).toBe(2);
  });

  it('finds a short name inside a longer one being typed', () => {
    expect(alike('Dune in IMAX', 'Dune')).toBe(2);
  });

  it('leaves small words out of it', () => {
    expect(alike('go to the beach', 'Beach')).toBe(2);
    expect(alike('the beach', 'Beach walk')).toBe(2);
  });

  it('waits for three letters', () => {
    expect(alike('du', 'Dune')).toBeNull();
    expect(alike('', 'Dune')).toBeNull();
  });

  it('does not match on part of a word in the middle', () => {
    expect(alike('golf', 'Minigolfing')).toBeNull();
    expect(alike('mini putt', 'Mini golf')).toBeNull();
    expect(alike('tacos', 'Beach walk')).toBeNull();
  });
});

describe('similarIdeas', () => {
  const ideas = [idea('1', 'Beach walk'), idea('2', 'Dune: Part Two'), idea('3', 'Dune'), idea('4', 'Sand dune hike'), idea('5', 'Dune buggy')];

  it('gives the closest first, then the order they came in', () => {
    expect(similarIdeas('dune', ideas, 5).map((i) => i.id)).toEqual(['3', '2', '5', '4']);
  });

  it('gives no more than asked for', () => {
    expect(similarIdeas('dune', ideas, 2).map((i) => i.id)).toEqual(['3', '2']);
  });

  it('gives nothing when nothing is alike, or too little is typed', () => {
    expect(similarIdeas('tacos', ideas)).toEqual([]);
    expect(similarIdeas('d', ideas)).toEqual([]);
  });
});
