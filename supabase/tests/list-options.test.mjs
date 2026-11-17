// Database tests for supabase/updates/015-list-options.sql. Run with: npm run test:db
import fs from 'node:fs';
import path from 'node:path';

import { as, eq, freshDb, newUser, one, rejects, REPO, test } from './harness.mjs';

const UPDATE = '015-list-options.sql';

const db = await freshDb([UPDATE]);
const ann = await newUser(db, 'Ann');
const bo = await newUser(db, 'Bo');
const zed = await newUser(db, 'Zed');
const group = await as(db, ann, async () => (await one(db, `select create_group('Friends', 'sky', array['Food']) as id`)).id);
const { invite_code: code } = await one(db, `select invite_code from groups where id = $1`, [group]);
await as(db, bo, () => db.query(`select join_group($1)`, [code]));
const { id: list } = await one(db, `select id from lists where group_id = $1`, [group]);
const optionsOf = async (id = list) => one(db, `select dates, links, notes from lists where id = $1`, [id]);
const set = (user, change, params = []) => as(db, user, () => db.query(`update lists set ${change} where id = $1`, [list, ...params]));

console.log('\nWhat each list asks for');

await test('a list starts with dates, links and notes all on', async () => {
  eq(await optionsOf(), { dates: true, links: true, notes: true });
});

await test('any member can turn them off, one at a time', async () => {
  await set(bo, `dates = false`);
  eq(await optionsOf(), { dates: false, links: true, notes: true });
  await set(ann, `links = false, notes = false`);
  eq(await optionsOf(), { dates: false, links: false, notes: false });
});

await test('and back on again', async () => {
  await set(bo, `dates = true, links = true, notes = true`);
  eq(await optionsOf(), { dates: true, links: true, notes: true });
});

await test('a new list can be made with its own choices', async () => {
  const made = await as(db, ann, () =>
    one(db, `insert into lists (group_id, name, position, dates, links, notes) values ($1, 'Song titles', 2, false, true, false) returning id`, [group]));
  eq(await optionsOf(made.id), { dates: false, links: true, notes: false });
});

await test('a new list made without saying gets all three', async () => {
  const made = await as(db, bo, () => one(db, `insert into lists (group_id, name, position) values ($1, 'Trips', 3) returning id`, [group]));
  eq(await optionsOf(made.id), { dates: true, links: true, notes: true });
});

await test('each one is on or off, never empty', async () => {
  for (const column of ['dates', 'links', 'notes']) {
    await rejects(set(ann, `${column} = null`), /null value|not-null/, column);
  }
});

await test('turning dates off leaves a date already set alone', async () => {
  const { id: idea } = await as(db, ann, () =>
    one(db, `insert into ideas (group_id, list_id, title, added_by, planned_for, link, note) values ($1, $2, 'Tacos', $3, '2027-01-09T19:00:00Z', 'https://example.com/tacos', 'Bring cash') returning id`, [group, list, ann]));
  await set(ann, `dates = false, links = false, notes = false`);
  const kept = await one(db, `select planned_for is not null as dated, link, note from ideas where id = $1`, [idea]);
  eq(kept, { dated: true, link: 'https://example.com/tacos', note: 'Bring cash' });
  await set(ann, `dates = true, links = true, notes = true`);
});

await test('someone outside the group cannot change a list', async () => {
  await set(zed, `dates = false, links = false, notes = false`);
  eq(await optionsOf(), { dates: true, links: true, notes: true });
});

await test('running the update again keeps the choices made', async () => {
  await set(ann, `dates = false, notes = false`);
  await db.exec(fs.readFileSync(path.join(REPO, 'supabase', 'updates', UPDATE), 'utf8'));
  eq(await optionsOf(), { dates: false, links: true, notes: false });
});
