// What a list asks for. Every list needs a name for each idea, and nothing else. A list can also
// let its ideas be given a date, and show a link box and a note box on the form for a new idea.
// Movies, Places and Food want all of that. A list such as "Song titles" may want only the name.
//
// The choices are kept on the list (supabase/updates/015-list-options.sql). A list without them,
// which is every list made before that update, has all three turned on.

export type ListOptions = {
  /** Its ideas can be given a date, turning them into plans. */
  dates: boolean;
  /** The form for an idea shows the link box. */
  links: boolean;
  /** The form for an idea shows the note box. */
  notes: boolean;
};

export const ALL_ON: ListOptions = { dates: true, links: true, notes: true };

type Stored = { dates?: boolean | null; links?: boolean | null; notes?: boolean | null };

/** A list's choices. Anything not said, or a list that is not there, counts as turned on. */
export function optionsOf(list: Stored | null | undefined): ListOptions {
  return { dates: list?.dates !== false, links: list?.links !== false, notes: list?.notes !== false };
}

export function sameOptions(a: ListOptions, b: ListOptions): boolean {
  return a.dates === b.dates && a.links === b.links && a.notes === b.notes;
}

/**
 * Which boxes the form for an idea shows. A box the list has turned off still shows while it
 * has something in it, so an idea moved from another list can have its link or note changed or
 * taken off. The "good for" tags go with dates: they describe things to go and do.
 */
export function formShows(list: Stored | null | undefined, has: { link: boolean; note: boolean }): { link: boolean; note: boolean; tags: boolean } {
  const options = optionsOf(list);
  return { link: options.links || has.link, note: options.notes || has.note, tags: options.dates };
}

/** A few words for what a list asks for, such as "Name only" or "Dates, links". */
export function optionsLine(options: ListOptions): string {
  const on = [options.dates ? 'dates' : null, options.links ? 'links' : null, options.notes ? 'notes' : null].filter(Boolean) as string[];
  if (on.length === 0) return 'Name only';
  const line = on.join(', ');
  return line[0].toUpperCase() + line.slice(1);
}
