import { shareFileName, shareWords } from '../share';

const now = new Date(2026, 10, 17, 12, 0);
const iso = (y: number, m: number, d: number, h = 19) => new Date(y, m, d, h, 0).toISOString();
const base = { planned_for: null, created_at: iso(2026, 10, 17, 9) };

describe('shareWords', () => {
  it('announces a plan that is still to come, with its date', () => {
    expect(shareWords({ ...base, planned_for: iso(2026, 10, 21) }, now)).toEqual({ kind: 'plan', kicker: "WE'RE FINALLY DOING THIS", line: 'Sat 21 Nov, 7 PM' });
    expect(shareWords({ ...base, planned_for: iso(2026, 10, 18) }, now).line).toBe('Tomorrow, 7 PM');
  });

  it('says a done idea is done, and when', () => {
    expect(shareWords({ ...base, done_at: iso(2026, 10, 14) }, now)).toEqual({ kind: 'done', kicker: 'WE DID IT!', line: 'Done Sat 14 Nov' });
    expect(shareWords({ ...base, done_at: iso(2026, 10, 17, 8) }, now).line).toBe('Done today');
    expect(shareWords({ ...base, done_at: iso(2026, 10, 16) }, now).line).toBe('Done yesterday');
  });

  it('puts done before planned', () => {
    expect(shareWords({ ...base, planned_for: iso(2026, 10, 21), done_at: iso(2026, 10, 16) }, now).kind).toBe('done');
  });

  it('asks who is in for an idea with no date, with how long it has waited', () => {
    expect(shareWords({ ...base, created_at: iso(2026, 5, 27) }, now)).toEqual({ kind: 'someday', kicker: "WHO'S IN?", line: 'Someday for 143 days' });
  });

  it('says an idea added today is on the someday list, so the card is never bare', () => {
    expect(shareWords(base, now).line).toBe('On our someday list');
  });

  it('does not announce a plan whose date has gone by', () => {
    expect(shareWords({ ...base, created_at: iso(2026, 10, 1), planned_for: iso(2026, 10, 10) }, now).kind).toBe('someday');
  });
});

describe('shareFileName', () => {
  it('makes a plain name from the idea', () => {
    expect(shareFileName('Sunrise beach walk')).toBe('somedaisy-sunrise-beach-walk');
    expect(shareFileName("  Ramen & a double feature!  ")).toBe('somedaisy-ramen-a-double-feature');
  });

  it('keeps it short and never ends on a dash', () => {
    const name = shareFileName('A very long idea name that goes on and on - and on and on and on');
    expect(name.length).toBeLessThanOrEqual(50);
    expect(name.endsWith('-')).toBe(false);
  });

  it('falls back when nothing usable is left', () => {
    expect(shareFileName('🎬🍿')).toBe('somedaisy-idea');
    expect(shareFileName('')).toBe('somedaisy-idea');
  });
});
