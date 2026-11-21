// What the admin page (src/app/admin.tsx) asks the database for, and how it reads the answers.
//
// The page is for whoever runs SomeDaisy. It only reads. Who may open it is decided in the
// database (supabase/updates/020-admin.sql), every time something is asked for: nothing here, and
// nothing in the app, is what keeps it shut. It is given names, email addresses, dates and
// counts, and never the words of an idea, a note or a comment.

import { db } from './supabase';

/** How many people or groups the page asks for at a time. */
export const PAGE = 50;
export const SEARCH_MAX = 60;

export const NOT_LOADED = "We couldn't load that. Try again.";

const TOTALS = ['people', 'accounts', 'guests', 'groups', 'shared_groups', 'ideas', 'plans', 'done', 'reactions', 'comments', 'phones'] as const;
const WEEK = ['new_people', 'new_groups', 'active_people', 'active_groups', 'ideas', 'done'] as const;
const FUNNEL = ['named', 'in_group', 'added_idea', 'did_one'] as const;
const LASTING = ['old_groups', 'still_used'] as const;
const COVERS = ['classic', 'look', 'uploaded', 'searched'] as const;

type Counts<K extends readonly string[]> = Record<K[number], number>;

export type Week = { /** The Monday it starts on, as "2026-11-16". */ start: string; people: number; groups: number };
export type Overview = {
  totals: Counts<typeof TOTALS>;
  /** The last seven days. */
  week: Counts<typeof WEEK>;
  /** The last eight weeks, oldest first. */
  weeks: Week[];
  /** How far people get. Each number counts people. */
  funnel: Counts<typeof FUNNEL>;
  /** People in a group they did not start. */
  invited: number;
  lasting: Counts<typeof LASTING>;
  covers: Counts<typeof COVERS>;
  idea_pictures: number;
};

export type AdminPerson = {
  id: string;
  name: string;
  color: string;
  /** Null for a guest. */
  email: string | null;
  guest: boolean;
  google: boolean;
  joined: string | null;
  last_active: string | null;
  groups: number;
  ideas: number;
};
export type PersonDetail = AdminPerson & {
  last_sign_in: string | null;
  reactions: number;
  comments: number;
  phones: number;
  in: { id: string; name: string; joined: string | null; started: boolean; members: number }[];
};

export type GroupSort = 'busy' | 'new' | 'big';
export const GROUP_SORTS: { key: GroupSort; label: string }[] = [
  { key: 'busy', label: 'Busiest' },
  { key: 'new', label: 'Newest' },
  { key: 'big', label: 'Biggest' },
];

export type AdminGroup = {
  id: string;
  name: string;
  created_at: string | null;
  members: number;
  ideas: number;
  done: number;
  points: number;
  /** How many things happened in it in the last four weeks. */
  recent: number;
  last_active: string | null;
};
export type GroupDetail = Omit<AdminGroup, 'members' | 'recent'> & {
  /** 'classic', 'look', 'upload' or 'search'. */
  cover: string;
  plans: number;
  reactions: number;
  comments: number;
  members: { id: string; name: string; color: string; guest: boolean; joined: string | null; started: boolean }[];
  lists: { id: string; name: string; ideas: number }[];
};

export type Listed<T> = { rows: T[]; /** How many match in all, shown or not. */ total: number };

// ---------- Reading what the database sends ----------

type Loose = Record<string, unknown>;
const loose = (value: unknown): Loose | null => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Loose) : null);
/** A count. The database sends some as words ("12"), and anything that is not a count is zero. */
export function count(value: unknown): number {
  const n = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}
const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value : null);
const date = (value: unknown): string | null => (typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : null);
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

function counts<K extends readonly string[]>(value: unknown, keys: K): Counts<K> {
  const from = loose(value) ?? {};
  return Object.fromEntries(keys.map((key) => [key, count(from[key])])) as Counts<K>;
}

