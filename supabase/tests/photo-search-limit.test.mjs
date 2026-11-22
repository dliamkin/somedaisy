// Database tests for supabase/updates/021-photo-search-limit.sql. Run with: npm run test:db
import fs from 'node:fs';
import path from 'node:path';

import { as, eq, freshDb, newUser, one, REPO, rejects, rows, test } from './harness.mjs';

const UPDATE = '021-photo-search-limit.sql';
const sql = fs.readFileSync(path.join(REPO, 'supabase/updates', UPDATE), 'utf8');

const SEARCHES = 12;
const SAVES = 12;

async function world() {
  const db = await freshDb([UPDATE]);
  const ann = await newUser(db, 'Ann');
  const bo = await newUser(db, 'Bo');
  // One request of a kind, as that person. True when it was let through.
  const take = (user, kind) => as(db, user, async () => (await one(db, kind === undefined ? `select take_photo_search() as ok` : `select take_photo_search($1) as ok`, kind === undefined ? [] : [kind])).ok);
  // That many requests, one after another. How many were let through.
  const takeMany = async (user, kind, times) => {
    let through = 0;
    for (let n = 0; n < times; n += 1) if (await take(user, kind)) through += 1;
    return through;
  };
  const noted = async (user, kind) => (await one(db, `select count(*)::int as n from photo_search_uses where user_id = $1 and kind = $2`, [user, kind])).n;
  // Make everything noted so far look like it happened that many minutes ago.
  const age = (minutes) => db.query(`update photo_search_uses set at = at - make_interval(mins => $1)`, [minutes]);
  return { db, ann, bo, take, takeMany, noted, age };
}

console.log('\nA limit on photo search for each person');

await test('lets a person search, and notes that they did', async () => {
  const w = await world();
  eq(await w.take(w.ann, 'search'), true);
  eq(await w.noted(w.ann, 'search'), 1);
});

await test('stops a person at twelve searches in an hour, and notes nothing for the ones it refuses', async () => {
  const w = await world();
  eq(await w.takeMany(w.ann, 'search', SEARCHES), SEARCHES);
  eq(await w.take(w.ann, 'search'), false);
  eq(await w.take(w.ann, 'search'), false);
  eq(await w.noted(w.ann, 'search'), SEARCHES);
});

await test("one person's searches do not use up another's", async () => {
  const w = await world();
  await w.takeMany(w.ann, 'search', SEARCHES);
  eq(await w.take(w.ann, 'search'), false);
  eq(await w.take(w.bo, 'search'), true);
});

await test('saving found photos has its own share', async () => {
  const w = await world();
  eq(await w.takeMany(w.ann, 'chosen', SAVES), SAVES);
  eq(await w.take(w.ann, 'chosen'), false);
  // Having saved that many does not stop a search, and the other way round.
  eq(await w.take(w.ann, 'search'), true);
  await w.takeMany(w.bo, 'search', SEARCHES);
  eq(await w.take(w.bo, 'chosen'), true);
});

await test('takes anything it does not know as a search', async () => {
  const w = await world();
  eq(await w.take(w.ann), true);
  eq(await w.take(w.ann, 'nonsense'), true);
  eq(await w.take(w.ann, null), true);
  eq([await w.noted(w.ann, 'search'), await w.noted(w.ann, 'chosen')], [3, 0]);
});

await test('a search stops counting once it is over an hour old, and its row is removed', async () => {
  const w = await world();
  await w.takeMany(w.ann, 'search', SEARCHES);
  await w.age(59);
  eq(await w.take(w.ann, 'search'), false);
  await w.age(2);
  eq(await w.take(w.ann, 'search'), true);
  eq(await w.noted(w.ann, 'search'), 1);
});

await test("asking also clears out other people's old rows", async () => {
  const w = await world();
  await w.take(w.bo, 'search');
  await w.age(61);
  await w.take(w.ann, 'search');
  eq(await w.noted(w.bo, 'search'), 0);
});

await test('the hour moves along: places come back one by one as searches get old', async () => {
  const w = await world();
  await w.takeMany(w.ann, 'search', 6);
  await w.age(40);
  await w.takeMany(w.ann, 'search', 6);
  eq(await w.take(w.ann, 'search'), false);
  // The first six are now over an hour old. The second six are not.
  await w.age(25);
  eq(await w.takeMany(w.ann, 'search', 7), 6);
});

await test('nobody signed in is refused, and nothing is noted', async () => {
  const w = await world();
  eq((await one(w.db, `select take_photo_search('search') as ok`)).ok, false);
  eq(await rows(w.db, `select id from photo_search_uses`), []);
});

await test('someone who is not signed in at all cannot call it', async () => {
  const w = await world();
  await w.db.exec('set role anon');
  try {
    await rejects(w.db.query(`select take_photo_search('search')`), /permission denied/);
  } finally {
    await w.db.exec('reset role');
  }
});

await test('the app can neither read the counts nor change them', async () => {
  const w = await world();
  await w.take(w.ann, 'search');
  const seen = await as(w.db, w.ann, () => rows(w.db, `select id from photo_search_uses`).catch((e) => String(e.message)));
  eq(Array.isArray(seen) ? seen : /permission denied/.test(seen) ? [] : seen, []);
  await rejects(as(w.db, w.ann, () => w.db.query(`insert into photo_search_uses (user_id, kind) values ($1, 'search')`, [w.bo])), /row-level security|permission denied/);
  await as(w.db, w.ann, () => w.db.query(`delete from photo_search_uses`).catch(() => {}));
  eq(await w.noted(w.ann, 'search'), 1);
});

await test('the app cannot run the clearing out', async () => {
  const w = await world();
  await rejects(as(w.db, w.ann, () => w.db.query(`select clear_photo_search_uses()`)), /permission denied/);
});

await test('clearing out removes only what is over an hour old', async () => {
  const w = await world();
  await w.take(w.ann, 'search');
  await w.age(61);
  await w.take(w.bo, 'chosen');
  // Bo asking has already cleared Ann's. Put an old one back to see the clearing out do it.
  await w.db.query(`insert into photo_search_uses (user_id, kind, at) values ($1, 'search', now() - interval '2 hours')`, [w.ann]);
  eq((await one(w.db, `select clear_photo_search_uses() as n`)).n, 1);
  eq([await w.noted(w.ann, 'search'), await w.noted(w.bo, 'chosen')], [0, 1]);
});

await test('only the two kinds can be noted', async () => {
  const w = await world();
  await rejects(w.db.query(`insert into photo_search_uses (user_id, kind) values ($1, 'other')`, [w.ann]), /check/);
});

await test("a person's counts go when their account does", async () => {
  const w = await world();
  await w.take(w.ann, 'search');
  await w.db.query(`delete from auth.users where id = $1`, [w.ann]);
  eq(await rows(w.db, `select id from photo_search_uses`), []);
});

await test('it holds who and when, and nothing about what was searched for', async () => {
  const w = await world();
  const columns = (await rows(w.db, `select column_name from information_schema.columns where table_schema = 'public' and table_name = 'photo_search_uses' order by column_name`)).map((c) => c.column_name);
  eq(columns, ['at', 'id', 'kind', 'user_id']);
});

await test('running the update twice changes nothing, and keeps what was noted', async () => {
  const w = await world();
  await w.takeMany(w.ann, 'search', SEARCHES);
  await w.db.exec(sql);
  eq(await w.noted(w.ann, 'search'), SEARCHES);
  eq(await w.take(w.ann, 'search'), false);
  eq(await w.take(w.bo, 'search'), true);
});
