// Points, titles, stamps and the do-again shelf: what a group earns by doing its ideas.
//
// The database works out the points for each completion (supabase/updates/008-you-did-it.sql)
// and they never go down. This file only reads what is recorded: it adds the points up, turns
// the total into a title, and describes each completion as a stamp. Nothing here stores anything.

import { stampLook, type IconName, type StampList } from './looks';

/** One time a group did one of its ideas, as recorded by the database. */
export type Completion = {
  id: string;
  idea_id: string | null;
  title: string;
  /** The list it was on. Null once that list has been removed. */
  list_id?: string | null;
  list_name: string | null;
  done_at: string;
  waited_days: number;
  /** Done before: it came back from the do-again shelf. */
  repeat: boolean;
  /** The first thing the group did from this list. */
  first_in_list: boolean;
  /** Waited more than 90 days. */
  long_wait: boolean;
  points: number;
};

/** What each part of a completion is worth. The database holds the same numbers and has the final say. */
export const POINTS = { done: 10, again: 5, everyone: 5, firstInList: 5, longWait: 10 };

/** The eight titles a group rises through, with the points each starts at. Early ones come quickly. */
export const TITLES: { title: string; at: number }[] = [
  { title: 'Homebodies', at: 0 },
  { title: 'Dabblers', at: 30 },
  { title: 'Weekenders', at: 70 },
  { title: 'Go-Getters', at: 130 },
  { title: 'Thrill Seekers', at: 210 },
  { title: 'Trailblazers', at: 320 },
  { title: 'Daredevils', at: 460 },
  { title: 'Legends', at: 650 },
];

export type Level = {
  /** 0 for Homebodies up to 7 for Legends. */
  index: number;
  title: string;
  points: number;
  /** The title after this one, or null at the top. */
  next: { title: string; at: number } | null;
  /** Points still needed for the next title; 0 at the top. */
  toNext: number;
  /** How far along the bar is between this title and the next, from 0 to 1. Full at the top. */
  progress: number;
};

export function totalPoints(completions: Pick<Completion, 'points'>[]): number {
  return completions.reduce((sum, c) => sum + (Number.isFinite(c.points) ? c.points : 0), 0);
}

export function levelFor(points: number): Level {
  const total = Math.max(0, Math.floor(Number.isFinite(points) ? points : 0));
  let index = 0;
  for (let i = 0; i < TITLES.length; i++) if (total >= TITLES[i].at) index = i;
  const here = TITLES[index];
  const next = TITLES[index + 1] ?? null;
  return {
    index,
    title: here.title,
    points: total,
    next,
    toNext: next ? next.at - total : 0,
    progress: next ? (total - here.at) / (next.at - here.at) : 1,
  };
}

/** The line under a group's name: "Weekenders, 40 points to Go-Getters". */
export function levelLine(level: Level): string {
  if (!level.next) return `${level.title}, ${level.points} points`;
  return `${level.title}, ${level.toNext} ${level.toNext === 1 ? 'point' : 'points'} to ${level.next.title}`;
}

/** The new level, if going from `before` points to `after` reached a higher title. */
export function levelUp(before: number, after: number): Level | null {
  const next = levelFor(after);
  return next.index > levelFor(before).index ? next : null;
}

/** How a completion's points were earned, line by line. The lines add up to its points. */
export function breakdown(c: Completion): { label: string; points: number }[] {
  const lines = [
    c.repeat ? { label: 'Did it again', points: POINTS.again } : { label: 'Did it together', points: POINTS.done },
    { label: 'Everyone was there', points: POINTS.everyone },
  ];
  if (c.first_in_list) lines.push({ label: c.list_name ? `First from ${c.list_name}` : 'First from its list', points: POINTS.firstInList });
  if (c.long_wait) lines.push({ label: `Waited ${c.waited_days} days`, points: POINTS.longWait });
  // If the database ever counts differently, show its total rather than a sum that disagrees.
  const sum = lines.reduce((n, l) => n + l.points, 0);
  return sum === c.points ? lines : [{ label: c.repeat ? 'Did it again' : 'Did it together', points: c.points }];
}

// Each pattern matches from the start of a word, so "Theatre" is not taken for "eat".
const CATEGORY_EMOJI: [RegExp, string][] = [
  [/\b(movie|film|cinema)/i, '🎬'],
  [/\b(show|series|tv\b)/i, '📺'],
  [/\b(food|eat|restaurant|dinner|lunch|brunch|cook)/i, '🍜'],
  [/\b(day trip|drive|road)/i, '🚗'],
  [/\b(trip|travel|holiday|vacation)/i, '✈️'],
  [/\b(place|visit|sight)/i, '📍'],
  [/\b(game|play)/i, '🎲'],
  [/\b(music|concert|gig\b)/i, '🎵'],
  [/\b(book|read)/i, '📚'],
  [/\b(hike|hiking|walk|outdoor|nature|park)/i, '🥾'],
  [/\b(sport|gym\b|run|swim)/i, '⚽'],
  [/\b(drink|bars?\b|coffee|cafe)/i, '☕'],
];

