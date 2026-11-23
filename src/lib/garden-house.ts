// Inside the house in the garden: a hallway where every finished idea hangs in a frame. This file
// decides which frames hang on which wall, and the words that go with them. The hallway itself is
// drawn in src/garden/hallway.ts.
//
// The rule for the walls is the design handoff's (design_handoff_garden_a_v2/README.md), built to
// look right with three finished ideas and to stay usable with three hundred:
//   1. Every finished idea gets one frame. Nothing is hidden or dropped.
//   2. A wall holds up to twelve frames and covers whole calendar months.
//   3. Quiet months share a wall, for as long as the total stays at twelve or fewer.
//   4. A month with more than twelve runs on to a second wall.
//   5. Walls are filled from the oldest month forward, so only the newest wall ever changes.

import { WALL, type Memory } from '../garden/plan';
import type { DoneIdea, List } from './data';
import { shortName } from './garden';
import { lookFor } from './looks';
import { pictureAddress } from './pictures';

/** A finished idea as the house needs it. */
export type Finished = {
  id: string;
  title: string;
  /** The name of its list. */
  list: string;
  /** Its list's colour. */
  color: string;
  /** The web address of the idea's own picture, if the group gave it one. */
  picture: string | null;
  /** The day it was done, in the device's own time, as "2026-11-23". */
  day: string;
};

/** One wall of the hallway: what it is called, and what hangs on it, oldest first. */
export type HouseWall = { label: string; items: Finished[] };

const two = (n: number) => String(n).padStart(2, '0');

/** A moment as the day it falls on here, as "2026-11-23". */
export function localDay(when: Date): string {
  return `${when.getFullYear()}-${two(when.getMonth() + 1)}-${two(when.getDate())}`;
}

/**
 * The group's finished ideas as the house needs them, oldest first. Only a picture the group
 * added itself goes in a frame: a photo found by search has to carry its credit wherever it
 * shows, which a small frame cannot, and a link's preview is not the group's own. `base` is where
 * pictures are kept, which only a test needs to say.
 */
export function finishedIdeas(done: DoneIdea[], lists: List[], base?: string): Finished[] {
  return [...done]
    .sort((a, b) => a.done_at.localeCompare(b.done_at) || a.id.localeCompare(b.id))
    .map((idea) => {
      const place = lists.findIndex((l) => l.id === idea.list_id);
      const list = place === -1 ? null : lists[place];
      return {
        id: idea.id,
        title: idea.title,
        list: list?.name ?? '',
        color: lookFor(list, Math.max(0, place)).color,
        picture: pictureAddress(idea.picture, base),
        day: localDay(new Date(idea.done_at)),
      };
    });
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * What a wall is called, from the first and the last month on it (each as "2026-11"): one month
 * reads "November 2026", several in one year "Jul – Oct 2026", and a span across New Year
 * "Dec 2025 – Feb 2026". `part` is for a busy month that runs over several walls: "1 of 2".
 */
export function wallLabel(first: string, last: string, part?: string): string {
  const [y1, m1] = [first.slice(0, 4), Number(first.slice(5, 7)) - 1];
  const [y2, m2] = [last.slice(0, 4), Number(last.slice(5, 7)) - 1];
  if (first === last) return `${MONTHS_FULL[m1]} ${y1}${part ? ` · ${part}` : ''}`;
  if (y1 === y2) return `${MONTHS[m1]} – ${MONTHS[m2]} ${y2}`;
  return `${MONTHS[m1]} ${y1} – ${MONTHS[m2]} ${y2}`;
}

/** Hangs the finished ideas on walls, oldest wall first, by the rule at the top of this file. `list` must be oldest first. */
export function buildWalls(list: Finished[]): HouseWall[] {
  // First by calendar month.
  const months: { month: string; items: Finished[] }[] = [];
  for (const idea of list) {
    const month = idea.day.slice(0, 7);
    const last = months[months.length - 1];
    if (last && last.month === month) last.items.push(idea);
    else months.push({ month, items: [idea] });
  }
  // Then months onto walls.
  const walls: { months: string[]; items: Finished[]; part?: string }[] = [];
  let open: { months: string[]; items: Finished[] } | null = null;
  for (const { month, items } of months) {
    if (items.length > WALL) {
      // A busy month has walls to itself, and nothing shares its last one.
      open = null;
      const parts = Math.ceil(items.length / WALL);
      for (let i = 0; i < parts; i++) walls.push({ months: [month], items: items.slice(i * WALL, i * WALL + WALL), part: `${i + 1} of ${parts}` });
    } else if (open && open.items.length + items.length <= WALL) {
      open.months.push(month);
      open.items.push(...items);
    } else {
      open = { months: [month], items: [...items] };
      walls.push(open);
    }
  }
  return walls.map((wall) => ({ label: wallLabel(wall.months[0], wall.months[wall.months.length - 1], wall.part), items: wall.items }));
}

/** The walls as the hallway is told them: only what a frame shows. */
export function toMemories(walls: HouseWall[]): Memory[][] {
  return walls.map((wall) => wall.items.map((idea) => ({ title: idea.title, short: shortName(idea.title), color: idea.color, picture: idea.picture })));
}

/** A day as the house writes it: "Nov 7" this year, and "Nov 7, 2025" in any other. */
export function dayWords(day: string, now: Date): string {
  const words = `${MONTHS[Number(day.slice(5, 7)) - 1]} ${Number(day.slice(8, 10))}`;
  return day.slice(0, 4) === String(now.getFullYear()) ? words : `${words}, ${day.slice(0, 4)}`;
}

/** The line under a finished idea's name: "Day trips · Nov 7". */
export function finishedLine(idea: Pick<Finished, 'list' | 'day'>, now: Date): string {
  return idea.list ? `${idea.list} · ${dayWords(idea.day, now)}` : dayWords(idea.day, now);
}

/** "1 thing", "3 things". */
export function thingsWords(count: number): string {
  return count === 1 ? '1 thing' : `${count} things`;
}

/**
 * The two lines on the bar under a wall. With a frame chosen, its idea and when it was done. With
 * none, what the wall is called and what is on it. With nothing finished at all, an invitation.
 */
export function wallCaption(walls: HouseWall[], wall: number, frame: number | null, now: Date): { title: string; line: string } {
  const here = walls[wall];
  if (!here) return { title: 'Nothing here yet', line: 'Finish an idea and it hangs here' };
  const chosen = frame !== null ? here.items[frame] : undefined;
  if (chosen) return { title: chosen.title, line: finishedLine(chosen, now) };
  return { title: here.label, line: walls.length > 1 ? `${thingsWords(here.items.length)} · wall ${wall + 1} of ${walls.length}` : thingsWords(here.items.length) };
}

/** Where a finished idea hangs: which wall, and which place on it. Null if it is not on any. */
export function whereHung(walls: HouseWall[], ideaId: string): { wall: number; frame: number } | null {
  for (let wall = 0; wall < walls.length; wall++) {
    const frame = walls[wall].items.findIndex((idea) => idea.id === ideaId);
    if (frame !== -1) return { wall, frame };
  }
  return null;
}
