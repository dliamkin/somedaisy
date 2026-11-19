import { ALL_ON, formShows, isToDo, kindOf, NAME_ONLY, optionsLine, optionsOf, sameOptions, withKind } from '../list-options';

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

describe('kindOf', () => {
  it('is things to do when the list gives dates, and just a list when it does not', () => {
    expect(kindOf(ALL_ON)).toBe('todo');
    expect(kindOf({ dates: true, links: false, notes: false })).toBe('todo');
    expect(kindOf(NAME_ONLY)).toBe('keep');
    expect(kindOf({ dates: false, links: true, notes: true })).toBe('keep');
  });
});

describe('withKind', () => {
  it('sets all three for a list that is being made', () => {
    expect(withKind(ALL_ON, 'keep', true)).toEqual(NAME_ONLY);
    expect(withKind(NAME_ONLY, 'todo', true)).toEqual(ALL_ON);
    // Whatever was switched by hand before goes back to what the kind usually wants.
    expect(withKind({ dates: false, links: true, notes: false }, 'todo', true)).toEqual(ALL_ON);
  });

  it('changes only the dates for a list that already exists', () => {
    expect(withKind(ALL_ON, 'keep', false)).toEqual({ dates: false, links: true, notes: true });
    expect(withKind({ dates: false, links: true, notes: false }, 'todo', false)).toEqual({ dates: true, links: true, notes: false });
  });

  it('changes nothing when the kind is the one it already is', () => {
    const keptLink = { dates: false, links: true, notes: false };
    expect(withKind(keptLink, 'keep', true)).toBe(keptLink);
    expect(withKind(keptLink, 'keep', false)).toBe(keptLink);
    const noNote = { dates: true, links: true, notes: false };
    expect(withKind(noNote, 'todo', true)).toBe(noNote);
  });
});

describe('optionsLine', () => {
  it('names what is on', () => {
    expect(optionsLine(ALL_ON)).toBe('Dates, links, notes');
    expect(optionsLine({ dates: false, links: true, notes: false })).toBe('Links');
    expect(optionsLine({ dates: false, links: false, notes: false })).toBe('Name only');
  });
});
