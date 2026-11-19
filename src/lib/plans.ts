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

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
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

/** How far the − and + beside the time move it. */
export const TIME_STEP = 15;
const LAST_TIME = 24 * 60 - TIME_STEP;

/** A time of day as minutes after midnight: 7 PM is 1140. */
export function minutesOf(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

/** The time a slot stands for, as minutes after midnight. */
export function slotMinutes(slot: TimeSlot): number {
  return slot.hour * 60 + slot.minute;
}

/** The moment a day and a time of day (minutes after midnight) add up to. */
export function atTime(day: Date, minutes: number): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(minutes / 60), minutes % 60);
}

/** "11:30 AM" for a time given as minutes after midnight. */
export function minutesLabel(minutes: number): string {
  return timeLabel(new Date(2000, 0, 1, Math.floor(minutes / 60), minutes % 60));
}

/**
 * Move a time earlier or later by `steps` quarter hours, landing on a quarter hour and staying
 * within the same day (12 AM to 11:45 PM).
 */
export function shiftTime(minutes: number, steps: number): number {
  const snapped = steps > 0 ? Math.floor(minutes / TIME_STEP) * TIME_STEP : Math.ceil(minutes / TIME_STEP) * TIME_STEP;
  return Math.min(LAST_TIME, Math.max(0, snapped + steps * TIME_STEP));
}

/**
 * The part of the day a time falls in, whatever the exact minute: 11:30 AM is still "Lunch".
 * The small hours count as "Late".
 */
export function slotFor(minutes: number): TimeSlot {
  const key =
    minutes < 5 * 60 ? 'night' : minutes < 11 * 60 + 30 ? 'morning' : minutes < 14 * 60 ? 'lunch' : minutes < 17 * 60 ? 'afternoon' : minutes < 20 * 60 + 30 ? 'evening' : 'night';
  return TIME_SLOTS.find((s) => s.key === key) ?? TIME_SLOTS[0];
}

/** The time slot an existing plan falls on, if it was set to one of them. */
export function slotOf(d: Date): TimeSlot | null {
  return TIME_SLOTS.find((s) => s.hour === d.getHours() && s.minute === d.getMinutes()) ?? null;
}

/**
 * How long until a plan starts, for the pill on its card: "in 3 days" when it is more than a day
 * away, "in 2 h 19 m" under a day, "in 19 m" under an hour. Null once the start time has come.
 */
export function countdown(iso: string, now: Date): string | null {
  const start = new Date(iso);
  // Rounded up, so the last minute reads "in 1 m" and the pill changes exactly at the start time.
  const minutes = Math.ceil((start.getTime() - now.getTime()) / 60000);
  if (minutes <= 0) return null;
  if (minutes >= 24 * 60) {
    const days = Math.max(1, daysFromToday(start, now));
    return `in ${days} ${days === 1 ? 'day' : 'days'}`;
  }
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `in ${m} m`;
  return m === 0 ? `in ${h} h` : `in ${h} h ${m} m`;
}

export function isPast(iso: string, now: Date): boolean {
  return new Date(iso).getTime() < now.getTime();
}

/**
 * The plan to name as the group's next one: the soonest that is still to come. Failing that, the
 * latest one whose time has passed without being marked as done. Null when nothing has a date.
 */
export function nextPlan<I extends { planned_for: string | null }>(ideas: I[], now: Date): (I & { planned_for: string }) | null {
  const plans = plannedIdeas(ideas);
  return plans.find((p) => !isPast(p.planned_for, now)) ?? plans[plans.length - 1] ?? null;
}

/** A plan in a few words, for a group's card on Home: "Mini golf, today 7 PM" or "Ramen night, Sat 21 Nov 7 PM". */
export function nextPlanLine(title: string, iso: string, now: Date): string {
  const d = new Date(iso);
  const day = dayLabel(d, now);
  // "Today", "Tomorrow" and "Yesterday" come mid-sentence here, so they lose their capital.
  const near = Math.abs(daysFromToday(d, now)) <= 1;
  return `${title}, ${near ? day.toLowerCase() : day} ${timeLabel(d)}`;
}

/** The ideas that have a date, soonest first. */
export function plannedIdeas<I extends { planned_for: string | null }>(ideas: I[]): (I & { planned_for: string })[] {
  return ideas
    .filter((i): i is I & { planned_for: string } => Boolean(i.planned_for))
    .sort((a, b) => new Date(a.planned_for).getTime() - new Date(b.planned_for).getTime());
}
