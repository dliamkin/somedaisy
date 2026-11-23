// The garden view of a group: what each idea looks like as a flower, and the words on the sheet
// that opens when one is tapped. The picture itself is drawn in src/garden; this file only turns
// a group's ideas, votes and dates into what that picture is told, so it can be tested.
//
// The garden sits beside the list view and replaces nothing. It shows things to go and do. Ideas
// that are only kept on a list, such as names for a band, have nothing to plan and stay in the list.

import type { TimeOfDay } from '../garden/palette';
import { BED, MAX_LEAVES, type Flower, type Stage, type Vote } from '../garden/plan';
import type { GroupData, Idea, Member, Reaction } from './data';
import { isToDo } from './list-options';
import { lookFor } from './looks';
import { formatPlan } from './plans';
import { levelFor } from './points';
import { daysWaiting, somedayLabel } from './someday';

export { BED, MAX_LEAVES };
export type { Flower, Stage, Vote };

/** One person's answer on an idea. "I'm in" is the thumbs up and "Eh" the thumbs down, as on the idea's card. */
export function voteOf(ideaId: string, userId: string, reactions: Reaction[]): Vote {
  let vote: Vote = 0;
  for (const r of reactions) {
    if (r.idea_id !== ideaId || r.user_id !== userId) continue;
    if (r.emoji === '👍') return 1;
    if (r.emoji === '👎') vote = 2;
  }
  return vote;
}

/**
 * How far an idea has come: a date makes it planned (4), every member being in makes it a full
 * bloom (3), any answer at all makes it a half-open cup (2), and with none it is a bud (1).
 * Someone alone in a group is "everyone", so their own "I'm in" brings an idea into bloom.
 * Answers from people who have since left the group do not count.
 */
export function stageOf(idea: Pick<Idea, 'id' | 'planned_for'>, members: Member[], reactions: Reaction[]): Stage {
  if (idea.planned_for) return 4;
  const votes = members.map((m) => voteOf(idea.id, m.user_id, reactions));
  if (votes.length > 0 && votes.every((v) => v === 1)) return 3;
  return votes.some((v) => v !== 0) ? 2 : 1;
}

/**
 * The members who each get a leaf on every flower: all of them, up to six. In a bigger group it
 * is the six who have been in it longest, with the person looking always among them. `members`
 * must be in the order they joined.
 */
export function leafMembers(members: Member[], userId: string | null): Member[] {
  if (members.length <= MAX_LEAVES) return members;
  const first = members.slice(0, MAX_LEAVES);
  const me = members.find((m) => m.user_id === userId);
  if (!me || first.includes(me)) return first;
  return [...first.slice(0, MAX_LEAVES - 1), me];
}

/** The ideas that grow in the garden: things to go and do, newest first. */
export function gardenIdeas(group: Pick<GroupData, 'ideas' | 'lists'>): Idea[] {
  return group.ideas
    .filter((idea) => isToDo(group.lists.find((l) => l.id === idea.list_id), idea.planned_for))
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id));
}

/** How many beds it takes to show this many flowers. There is always one, even when it is empty. */
export function bedCount(flowers: number): number {
  return Math.max(1, Math.ceil(flowers / BED));
}

/** The flowers in one bed, counting from 0. A bed that is not there any more gives the last one. */
export function bedOf<T>(all: T[], bed: number): T[] {
  const at = Math.min(Math.max(0, bed), bedCount(all.length) - 1);
  return all.slice(at * BED, at * BED + BED);
}

/** A name short enough for the tag over a flower. A long one is cut at a space where it can be. */
export function shortName(title: string, most = 18): string {
  const name = title.trim().replace(/\s+/g, ' ');
  const letters = [...name];
  if (letters.length <= most) return name;
  const cut = letters.slice(0, most).join('');
  // Back to the end of the last whole word, unless the cut fell there anyway or that would leave very little.
  const space = cut.lastIndexOf(' ');
  const whole = letters[most] === ' ' || space < most / 2 ? cut : cut.slice(0, space);
  return `${whole.replace(/[\s.,:;!?-]+$/, '')}…`;
}

/** One idea as the garden is told it. `leaves` are the members with a leaf, in order (see `leafMembers`). */
export function toFlower(idea: Idea, group: Pick<GroupData, 'lists' | 'members' | 'reactions'>, leaves: Member[]): Flower {
  const place = group.lists.findIndex((l) => l.id === idea.list_id);
  return {
    id: idea.id,
    title: idea.title,
    short: shortName(idea.title),
    color: lookFor(place === -1 ? null : group.lists[place], Math.max(0, place)).color,
    stage: stageOf(idea, group.members, group.reactions),
    votes: leaves.map((m) => voteOf(idea.id, m.user_id, group.reactions)),
    day: idea.planned_for ? String(new Date(idea.planned_for).getDate()) : null,
  };
}

