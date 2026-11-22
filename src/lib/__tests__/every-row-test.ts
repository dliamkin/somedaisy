import { COUNTED, everyRow, PAGE } from '../every-row';

type Row = { id: string };
type Answer = { data: Row[] | null; error: { message: string; code?: string } | null; count?: number | null };

const rows = (from: number, to: number): Row[] => Array.from({ length: to - from }, (_, n) => ({ id: `r${from + n}` }));

/** A table of `total` rows that gives at most `cap` of them for one request, and says how many there are when `counted`. */
function table(total: number, { cap = PAGE, counted = true }: { cap?: number; counted?: boolean } = {}) {
  const asked: [number, number][] = [];
  const ask = (from: number, to: number): Promise<Answer> => {
    asked.push([from, to]);
    const end = Math.min(total, to + 1, from + cap);
    return Promise.resolve({ data: rows(from, Math.max(from, end)), error: null, count: counted ? total : null });
  };
  return { ask, asked };
}

describe('everyRow', () => {
  it('asks once when everything fits in one page', async () => {
    const { ask, asked } = table(3);
    const { data, error } = await everyRow(ask);
    expect(error).toBeNull();
    expect(data).toEqual(rows(0, 3));
    expect(asked).toEqual([[0, PAGE - 1]]);
  });

  it('asks once for nothing at all', async () => {
    const { ask, asked } = table(0);
    expect((await everyRow(ask)).data).toEqual([]);
    expect(asked).toHaveLength(1);
  });

  it('carries on past the first page until every row has arrived, in order', async () => {
    const { ask, asked } = table(2300);
    const { data } = await everyRow(ask);
    expect(data).toHaveLength(2300);
    expect(data?.[0]).toEqual({ id: 'r0' });
    expect(data?.[2299]).toEqual({ id: 'r2299' });
    expect(asked).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it('does not ask again when the last page is exactly full', async () => {
    const { ask, asked } = table(PAGE);
    expect((await everyRow(ask)).data).toHaveLength(PAGE);
    expect(asked).toHaveLength(1);
  });

  it('still reads everything when the database gives fewer rows at a time than were asked for', async () => {
    // Someone has set the most rows per request to 400. Each page comes back short, which is not the end.
    const { ask, asked } = table(1000, { cap: 400 });
    const { data } = await everyRow(ask);
    expect(data).toHaveLength(1000);
    expect(new Set(data?.map((row) => row.id)).size).toBe(1000);
    expect(asked.map(([from]) => from)).toEqual([0, 400, 800]);
  });

  it('goes by a short page when the database does not say how many rows there are', async () => {
    const short = table(3, { counted: false });
    expect((await everyRow(short.ask)).data).toHaveLength(3);
    expect(short.asked).toHaveLength(1);
    const long = table(1500, { counted: false });
    expect((await everyRow(long.ask)).data).toHaveLength(1500);
    expect(long.asked).toHaveLength(2);
  });

  it('gives the failure and no rows when the first page fails', async () => {
    const failure = { message: 'no access', code: '42501' };
    expect(await everyRow<Row>(() => Promise.resolve({ data: null, error: failure }))).toEqual({ data: null, error: failure });
  });

  it('gives the failure and no rows when a later page fails, so part of a list is never shown as all of it', async () => {
    const failure = { message: 'connection lost' };
    let page = 0;
    const answer = await everyRow<Row>(() => {
      page += 1;
      return Promise.resolve(page === 1 ? { data: rows(0, PAGE), error: null, count: 1500 } : { data: null, error: failure });
    });
    expect(answer).toEqual({ data: null, error: failure });
  });

  it('stops quietly when rows were removed while it was reading and the next page starts past the end', async () => {
    let page = 0;
    const { data, error } = await everyRow<Row>(() => {
      page += 1;
      return Promise.resolve(page === 1 ? { data: rows(0, PAGE), error: null, count: 1500 } : { data: null, error: { message: 'Requested range not satisfiable', code: 'PGRST103' } });
    });
    expect(error).toBeNull();
    expect(data).toHaveLength(PAGE);
  });

  it('stops when a page comes back empty, whatever the count says', async () => {
    let page = 0;
    const { data } = await everyRow<Row>(() => {
      page += 1;
      return Promise.resolve({ data: page === 1 ? rows(0, PAGE) : [], error: null, count: 5000 });
    });
    expect(data).toHaveLength(PAGE);
    expect(page).toBe(2);
  });

  it('keeps a row once when it turns up on two pages', async () => {
    // A row was added at the front while the pages were being read, so the last row of the first page is the first of the second.
    let page = 0;
    const { data } = await everyRow<Row>(
      () => {
        page += 1;
        return Promise.resolve(page === 1 ? { data: rows(0, PAGE), error: null, count: 1003 } : { data: rows(PAGE - 1, 1002), error: null, count: 1003 });
      },
      (row) => row.id,
    );
    expect(data).toHaveLength(1002);
    expect(new Set(data?.map((row) => row.id)).size).toBe(1002);
  });

  it('gives up after a great many pages, so a load cannot go on for ever', async () => {
    let page = 0;
    const { data } = await everyRow<Row>(() => {
      page += 1;
      return Promise.resolve({ data: rows(0, PAGE), error: null, count: Number.MAX_SAFE_INTEGER });
    });
    expect(page).toBe(50);
    expect(data).toHaveLength(50 * PAGE);
  });

  it('asks the database to count', () => {
    expect(COUNTED).toEqual({ count: 'exact' });
  });
});
