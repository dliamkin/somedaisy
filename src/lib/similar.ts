// Noticing that an idea being typed is one the group already has, so the same thing is not
// added twice. Nothing here asks the database: it looks through the ideas already on the device.

/** As much of an idea as is needed to say "this is already here". */
export type Known = { id: string; title: string; list_id: string };

// Small words that say nothing about what an idea is. Left out when comparing, unless they are all there is.
const FILLER = new Set(['a', 'an', 'the', 'to', 'of', 'at', 'in', 'on', 'and', 'for', 'go', 'see']);

/** The fewest letters that have to be typed before anything is offered. Fewer matches half the list. */
export const ALIKE_FROM = 3;

/**
 * A name made plain for comparing: small letters, no accents, and no punctuation, with single
 * spaces. "Café  Río!" and "cafe rio" come out the same.
 */
export function plainName(name: string): string {
  let text = name.toLowerCase();
  try {
    text = text.normalize('NFKD').replace(/[̀-ͯ]/g, '');
  } catch {
    // A phone that cannot take accents apart compares the letters as they are.
  }
  return text.replace(/[\s!-/:-@[-`{-~‘’“”–—…·]+/g, ' ').trim();
}

function wordsOf(plain: string): string[] {
  const all = plain.split(' ').filter(Boolean);
  const telling = all.filter((word) => !FILLER.has(word));
  return telling.length > 0 ? telling : all;
}

/**
 * How alike a typed name and an idea's name are: 0 the same, 1 the typed name is how the idea's
 * name starts, 2 the same words are in both, and null for not alike. The last typed word may be
 * half typed, so it only has to be how a word starts.
 */
export function alike(typed: string, title: string): 0 | 1 | 2 | null {
  const a = plainName(typed);
  const b = plainName(title);
  if (a.length < ALIKE_FROM || !b) return null;
  if (a === b) return 0;
  if (b.startsWith(a)) return 1;
  const typedWords = wordsOf(a);
  const titleWords = wordsOf(b);
  // Every word typed is in the idea's name: "dune two" finds "Dune: Part Two".
  if (typedWords.every((word, i) => titleWords.some((other) => (i === typedWords.length - 1 ? other.startsWith(word) : other === word)))) return 2;
  // Or the other way round: the whole of a short name is in what was typed. "Dune in IMAX" finds "Dune".
  if (b.length >= ALIKE_FROM && titleWords.every((word) => typedWords.includes(word))) return 2;
  return null;
}

/** The ideas most like the name being typed, closest first, and no more than `most` of them. */
export function similarIdeas<T extends Known>(typed: string, ideas: readonly T[], most = 3): T[] {
  const found: { idea: T; rank: number; place: number }[] = [];
  ideas.forEach((idea, place) => {
    const rank = alike(typed, idea.title);
    if (rank !== null) found.push({ idea, rank, place });
  });
  return found
    .sort((x, y) => x.rank - y.rank || x.place - y.place)
    .slice(0, most)
    .map((entry) => entry.idea);
}
