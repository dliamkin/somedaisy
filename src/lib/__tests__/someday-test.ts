import { daysWaiting, somedayLabel } from '../someday';

// Dates are built from local parts, so these tests give the same result in any time zone.
// "Now" is Saturday 14 November 2026, 3:30 PM.
const now = new Date(2026, 10, 14, 15, 30);
const at = (...parts: [number, number, number, number?, number?]) => new Date(...parts).toISOString();

describe('daysWaiting', () => {
  it('is zero on the day the idea was added', () => {
    expect(daysWaiting(at(2026, 10, 14, 0, 1), now)).toBe(0);
    expect(daysWaiting(at(2026, 10, 14, 15, 29), now)).toBe(0);
  });

  it('counts calendar days, not 24-hour periods', () => {
    expect(daysWaiting(at(2026, 10, 13, 23, 59), now)).toBe(1);
    expect(daysWaiting(at(2026, 10, 12, 8, 0), now)).toBe(2);
  });

  it('counts across months and years', () => {
    expect(daysWaiting(at(2026, 5, 24, 12, 0), now)).toBe(143);
    expect(daysWaiting(at(2025, 10, 14, 12, 0), now)).toBe(365);
  });

  it('is never negative when an idea seems to come from the future', () => {
    expect(daysWaiting(at(2026, 10, 16, 9, 0), now)).toBe(0);
  });
});

describe('somedayLabel', () => {
  it('says nothing on the first day', () => {
    expect(somedayLabel(at(2026, 10, 14, 9, 0), now)).toBeNull();
  });

  it('uses the singular for one day', () => {
    expect(somedayLabel(at(2026, 10, 13, 9, 0), now)).toBe('Someday for 1 day');
  });

  it('counts the days after that', () => {
    expect(somedayLabel(at(2026, 5, 24, 12, 0), now)).toBe('Someday for 143 days');
  });
});