/** The overview as the page uses it, or null when the answer is not one. */
export function overviewFrom(data: unknown): Overview | null {
  const o = loose(data);
  if (!o || !loose(o.totals)) return null;
  const weeks: Week[] = [];
  for (const entry of list(o.weeks)) {
    const w = loose(entry);
    const start = w && typeof w.start === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(w.start) ? w.start : null;
    if (w && start) weeks.push({ start, people: count(w.people), groups: count(w.groups) });
  }
  return {
    totals: counts(o.totals, TOTALS),
    week: counts(o.week, WEEK),
    weeks,
    funnel: counts(o.funnel, FUNNEL),
    invited: count(o.invited),
    lasting: counts(o.lasting, LASTING),
    covers: counts(o.covers, COVERS),
    idea_pictures: count(o.idea_pictures),
  };
}

function personFrom(row: unknown): AdminPerson | null {
  const p = loose(row);
  const id = p && text(p.id);
  if (!p || !id) return null;
  return {
    id,
    name: text(p.name) ?? 'No name',
    color: text(p.color) ?? '',
    email: text(p.email),
    guest: p.guest === true,
    google: p.google === true,
    joined: date(p.joined),
    last_active: date(p.last_active),
    groups: count(p.groups),
    ideas: count(p.ideas),
  };
}

export function personDetailFrom(data: unknown): PersonDetail | null {
  const person = personFrom(data);
  const p = loose(data);
  if (!person || !p) return null;
  const groups: PersonDetail['in'] = [];
  for (const entry of list(p.groups)) {
    const g = loose(entry);
    const id = g && text(g.id);
    if (g && id) groups.push({ id, name: text(g.name) ?? 'No name', joined: date(g.joined), started: g.started === true, members: count(g.members) });
  }
  return { ...person, groups: groups.length, last_sign_in: date(p.last_sign_in), reactions: count(p.reactions), comments: count(p.comments), phones: count(p.phones), in: groups };
}

function groupFrom(row: unknown): AdminGroup | null {
  const g = loose(row);
  const id = g && text(g.id);
  if (!g || !id) return null;
  return {
    id,
    name: text(g.name) ?? 'No name',
    created_at: date(g.created_at),
    members: count(g.members),
    ideas: count(g.ideas),
    done: count(g.done),
    points: count(g.points),
    recent: count(g.recent),
    last_active: date(g.last_active),
  };
}

export function groupDetailFrom(data: unknown): GroupDetail | null {
  const g = loose(data);
  const id = g && text(g.id);
  if (!g || !id) return null;
  const members: GroupDetail['members'] = [];
  for (const entry of list(g.members)) {
    const m = loose(entry);
    const who = m && text(m.id);
    if (m && who) members.push({ id: who, name: text(m.name) ?? 'No name', color: text(m.color) ?? '', guest: m.guest === true, joined: date(m.joined), started: m.started === true });
  }
  const lists: GroupDetail['lists'] = [];
  for (const entry of list(g.lists)) {
    const l = loose(entry);
    const which = l && text(l.id);
    if (l && which) lists.push({ id: which, name: text(l.name) ?? 'No name', ideas: count(l.ideas) });
  }
  return {
    id,
    name: text(g.name) ?? 'No name',
    created_at: date(g.created_at),
    cover: text(g.cover) ?? 'classic',
    ideas: count(g.ideas),
    plans: count(g.plans),
    done: count(g.done),
    points: count(g.points),
    reactions: count(g.reactions),
    comments: count(g.comments),
    last_active: date(g.last_active),
    members,
    lists,
  };
}

/** A page of rows, with how many there are in all (which every row carries). */
export function listedFrom<T>(data: unknown, read: (row: unknown) => T | null): Listed<T> {
  const rows: T[] = [];
  let total = 0;
  for (const entry of list(data)) {
    const row = read(entry);
    if (!row) continue;
    rows.push(row);
    total = Math.max(total, count(loose(entry)?.total));
  }
  return { rows, total: Math.max(total, rows.length) };
}

