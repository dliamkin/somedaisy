import {
  atTime,
  combine,
  dayLabel,
  dayOptions,
  daysFromToday,
  formatPlan,
  isPast,
  minutesLabel,
  minutesOf,
  plannedIdeas,
  shiftTime,
  slotFor,
  slotMinutes,
  slotOf,
  TIME_SLOTS,
  timeLabel,
} from '../plans';

// Dates are built from local parts (year, month index, day, hour, minute), so these tests
// give the same result in any time zone. "Now" is Saturday 14 November 2026, 3:30 PM.
const now = new Date(2026, 10, 14, 15, 30);
const slot = (key: string) => TIME_SLOTS.find((s) => s.key === key)!;

describe('picking an exact time', () => {
  it('turns a time into minutes after midnight and back into a moment', () => {
    expect(minutesOf(new Date(2026, 10, 14, 19, 0))).toBe(1140);
    expect(slotMinutes(slot('lunch'))).toBe(750);
    expect(atTime(new Date(2026, 10, 21), 11 * 60 + 30)).toEqual(new Date(2026, 10, 21, 11, 30));
  });

  it('labels a time', () => {
    expect(minutesLabel(11 * 60 + 30)).toBe('11:30 AM');
    expect(minutesLabel(19 * 60)).toBe('7 PM');
    expect(minutesLabel(0)).toBe('12 AM');
  });

  it('moves a quarter of an hour at a time', () => {
    expect(shiftTime(750, -1)).toBe(735);
    expect(shiftTime(750, 1)).toBe(765);
    expect(shiftTime(750, -4)).toBe(690);
  });

  it('lands on a quarter hour from a time that is not on one', () => {
    expect(shiftTime(752, 1)).toBe(765);
    expect(shiftTime(752, -1)).toBe(750);
  });

  it('stays within the day', () => {
    expect(shiftTime(0, -1)).toBe(0);
    expect(shiftTime(10, -1)).toBe(0);
    expect(shiftTime(23 * 60 + 45, 1)).toBe(23 * 60 + 45);
    expect(shiftTime(23 * 60 + 50, 1)).toBe(23 * 60 + 45);
  });

  it('knows which part of the day a time is in, whatever the minute', () => {
    expect(slotFor(8 * 60).key).toBe('morning');
    expect(slotFor(11 * 60 + 15).key).toBe('morning');
    expect(slotFor(11 * 60 + 30).key).toBe('lunch');
    expect(slotFor(13 * 60 + 45).key).toBe('lunch');
    expect(slotFor(14 * 60).key).toBe('afternoon');
    expect(slotFor(17 * 60).key).toBe('evening');
    expect(slotFor(20 * 60 + 30).key).toBe('night');
    expect(slotFor(2 * 60).key).toBe('night');
  });

  it('puts each shortcut in its own part of the day', () => {
    for (const s of TIME_SLOTS) expect(slotFor(slotMinutes(s)).key).toBe(s.key);
  });
});

describe('dayOptions', () => {
  it('starts today at midnight and runs forward one day at a time', () => {
    const days = dayOptions(now, 3);
    expect(days).toEqual([new Date(2026, 10, 14), new Date(2026, 10, 15), new Date(2026, 10, 16)]);
  });

  it('offers three weeks by default and rolls over the end of the month', () => {
    const days = dayOptions(now);
    expect(days).toHaveLength(21);
    expect(days[20]).toEqual(new Date(2026, 11, 4));
  });
});

describe('daysFromToday', () => {
  it('counts calendar days, not 24-hour periods', () => {
    expect(daysFromToday(new Date(2026, 10, 14, 23, 59), now)).toBe(0);
    expect(daysFromToday(new Date(2026, 10, 15, 0, 1), now)).toBe(1);
    expect(daysFromToday(new Date(2026, 10, 13, 23, 0), now)).toBe(-1);
  });

  it('is not thrown off by a clock change in between', () => {
    // Clocks change in late March and early November in many time zones.
    expect(daysFromToday(new Date(2026, 3, 5), new Date(2026, 2, 5, 12))).toBe(31);
    expect(daysFromToday(new Date(2026, 10, 5), new Date(2026, 9, 5, 12))).toBe(31);
  });
});

