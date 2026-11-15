// The someday clock: how long an idea has been waiting to become a plan.
// It counts from the day the idea was added, and takes `now` as an argument so it gives the
// same answer in tests as on a phone.

import { daysFromToday } from './plans';

/** Whole calendar days since the idea was added. Never negative, even if a phone's clock is off. */
export function daysWaiting(createdAt: string, now: Date): number {
  return Math.max(0, -daysFromToday(new Date(createdAt), now));
}

/** "Someday for 143 days", or null on the day the idea was added, when it has not waited yet. */
export function somedayLabel(createdAt: string, now: Date): string | null {
  const days = daysWaiting(createdAt, now);
  if (days === 0) return null;
  return days === 1 ? 'Someday for 1 day' : `Someday for ${days} days`;
}
