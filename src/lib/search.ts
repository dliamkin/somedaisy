// Finding an idea in a group by typing part of it. Nothing here asks the database: it looks
// through the ideas the group's page has already loaded, so it works as fast as someone types.

import type { Idea } from './data';
import { tagLine } from './pick';
import { plainName } from './similar';

/** How many ideas a group has before its page offers a search box. Fewer are quicker to read than to search. */
export const SEARCH_FROM = 6;

/** The fewest letters that have to be typed before anything is left out. One letter is in nearly everything. */
export const FIND_FROM = 2;

/** The most that can be typed into the box. */
export const FIND_MAX = 60;

/** As much of an idea as search looks at. */
export type Findable = Pick<Idea, 'id' | 'list_id' | 'title' | 'link' | 'note' | 'takes' | 'setting'>;

/**
 * What was typed, as the words to look for: small letters, no accents, no punctuation. Empty when
 * too little has been typed to search with.
 */
export function findWords(typed: string): string[] {
  const plain = plainName(typed);
  return plain.replace(/ /g, '').length < FIND_FROM ? [] : plain.split(' ').filter(Boolean);
}

/** A link as someone would look for it: the site and what follows, without "https", "www" or what comes after a "?". */
function linkWords(link: string | null | undefined): string {
  return (link ?? '').replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').replace(/^www\./i, '').replace(/[?#].*$/, '');
}

/**
 * The ideas that have every typed word somewhere in their name, note, link, tags or list's name.
 * A word only has to be part of one: "pizz" finds "Pizza night". Ideas found by their name come
 * first. Within that, they stay in the order they were given. When too little has been typed,
 * every idea is given back.
 */
export function findIdeas<T extends Findable>(typed: string, ideas: readonly T[], lists: readonly { id: string; name: string }[]): T[] {
  const words = findWords(typed);
  if (words.length === 0) return [...ideas];
  const listNames = new Map(lists.map((list) => [list.id, list.name]));
  const byName: T[] = [];
  const byRest: T[] = [];
  for (const idea of ideas) {
    const name = plainName(idea.title);
    if (words.every((word) => name.includes(word))) {
      byName.push(idea);
      continue;
    }
    const rest = plainName([idea.title, idea.note ?? '', linkWords(idea.link), tagLine(idea), listNames.get(idea.list_id) ?? ''].join(' '));
    if (words.every((word) => rest.includes(word))) byRest.push(idea);
  }
  return [...byName, ...byRest];
}

/** "1 idea found" or "12 ideas found", for the line above what a search turned up. */
export function foundLine(count: number): string {
  return count === 1 ? '1 idea found' : `${count} ideas found`;
}