/** A picture for a list, guessed from its name. Lists the app does not recognise get the daisy. */
export function categoryEmoji(listName: string | null | undefined): string {
  const name = listName ?? '';
  return CATEGORY_EMOJI.find(([pattern]) => pattern.test(name))?.[1] ?? '🌼';
}

/** How long an idea has to have waited for its special stamp. */
export const WORTH_THE_WAIT_DAYS = 100;

/** The "Worth the wait" stamp belongs to no list, so it has a colour of its own. */
const WAIT_COLOR = '#5E35B1';

export type Stamp = {
  key: string;
  emoji: string;
  /** The drawn icon on the stamp. */
  icon: IconName;
  /** The stamp's colour: its list's, so a list's stamps match its cards. */
  color: string;
  /** Which list it is for, to count how many lists the group has tried. */
  list: string;
  /** What is written on the stamp. */
  title: string;
  /** The small line under it. */
  caption: string;
  done_at: string;
  /** A stamp for a first, rather than the ordinary one every completion gets. */
  special: boolean;
};

/**
 * A group's passport page. Every completion earns a stamp for its list. On top of those come the
 * special stamps: the first thing done from each list, and the first thing that waited over
 * 100 days. Newest first, within each kind. `lists` are the group's lists in their usual order:
 * each stamp takes the icon and colour its list has today.
 */
export function stampsFor(completions: Completion[], lists: StampList[] = []): { special: Stamp[]; ordinary: Stamp[] } {
  const newestFirst = [...completions].sort((a, b) => new Date(b.done_at).getTime() - new Date(a.done_at).getTime());
  const ordinary = newestFirst.map((c) => ({
    key: c.id,
    emoji: categoryEmoji(c.list_name),
    ...stampLook(c.list_id, c.list_name, lists),
    list: c.list_id ?? (c.list_name ?? '').trim().toLowerCase(),
    title: c.title,
    caption: c.repeat ? `${c.list_name ?? 'Done'}, again` : (c.list_name ?? 'Done'),
    done_at: c.done_at,
    special: false,
  }));
  const special: Stamp[] = newestFirst
    .filter((c) => c.first_in_list)
    .map((c) => ({
      key: `first-${c.id}`,
      emoji: categoryEmoji(c.list_name),
      ...stampLook(c.list_id, c.list_name, lists),
      list: c.list_id ?? (c.list_name ?? '').trim().toLowerCase(),
      title: c.list_name ? `First from ${c.list_name}` : 'A first',
      caption: c.title,
      done_at: c.done_at,
      special: true,
    }));
  const waited = newestFirst.filter((c) => !c.repeat && c.waited_days > WORTH_THE_WAIT_DAYS).at(-1);
  if (waited) {
    special.push({
      key: `wait-${waited.id}`,
      emoji: '⏳',
      icon: 'clock' as IconName,
      color: WAIT_COLOR,
      list: '',
      title: 'Worth the wait',
      caption: `${waited.title}, after ${waited.waited_days} days`,
      done_at: waited.done_at,
      special: true,
    });
  }
  special.sort((a, b) => new Date(b.done_at).getTime() - new Date(a.done_at).getTime());
  return { special, ordinary };
}

/** One person's answer to "would you do it again?" for a done idea. */
export type DoAgainVote = { idea_id: string; user_id: string; again: boolean };

/** The answers the group's current members have given for one idea. People who have left do not count. */
export function answersFor(ideaId: string, memberIds: string[], votes: DoAgainVote[]): { yes: number; no: number; waiting: number } {
  const mine = votes.filter((v) => v.idea_id === ideaId && memberIds.includes(v.user_id));
  const yes = mine.filter((v) => v.again).length;
  return { yes, no: mine.length - yes, waiting: Math.max(0, memberIds.length - mine.length) };
}

/** An idea is on the do-again shelf when every member of the group has said yes. */
export function onShelf(ideaId: string, memberIds: string[], votes: DoAgainVote[]): boolean {
  if (memberIds.length === 0) return false;
  const answers = answersFor(ideaId, memberIds, votes);
  return answers.yes === memberIds.length;
}

/** What this person answered for an idea: true, false, or null if they have not said. */
export function myAnswer(ideaId: string, userId: string | null, votes: DoAgainVote[]): boolean | null {
  return votes.find((v) => v.idea_id === ideaId && v.user_id === userId)?.again ?? null;
}