describe('dayLabel', () => {
  it('names today, tomorrow and yesterday', () => {
    expect(dayLabel(new Date(2026, 10, 14), now)).toBe('Today');
    expect(dayLabel(new Date(2026, 10, 15), now)).toBe('Tomorrow');
    expect(dayLabel(new Date(2026, 10, 13), now)).toBe('Yesterday');
  });

  it('gives other days a short date', () => {
    expect(dayLabel(new Date(2026, 10, 21), now)).toBe('Sat 21 Nov');
    expect(dayLabel(new Date(2026, 10, 2), now)).toBe('Mon 2 Nov');
  });

  it('adds the year when it is not this year', () => {
    expect(dayLabel(new Date(2027, 0, 9), now)).toBe('Sat 9 Jan 2027');
  });
});

describe('timeLabel', () => {
  it('uses a 12-hour clock and leaves out :00', () => {
    expect(timeLabel(new Date(2026, 10, 14, 19, 0))).toBe('7 PM');
    expect(timeLabel(new Date(2026, 10, 14, 12, 30))).toBe('12:30 PM');
    expect(timeLabel(new Date(2026, 10, 14, 0, 5))).toBe('12:05 AM');
    expect(timeLabel(new Date(2026, 10, 14, 10, 0))).toBe('10 AM');
  });
});

describe('combine / slotOf / formatPlan', () => {
  it('puts a time of day onto a day', () => {
    expect(combine(new Date(2026, 10, 21), slot('evening'))).toEqual(new Date(2026, 10, 21, 19, 0));
    expect(combine(new Date(2026, 10, 21), slot('lunch'))).toEqual(new Date(2026, 10, 21, 12, 30));
  });

  it('finds the slot of a plan again, so changing a plan starts from its current time', () => {
    for (const s of TIME_SLOTS) {
      expect(slotOf(combine(new Date(2026, 10, 21), s))).toBe(s);
    }
    expect(slotOf(new Date(2026, 10, 21, 8, 15))).toBeNull();
  });

  it('formats a saved plan the way the app shows it', () => {
    const saved = (d: Date) => d.toISOString();
    expect(formatPlan(saved(combine(new Date(2026, 10, 15), slot('evening'))), now)).toBe('Tomorrow, 7 PM');
    expect(formatPlan(saved(combine(new Date(2026, 10, 21), slot('lunch'))), now)).toBe('Sat 21 Nov, 12:30 PM');
  });
});

describe('isPast', () => {
  it('is true only for a moment before now', () => {
    expect(isPast(new Date(2026, 10, 14, 15, 29).toISOString(), now)).toBe(true);
    expect(isPast(new Date(2026, 10, 14, 15, 31).toISOString(), now)).toBe(false);
  });
});

describe('plannedIdeas', () => {
  it('keeps only ideas with a date, soonest first', () => {
    const at = (day: number) => new Date(2026, 10, day, 19, 0).toISOString();
    const ideas = [
      { id: 'later', planned_for: at(28) },
      { id: 'no-date', planned_for: null },
      { id: 'sooner', planned_for: at(16) },
      { id: 'overdue', planned_for: at(10) },
    ];
    expect(plannedIdeas(ideas).map((i) => i.id)).toEqual(['overdue', 'sooner', 'later']);
  });

  it('does not reorder the list it was given', () => {
    const ideas = [
      { id: 'b', planned_for: new Date(2026, 10, 20).toISOString() },
      { id: 'a', planned_for: new Date(2026, 10, 15).toISOString() },
    ];
    plannedIdeas(ideas);
    expect(ideas.map((i) => i.id)).toEqual(['b', 'a']);
  });
});
