// Loading all of something, however much there is.
//
// Supabase gives back at most 1,000 rows for one request, and says nothing when it stops there.
// A busy group passes that: five people voting on 250 ideas is 1,250 reactions. Past it, votes
// and "Everyone's in" would quietly come out wrong. So anything that can grow that large is
// asked for a page at a time until all of it has arrived.

/** How many rows are asked for at a time. */
export const PAGE = 1000;

// The most pages one load will ask for. Far more than any group has, and an end to a load that
// would otherwise never finish.
const MOST_PAGES = 50;

type Failure = { message: string; code?: string };
type Answer<T> = { data: T[] | null; error: Failure | null; count?: number | null };

/**
 * Every row of a query. `ask` makes the request for one page, from row `from` to row `to`:
 *
 *   everyRow((from, to) => db().from('reactions').select('idea_id', COUNTED).eq('group_id', id).order('idea_id').range(from, to))
 *
 * The query has to do three things:
 *   * select with `COUNTED`, so the database says how many rows there are in all. Going by a page
 *     coming back short would not do: the database may be set to give fewer than `PAGE` at a time.
 *   * put the rows in an order that no two rows share, ending with a column that is different for
 *     every row, so each page starts where the one before stopped.
 *   * end with `.range(from, to)`.
 *
 * `keyOf` names a row. When given, a row that turns up twice, because something was added while
 * the pages were being read, is kept once.
 *
 * The answer has the same shape as a single request's: the rows, or the first failure.
 */
export async function everyRow<T>(
  ask: (from: number, to: number) => PromiseLike<Answer<T>>,
  keyOf?: (row: T) => string,
): Promise<{ data: T[] | null; error: Failure | null }> {
  const rows: T[] = [];
  const seen = new Set<string>();
  // Where the next page starts. Counted in rows asked for, so a row left out as a repeat does not shift it.
  let from = 0;
  for (let page = 0; page < MOST_PAGES; page += 1) {
    const { data, error, count } = await ask(from, from + PAGE - 1);
    if (error) {
      // PGRST103: the page asked for starts past the last row. Rows were removed while the pages
      // were being read, and everything that is left has already arrived.
      if (page > 0 && error.code === 'PGRST103') break;
      return { data: null, error };
    }
    const got = data ?? [];
    for (const row of got) {
      if (keyOf) {
        const key = keyOf(row);
        if (seen.has(key)) continue;
        seen.add(key);
      }
      rows.push(row);
    }
    from += got.length;
    if (got.length === 0) break;
    // With a count, carry on until that many have arrived. Without one, a short page is the end.
    if (typeof count === 'number' ? from >= count : got.length < PAGE) break;
  }
  return { data: rows, error: null };
}

/** Passed to `select`, so the answer says how many rows there are in all. */
export const COUNTED = { count: 'exact' } as const;