/** What the four count pills at the top are called. */
export const STAGE_NAMES: Record<Stage, string> = { 1: 'New', 2: 'Waiting', 3: "Everyone's in", 4: 'Planned' };

/** How many flowers are at each stage. */
export function stageCounts(flowers: Pick<Flower, 'stage'>[]): Record<Stage, number> {
  const counts: Record<Stage, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const f of flowers) counts[f.stage] += 1;
  return counts;
}

/** A few names as a sentence reads them: "Sam", "Sam, Alex", or "Sam, Alex, Jo and 2 more". */
function nameList(names: string[], most = 3): string {
  if (names.length <= most) return names.join(', ');
  return `${names.slice(0, most).join(', ')} and ${names.length - most} more`;
}

/**
 * The line under an idea's name on its sheet: who added it, who it is waiting on, that everyone
 * is in, or when it is planned for. Until it has a date, how long it has waited comes after.
 */
export function sheetLine(idea: Pick<Idea, 'id' | 'added_by' | 'planned_for' | 'created_at'>, members: Member[], reactions: Reaction[], userId: string, now: Date): string {
  const stage = stageOf(idea, members, reactions);
  if (stage === 4 && idea.planned_for) return formatPlan(idea.planned_for, now);
  const nameOf = (id: string | null) => (id === userId ? 'you' : (members.find((m) => m.user_id === id)?.name ?? 'someone'));
  let line: string;
  if (stage === 1) {
    line = `Added by ${nameOf(idea.added_by)}${daysWaiting(idea.created_at, now) === 0 ? ' today' : ''}`;
  } else if (stage === 2) {
    const waiting = members.filter((m) => voteOf(idea.id, m.user_id, reactions) === 0).map((m) => nameOf(m.user_id));
    line = waiting.length ? `Waiting on ${nameList(waiting)}` : 'Not everyone is in yet';
  } else {
    line = members.length === 1 ? "You're in" : members.length === 2 ? 'Both in' : "Everyone's in";
  }
  const clock = somedayLabel(idea.created_at, now);
  return clock ? `${line} · ${clock}` : line;
}

/** What is said beside a member's name on the sheet. */
export function voteWords(vote: Vote): string {
  return vote === 1 ? "I'm in" : vote === 2 ? 'Eh' : "hasn't voted";
}

/** The answers counted up, for a group too big to name everyone on the sheet: "4 in · 1 eh · 3 yet to vote". */
export function tallyWords(votes: Vote[]): string {
  const count = (vote: Vote) => votes.filter((v) => v === vote).length;
  const parts = [count(1) ? `${count(1)} in` : null, count(2) ? `${count(2)} eh` : null, count(0) ? `${count(0)} yet to vote` : null];
  return parts.filter(Boolean).join(' · ');
}

/**
 * The group's reactions as they will be once this person's answer is saved, so the flower can
 * answer the tap at once. "I'm in" and "Eh" replace each other, as they do in the database.
 */
export function withVote(reactions: Reaction[], ideaId: string, userId: string, vote: 1 | 2): Reaction[] {
  const others = reactions.filter((r) => !(r.idea_id === ideaId && r.user_id === userId && (r.emoji === '👍' || r.emoji === '👎')));
  return [...others, { idea_id: ideaId, user_id: userId, emoji: vote === 1 ? '👍' : '👎' }];
}

/**
 * Which buttons an idea's sheet shows. "I'm in" and "Eh" while it is still gathering answers and
 * this person has not said they are in. "Plan it" once everyone is in. "We did it!" once it has a date.
 */
export function sheetButtons(stage: Stage, mine: Vote): { vote: boolean; plan: boolean; done: boolean } {
  return { vote: stage < 3 && mine !== 1, plan: stage === 3, done: stage === 4 };
}

/**
 * The flowers the bee picks among: the ones everyone is in on. With none of those, the ones still
 * gathering answers. With none of those either, whatever is growing.
 */
export function beeChoices(flowers: Pick<Flower, 'id' | 'stage' | 'fly'>[]): string[] {
  const growing = flowers.filter((f) => !f.fly);
  const ready = growing.filter((f) => f.stage === 3);
  const open = growing.filter((f) => f.stage < 3);
  return (ready.length ? ready : open.length ? open : growing).map((f) => f.id);
}

