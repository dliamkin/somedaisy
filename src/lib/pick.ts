// "Pick for us": when the group is free and cannot decide, the app picks one of the ideas
// everyone has already said yes to. Two optional tags on an idea (how long it takes, and
// staying in or going out) let the pick match the time the group has. They need
// supabase/updates/014-idea-tags.sql; without it no idea has tags and nothing is left out.
// Nothing here stores anything.

import type { Idea, Member, Reaction } from './data';

export type Takes = 'short' | 'medium' | 'long';
export type Setting = 'in' | 'out';

/** The lengths in order, shortest first, with the words shown for each. */
export const TAKES: { value: Takes; label: string }[] = [
  { value: 'short', label: 'An hour or so' },
  { value: 'medium', label: 'A few hours' },
  { value: 'long', label: 'Most of a day' },
];

export const SETTINGS: { value: Setting; label: string }[] = [
  { value: 'in', label: 'Staying in' },
  { value: 'out', label: 'Going out' },
];

export function isTakes(value: unknown): value is Takes {
  return TAKES.some((t) => t.value === value);
}

export function isSetting(value: unknown): value is Setting {
  return SETTINGS.some((s) => s.value === value);
}

/** An idea's tags in words, for a line on a card: "A few hours · Going out". Empty when it has none. */
export function tagLine(idea: Pick<Idea, 'takes' | 'setting'>): string {
  const parts = [TAKES.find((t) => t.value === idea.takes)?.label, SETTINGS.find((s) => s.value === idea.setting)?.label];
  return parts.filter(Boolean).join(' · ');
}

export type PickFilter = {
  /** The time the group has. Ideas that take longer are left out. Null for any. */
  time: Takes | null;
  /** Staying in or going out. Null for either. */
  setting: Setting | null;
  /** Only this list. Null for every list. */
  listId: string | null;
  /** Also ideas not everyone has answered yet, as long as nobody said no. */
  undecided: boolean;
};

export const ANY: PickFilter = { time: null, setting: null, listId: null, undecided: false };

/**
 * Whether the group has said yes to an idea. Everyone gave it a thumbs up; or, with `undecided`,
 * at least one person did and nobody gave a thumbs down. In a group of one, their own thumbs up.
 */
export function approved(ideaId: string, members: Member[], reactions: Reaction[], undecided: boolean): boolean {
  const here = new Set(members.map((m) => m.user_id));
  const mine = reactions.filter((r) => r.idea_id === ideaId && here.has(r.user_id));
  const ups = new Set(mine.filter((r) => r.emoji === '👍').map((r) => r.user_id));
  if (ups.size === 0) return false;
  if (undecided) return !mine.some((r) => r.emoji === '👎');
  return members.every((m) => ups.has(m.user_id));
}

/**
 * The ideas to pick among: approved, with no date yet, and fitting what was asked for. An idea
 * with no tag for something is never left out because of it. With a time chosen, ideas that
 * take that long or less are in.
 */
export function pickPool(group: { ideas: Idea[]; members: Member[]; reactions: Reaction[] }, filter: PickFilter): Idea[] {
  const order = TAKES.map((t) => t.value);
  const limit = filter.time ? order.indexOf(filter.time) : order.length - 1;
  return group.ideas.filter((idea) => {
    if (idea.planned_for) return false;
    if (filter.listId && idea.list_id !== filter.listId) return false;
    if (isTakes(idea.takes) && order.indexOf(idea.takes) > limit) return false;
    if (filter.setting && isSetting(idea.setting) && idea.setting !== filter.setting) return false;
    return approved(idea.id, group.members, group.reactions, filter.undecided);
  });
}

/**
 * One idea from the pool, by chance. `last` is the idea picked the time before: it is not picked
 * twice in a row while there is anything else. `random` gives a number from 0 up to 1.
 */
export function pickOne(pool: Idea[], last: string | null = null, random: () => number = Math.random): Idea | null {
  const others = pool.length > 1 ? pool.filter((i) => i.id !== last) : pool;
  if (others.length === 0) return null;
  return others[Math.min(others.length - 1, Math.floor(random() * others.length))];
}