/** What was typed into a search box, tidied. Null when there is nothing to look for. */
export function cleanFind(typed: string): string | null {
  const words = typed.replace(/\s+/g, ' ').trim().slice(0, SEARCH_MAX).trim();
  return words || null;
}

// ---------- Asking ----------

/**
 * Whether the signed-in person may open the admin page. False for everyone else, and false when
 * it cannot be found out, so the page stays shut. This only decides what the page draws: the
 * database makes the same check again before it hands anything over.
 */
export async function amAdmin(): Promise<boolean> {
  try {
    const { data, error } = await db().rpc('is_admin');
    return !error && data === true;
  } catch {
    return false;
  }
}

async function ask(name: string, args?: Record<string, unknown>): Promise<unknown> {
  let answer: { data: unknown; error: unknown };
  try {
    answer = await db().rpc(name, args);
  } catch {
    throw new Error(NOT_LOADED);
  }
  if (answer.error) throw new Error(NOT_LOADED);
  return answer.data;
}

export async function loadOverview(): Promise<Overview> {
  const overview = overviewFrom(await ask('admin_overview'));
  if (!overview) throw new Error(NOT_LOADED);
  return overview;
}

export async function loadPeople(search: string, offset = 0): Promise<Listed<AdminPerson>> {
  return listedFrom(await ask('admin_people', { p_search: cleanFind(search), p_limit: PAGE, p_offset: Math.max(0, offset) }), personFrom);
}

export async function loadGroups(sort: GroupSort, search: string, offset = 0): Promise<Listed<AdminGroup>> {
  return listedFrom(await ask('admin_groups', { p_sort: sort, p_search: cleanFind(search), p_limit: PAGE, p_offset: Math.max(0, offset) }), groupFrom);
}

/** One person, or null when there is nobody with that id. */
export async function loadPerson(id: string): Promise<PersonDetail | null> {
  return personDetailFrom(await ask('admin_person', { p_user: id }));
}

/** One group, or null when there is no group with that id. */
export async function loadGroup(id: string): Promise<GroupDetail | null> {
  return groupDetailFrom(await ask('admin_group', { p_group: id }));
}

/** Whether a word from the page's address could be the id of a person or a group. */
export function isId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

// ---------- Words for the page ----------

/** A part of a whole as a percentage, such as "75%". "0%" when there is no whole. */
export function share(part: number, whole: number): string {
  if (!(whole > 0) || !(part > 0)) return '0%';
  const percent = (Math.min(part, whole) / whole) * 100;
  // Something small is still something, and almost everything is not everything.
  return `${percent < 1 ? '<1' : percent > 99 && part < whole ? '99' : Math.round(percent)}%`;
}

/** How wide a bar is, from 0 to 1, when the biggest in its set is `most`. */
export function barWidth(value: number, most: number): number {
  return most > 0 && value > 0 ? Math.min(1, value / most) : 0;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A day, such as "16 Nov 2026". "Not known" when there is none. */
export function dayOf(iso: string | null): string {
  if (!iso) return 'Not known';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? 'Not known' : `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** The week that starts on a day given as "2026-11-16": "16 Nov". */
export function weekLabel(start: string): string {
  const [, month, day] = start.split('-').map(Number);
  return MONTHS[month - 1] ? `${day} ${MONTHS[month - 1]}` : start;
}

/** How long ago something was, in days, weeks, months or years. "Never" when it was not. */
export function ago(iso: string | null, now: Date): string {
  if (!iso) return 'Never';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'Never';
  const days = Math.floor((now.getTime() - then) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 730) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

/** "1 person", "3 people": a count with the right word after it. */
export function countOf(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** How someone signs in, in a word or two. */
export function signsInWith(person: { guest: boolean; google: boolean }): string {
  return person.guest ? 'Guest' : person.google ? 'Google' : 'Email';
}

const COVER_SAYS: Record<string, string> = { classic: 'A classic colour', look: 'A three-colour look', upload: 'An uploaded photo', search: 'A photo from search' };
export const coverSays = (kind: string): string => COVER_SAYS[kind] ?? 'A classic colour';