/**
 * The flower the bee goes to, by chance. `last` is the one it went to the time before: it is not
 * picked twice in a row while there is another. `random` gives a number from 0 up to 1.
 */
export function beePick(flowers: Pick<Flower, 'id' | 'stage' | 'fly'>[], last: string | null = null, random: () => number = Math.random): string | null {
  const choices = beeChoices(flowers);
  const others = choices.length > 1 ? choices.filter((id) => id !== last) : choices;
  if (others.length === 0) return null;
  return others[Math.min(others.length - 1, Math.floor(random() * others.length))];
}

/** The time of day in the garden. Dark mode is night. In light mode it is day, with dusk from five until nine in the evening. */
export function timeOfDay(dark: boolean, now: Date): TimeOfDay {
  if (dark) return 'night';
  const hour = now.getHours();
  return hour >= 17 && hour < 21 ? 'dusk' : 'day';
}

/** The line under the group's name: "Thrill Seekers · 30 to go". Null when the group has no points to go by. */
export function rankWords(points: number | null): string | null {
  if (points === null) return null;
  const level = levelFor(points);
  return level.next ? `${level.title} · ${level.toNext} to go` : `${level.title} · Top rank`;
}

/**
 * The ideas that have appeared since the last look, to say they are planted. `known` holds the ids
 * that were there before. Null means this is the first look, when nothing is new.
 */
export function newlyPlanted<I extends { id: string }>(known: ReadonlySet<string> | null, ideas: I[]): I[] {
  if (!known) return [];
  return ideas.filter((i) => !known.has(i.id));
}

// ---------- Water to nudge, and friends dropping by ----------

/**
 * The members an idea is still waiting on, other than the person looking: those who have said
 * neither "I'm in" nor "Eh". Empty once everyone is in or the idea is planned, when there is
 * nothing left to nudge anyone about.
 */
export function waitingOn(idea: Pick<Idea, 'id' | 'planned_for'>, members: Member[], reactions: Reaction[], userId: string): Member[] {
  if (stageOf(idea, members, reactions) >= 3) return [];
  return members.filter((m) => m.user_id !== userId && voteOf(idea.id, m.user_id, reactions) === 0);
}

/** A few names as the watering can says them: "Sam", "Sam and Alex", "Sam, Alex and Jo", and "4 people" for more. */
export function nudgeNames(names: string[]): string {
  if (names.length <= 1) return names.join('');
  if (names.length > 3) return `${names.length} people`;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** Someone other than the person looking who has just said "I'm in" on an idea. */
export type Arrival = { ideaId: string; userId: string; was: Vote };

/**
 * The "I'm in" answers that have come from other members since the last look, on the ideas given.
 * Each brings that friend's butterfly into the garden. `before` is null on the first look, when
 * nothing is new. `was` is what they had said before, which the flower goes on showing until
 * their butterfly lands.
 */
export function arrivals(before: Reaction[] | null, after: Reaction[], ideaIds: string[], members: Member[], userId: string): Arrival[] {
  if (!before) return [];
  const found: Arrival[] = [];
  for (const ideaId of ideaIds) {
    for (const m of members) {
      if (m.user_id === userId) continue;
      const was = voteOf(ideaId, m.user_id, before);
      if (was !== 1 && voteOf(ideaId, m.user_id, after) === 1) found.push({ ideaId, userId: m.user_id, was });
    }
  }
  return found;
}

/**
 * The group's reactions with some "I'm in" answers held back, so each flower stays as it was
 * until that friend's butterfly has landed on it and the leaf can unfurl as it does.
 */
export function holdBack(reactions: Reaction[], held: Arrival[]): Reaction[] {
  if (held.length === 0) return reactions;
  const isHeld = (r: Reaction) => r.emoji === '👍' && held.some((h) => h.ideaId === r.idea_id && h.userId === r.user_id);
  const eh = held.filter((h) => h.was === 2).map((h): Reaction => ({ idea_id: h.ideaId, user_id: h.userId, emoji: '👎' }));
  return [...reactions.filter((r) => !isHeld(r)), ...eh];
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The line under the group's name on a postcard of its garden: "Mon, Nov 23 · 9 ideas growing". */
export function postcardLine(now: Date, growing: number): string {
  return `${WEEKDAYS[now.getDay()]}, ${MONTHS[now.getMonth()]} ${now.getDate()} · ${growing === 1 ? '1 idea' : `${growing} ideas`} growing`;
}
