// Database tests for supabase/updates/009-guest-cleanup.sql. Run with: npm run test:db
import fs from 'node:fs';
import path from 'node:path';

import { as, eq, freshDb, one, REPO, rejects, rows, test } from './harness.mjs';

const UPDATE = '009-guest-cleanup.sql';
const sql = fs.readFileSync(path.join(REPO, 'supabase/updates', UPDATE), 'utf8');

async function world() {
  const db = await freshDb();
  // Supabase's own users table has these; the test stand-in needs them added.
  await db.exec(`alter table auth.users add column is_anonymous boolean not null default false;
                 alter table auth.users add column created_at timestamptz not null default now();`);
  await db.exec(sql);

  // `name` gives the user a profile; `daysOld` is how long ago they first opened the app.
  const user = async ({ guest = true, name = null, daysOld = 0, email = null }) => {
    const { id } = await one(db, `insert into auth.users (is_anonymous, email, created_at) values ($1, $2, now() - make_interval(days => $3)) returning id`, [guest, email, daysOld]);
    if (name) await db.query(`insert into public.profiles (id, name) values ($1, $2)`, [id, name]);
    return id;
  };
  const exists = async (id) => (await one(db, `select count(*)::int as n from auth.users where id = $1`, [id])).n === 1;
  const sweep = async (days) => (await one(db, days === undefined ? `select remove_stale_guests() as n` : `select remove_stale_guests($1) as n`, days === undefined ? [] : [days])).n;
  return { db, user, exists, sweep };
}

console.log('\nClearing out guests who never did anything');

await test('removes a guest with no name who first came more than 30 days ago', async () => {
  const w = await world();
  const stale = await w.user({ daysOld: 31 });
  eq(await w.sweep(), 1);
  eq(await w.exists(stale), false);
});

await test('leaves a recent guest alone: they may be about to pick a name', async () => {
  const w = await world();
  const today = await w.user({ daysOld: 0 });
  const lastWeek = await w.user({ daysOld: 29 });
  eq(await w.sweep(), 0);
  eq([await w.exists(today), await w.exists(lastWeek)], [true, true]);
});

await test('never removes a guest who picked a name, however old', async () => {
  const w = await world();
  const named = await w.user({ name: 'Ann', daysOld: 900 });
  const group = await as(w.db, named, async () => (await one(w.db, `select create_group('Friends', 'sky', array['Food']) as id`)).id, { guest: true });
  eq(await w.sweep(), 0);
  eq(await w.exists(named), true);
  eq((await one(w.db, `select count(*)::int as n from group_members where group_id = $1`, [group])).n, 1, 'still in their group');
});

await test('never removes an account with an email, named or not', async () => {
  const w = await world();
  const named = await w.user({ guest: false, email: 'ann@example.com', name: 'Ann', daysOld: 900 });
  const unnamed = await w.user({ guest: false, email: 'bo@example.com', daysOld: 900 });
  eq(await w.sweep(), 0);
  eq([await w.exists(named), await w.exists(unnamed)], [true, true]);
});

await test('removes only the stale ones from a mixed crowd, and says how many', async () => {
  const w = await world();
  const stale = [await w.user({ daysOld: 40 }), await w.user({ daysOld: 400 })];
  const kept = [await w.user({ daysOld: 5 }), await w.user({ name: 'Cy', daysOld: 400 }), await w.user({ guest: false, email: 'd@example.com', daysOld: 400 })];
  eq(await w.sweep(), 2);
  for (const id of stale) eq(await w.exists(id), false);
  for (const id of kept) eq(await w.exists(id), true);
  eq(await w.sweep(), 0, 'nothing left to remove the second time');
});

await test('can be given a different number of days, but never fewer than 7', async () => {
  const w = await world();
  const tenDays = await w.user({ daysOld: 10 });
  const threeDays = await w.user({ daysOld: 3 });
  eq(await w.sweep(8), 1);
  eq(await w.exists(tenDays), false);
  eq(await w.sweep(0), 0);
  eq(await w.exists(threeDays), true);
});

await test('the app cannot run it', async () => {
  const w = await world();
  const someone = await w.user({ name: 'Ann' });
  await rejects(as(w.db, someone, () => w.db.query(`select remove_stale_guests()`)), /permission denied/);
  await rejects(as(w.db, someone, () => w.db.query(`select remove_stale_guests(7)`)), /permission denied/);
});

await test('running the update twice is harmless', async () => {
  const w = await world();
  await w.db.exec(sql);
  const stale = await w.user({ daysOld: 31 });
  eq(await w.sweep(), 1);
  eq(await w.exists(stale), false);
  eq((await rows(w.db, `select 1 from auth.users`)).length, 0);
});
