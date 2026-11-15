// Helpers for a group's calendar: one month at a time, with the group's plans and the things it
// has done placed on their days. Everything works in the device's own time zone and takes its
// dates as arguments, so it gives the same answer in tests as on a phone.

export const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** A month, as the calendar pages through them. `month` is 0 for January. */
export type Month = { year: number; month: number };

export function monthOf(d: Date): Month {
  return { year: d.getFullYear(), month: d.getMonth() };
}

/** The month `by` months later (or earlier, when negative), rolling over the year as needed. */
export function shiftMonth(m: Month, by: number): Month {
  return monthOf(new Date(m.year, m.month + by, 1));
}

/** "November 2026" */
export function monthLabel(m: Month): string {
  return `${MONTH_NAMES[m.month]} ${m.year}`;
}

/** "Saturday 21 November" */
export function longDayLabel(d: Date): string {
  return `${WEEKDAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
}

/**
 * The month laid out in weeks, Sunday first. Each week has seven places; a place before the
 * 1st or after the last day of the month is null.
 */
export function monthGrid(m: Month): (Date | null)[][] {
  const first = new Date(m.year, m.month, 1);
  const days = new Date(m.year, m.month + 1, 0).getDate();
  const cells: (Date | null)[] = Array.from({ length: first.getDay() }, () => null);
  for (let day = 1; day <= days; day++) cells.push(new Date(m.year, m.month, day));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** A name for a calendar day in the device's time zone, to group things by: "2026-11-21". */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Group things by the local day a date of theirs falls on. Things without that date are left out. */
export function byDay<T>(items: T[], when: (item: T) => string | null | undefined): Record<string, T[]> {
  const days: Record<string, T[]> = {};
  for (const item of items) {
    const iso = when(item);
    if (!iso) continue;
    const key = dayKey(new Date(iso));
    (days[key] ??= []).push(item);
  }
  return days;
}
