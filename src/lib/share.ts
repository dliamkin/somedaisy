// The words on a shareable idea card: the picture of an idea made for a group chat or a story.
// This file only decides what the card says. Drawing it is `src/components/share-card.tsx`,
// and turning it into a picture and handing it to the phone is `src/lib/share-picture.ts`.

import { dayLabel, formatPlan, isPast } from './plans';
import { somedayLabel } from './someday';

export type ShareWords = {
  /** Which moment the card is for: something done, a plan still to come, or an idea waiting. */
  kind: 'done' | 'plan' | 'someday';
  /** The small line across the top, in capitals. */
  kicker: string;
  /** The line in the pill under the idea's name: the date, or how long it has waited. Null for none. */
  line: string | null;
};

type Shareable = { planned_for: string | null; created_at: string; done_at?: string | null };

/**
 * What a card says about an idea. Done wins over planned. A plan whose date has gone by without
 * being marked as done is treated as an idea still waiting, not announced as something to come.
 */
export function shareWords(idea: Shareable, now: Date): ShareWords {
  if (idea.done_at) {
    const when = dayLabel(new Date(idea.done_at), now);
    return { kind: 'done', kicker: 'WE DID IT!', line: when === 'Today' || when === 'Yesterday' ? `Done ${when.toLowerCase()}` : `Done ${when}` };
  }
  if (idea.planned_for && !isPast(idea.planned_for, now)) {
    return { kind: 'plan', kicker: "WE'RE FINALLY DOING THIS", line: formatPlan(idea.planned_for, now) };
  }
  return { kind: 'someday', kicker: "WHO'S IN?", line: somedayLabel(idea.created_at, now) };
}

/** A plain file name for the picture, from the idea's name: "somedaisy-sunrise-beach-walk". */
export function shareFileName(title: string): string {
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');
  return words ? `somedaisy-${words}` : 'somedaisy-idea';
}
