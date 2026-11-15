import { byDay, dayKey, longDayLabel, monthGrid, monthLabel, monthOf, shiftMonth } from '../calendar';

// Dates are built from local parts, so these tests give the same result in any time zone.
const iso = (...parts: [number, number, number, number?, number?]) => new Date(...parts).toISOString();

describe('monthOf and shiftMonth', () => {
  it('reads the month a date is in', () => {
    expect(monthOf(new Date(2026, 10, 14, 15, 30))).toEqual({ year: 2026, month: 10 });
  });

  it('moves forward and back, across the end of the year', () => {
    expect(shiftMonth({ year: 2026, month: 10 }, 1)).toEqual({ year: 2026, month: 11 });
    expect(shiftMonth({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 });
    expect(shiftMonth({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 });
    expect(shiftMonth({ year: 2026, month: 10 }, -14)).toEqual({ year: 2025, month: 8 });
  });
});

describe('labels', () => {
  it('names a month', () => {
    expect(monthLabel({ year: 2026, month: 10 })).toBe('November 2026');
  });

  it('names a day in full', () => {
    expect(longDayLabel(new Date(2026, 10, 21))).toBe('Saturday 21 November');
  });
});

describe('monthGrid', () => {
  it('lays November 2026 out in weeks, Sunday first', () => {
    const weeks = monthGrid({ year: 2026, month: 10 });
    // 1 November 2026 is a Sunday, and the month has 30 days.
    expect(weeks).toHaveLength(5);
    expect(weeks[0][0]).toEqual(new Date(2026, 10, 1));
    expect(weeks[4][1]).toEqual(new Date(2026, 10, 30));
    expect(weeks[4].slice(2)).toEqual([null, null, null, null, null]);
  });

  it('leaves the places before the 1st empty', () => {
    // 1 December 2026 is a Tuesday.
    const [first] = monthGrid({ year: 2026, month: 11 });
    expect(first.slice(0, 2)).toEqual([null, null]);
    expect(first[2]).toEqual(new Date(2026, 11, 1));
  });

  it('always has seven places in a week and every day of the month once', () => {
    for (let month = 0; month < 12; month++) {
      const weeks = monthGrid({ year: 2028, month });
      expect(weeks.every((week) => week.length === 7)).toBe(true);
      const days = weeks.flat().filter((d): d is Date => d !== null).map((d) => d.getDate());
      expect(days).toEqual(Array.from({ length: new Date(2028, month + 1, 0).getDate() }, (_, i) => i + 1));
    }
  });

  it('gives a leap February 29 days and needs six weeks for a long month starting late in the week', () => {
    expect(monthGrid({ year: 2028, month: 1 }).flat().filter(Boolean)).toHaveLength(29);
    // August 2026 starts on a Saturday and has 31 days.
    expect(monthGrid({ year: 2026, month: 7 })).toHaveLength(6);
  });
});

describe('dayKey and byDay', () => {
  it('names a day with its year, month and day', () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(dayKey(new Date(2026, 10, 21, 0, 0))).toBe('2026-11-21');
  });

  it('groups things by the local day their date falls on', () => {
    const plans = [
      { id: 'a', planned_for: iso(2026, 10, 21, 19, 0) },
      { id: 'b', planned_for: iso(2026, 10, 21, 10, 0) },
      { id: 'c', planned_for: iso(2026, 10, 22, 0, 30) },
      { id: 'd', planned_for: null },
    ];
    const days = byDay(plans, (p) => p.planned_for);
    expect(Object.keys(days).sort()).toEqual(['2026-11-21', '2026-11-22']);
    expect(days['2026-11-21'].map((p) => p.id)).toEqual(['a', 'b']);
    expect(days['2026-11-22'].map((p) => p.id)).toEqual(['c']);
  });

  it('gives nothing for an empty list', () => {
    expect(byDay([], () => null)).toEqual({});
  });
});
