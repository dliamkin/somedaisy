import { ALL_ON, formShows, isToDo, optionsLine, optionsOf, sameOptions } from '../list-options';

describe('optionsOf', () => {
  it('turns everything on for a list that says nothing', () => {
    expect(optionsOf({})).toEqual(ALL_ON);
    expect(optionsOf(null)).toEqual(ALL_ON);
    expect(optionsOf(undefined)).toEqual(ALL_ON);
    expect(optionsOf({ dates: null, links: null, notes: null })).toEqual(ALL_ON);
  });

  it('keeps what a list has turned off', () => {
    expect(optionsOf({ dates: false, links: true, notes: false })).toEqual({ dates: false, links: true, notes: false });
    expect(optionsOf({ links: false })).toEqual({ dates: true, links: false, notes: true });
  });
});

describe('sameOptions', () => {
  it('compares all three', () => {
    expect(sameOptions(ALL_ON, { dates: true, links: true, notes: true })).toBe(true);
    expect(sameOptions(ALL_ON, { ...ALL_ON, dates: false })).toBe(false);
    expect(sameOptions(ALL_ON, { ...ALL_ON, links: false })).toBe(false);
    expect(sameOptions(ALL_ON, { ...ALL_ON, notes: false })).toBe(false);
  });
});

describe('formShows', () => {
  const empty = { link: false, note: false };

  it('shows every box for an ordinary list', () => {
    expect(formShows({}, empty)).toEqual({ link: true, note: true, tags: true, countMeIn: true });
  });

  it('leaves out what the list has turned off', () => {
    expect(formShows({ dates: false, links: false, notes: false }, empty)).toEqual({ link: false, note: false, tags: false, countMeIn: false });
    expect(formShows({ notes: false }, empty)).toEqual({ link: true, note: false, tags: true, countMeIn: true });
  });

  it('still shows a box that has something in it', () => {
    const nameOnly = { dates: false, links: false, notes: false };
    expect(formShows(nameOnly, { link: true, note: false })).toEqual({ link: true, note: false, tags: false, countMeIn: false });
    expect(formShows(nameOnly, { link: false, note: true })).toEqual({ link: false, note: true, tags: false, countMeIn: false });
  });

  it('shows the tags only where ideas can have dates', () => {
    expect(formShows({ dates: false }, empty).tags).toBe(false);
    expect(formShows({ dates: true }, empty).tags).toBe(true);
  });

  it('offers "Count me in" only where ideas can have dates', () => {
    expect(formShows({ dates: false }, empty).countMeIn).toBe(false);
    expect(formShows({ dates: true, links: false, notes: false }, empty).countMeIn).toBe(true);
  });
});

describe('isToDo', () => {
  it('is true for an idea on a list that gives dates, and on a list that says nothing', () => {
    expect(isToDo({ dates: true }, null)).toBe(true);
    expect(isToDo({}, null)).toBe(true);
    expect(isToDo(null)).toBe(true);
  });

  it('is false for an idea that is only kept, such as a name for a band', () => {
    expect(isToDo({ dates: false }, null)).toBe(false);
    expect(isToDo({ dates: false, links: true, notes: true })).toBe(false);
  });

  it('stays true for an idea that already has a date, even after its list stopped giving them', () => {
    expect(isToDo({ dates: false }, '2026-11-20T21:30:00Z')).toBe(true);
  });
});

describe('optionsLine', () => {
  it('names what is on', () => {
    expect(optionsLine(ALL_ON)).toBe('Dates, links, notes');
    expect(optionsLine({ dates: false, links: true, notes: false })).toBe('Links');
    expect(optionsLine({ dates: false, links: false, notes: false })).toBe('Name only');
  });
});
