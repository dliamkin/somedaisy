// Date helpers for plans. A plan is an idea with a date (`planned_for`).
// Everything here works in the device's own time zone and takes `now` as an argument,
// so it gives the same answer in tests as on a phone.

export type TimeSlot = { key: string; label: string; hour: number; minute: number };

export const TIME_SLOTS: TimeSlot[] = [
  { key: 'morning', label: 'Morning', hour: 10, minute: 0 },
  { key: 'lunch', label: 'Lunch', hour: 12, minute: 30 },
  { key: 'afternoon', label: 'Afternoon', hour: 15, minute: 0 },
  { key: 'evening', label: 'Evening', hour: 19, minute: 0 },
  { key: 'night', label: 'Late', hour: 21, minute: 0 },
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Whole days from `now`'s date to `day`'s date: 0 is today, 1 tomorrow, -1 yesterday. */
export function daysFromToday(day: Date, now: Date): number {
  // Rounding absorbs the hour gained or lost when a clock change falls in between.
  return Math.round((startOfDay(day).getTime() - startOfDay(now).getTime()) / 86400000);
}

/** The days a plan can be set for: today and the days after it, each at midnight. */
export function dayOptions(now: Date, count = 21): Date[] {
  return Array.from({ length: count }, (_, i) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + i));
}

/** "Today", "Tomorrow", "Yesterday", or a short date like "Sat 21 Nov" (with the year if it is not this year). */
export function dayLabel(day: Date, now: Date): string {
  const diff = daysFromToday(day, now);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  const base = `${WEEKDAYS[day.getDay()]} ${day.getDate()} ${MONTHS[day.getMonth()]}`;
  return day.getFullYear() === now.getFullYear() ? base : `${base} ${day.getFullYear()}`;
}

/** "7 PM", "12:30 PM", "12 AM". */
export function timeLabel(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'AM' : 'PM'}`;
}

/** How a plan's date is shown everywhere: "Tomorrow, 7 PM" or "Sat 21 Nov, 7 PM". */
export function formatPlan(iso: string, now: Date): string {
  const d = new Date(iso);
  return `${dayLabel(d, now)}, ${timeLabel(d)}`;
}

/** The moment a day and a time of day add up to. */
export function combine(day: Date, slot: TimeSlot): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), slot.hour, slot.minute);
}

/** The time slot an existing plan falls on, if it was set to one of them. */
export function slotOf(d: Date): TimeSlot | null {
  return TIME_SLOTS.find((s) => s.hour === d.getHours() && s.minute === d.getMinutes()) ?? null;
}

export function isPast(iso: string, now: Date): boolean {
  return new Date(iso).getTime() < now.getTime();
}

/** The ideas that have a date, soonest first. */
export function plannedIdeas<I extends { planned_for: string | null }>(ideas: I[]): (I & { planned_for: string })[] {
  return ideas
    .filter((i): i is I & { planned_for: string } => Boolean(i.planned_for))
    .sort((a, b) => new Date(a.planned_for).getTime() - new Date(b.planned_for).getTime());
}
