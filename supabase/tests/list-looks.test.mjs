// Database tests for supabase/updates/012-list-looks.sql. Run with: npm run test:db
import { as, eq, freshDb, newUser, one, rejects, test } from './harness.mjs';

const UPDATE = '012-list-looks.sql';

const db = await freshDb([UPDATE]);
const ann = await newUser(db, 'Ann');
const bo = await newUser(db, 'Bo');
const zed = await newUser(db, 'Zed');
const group = await as(db, ann, async () => (await one(db, `select create_group('Friends', 'sky', array['Food']) as id`)).id);
const { invite_code: code } = await one(db, `select invite_code from groups where id = $1`, [group]);
await as(db, bo, () => db.query(`select join_group($1)`, [code]));
const { id: list } = await one(db, `select id from lists where group_id = $1`, [group]);
const lookOf = async () => one(db, `select icon, color from lists where id = $1`, [list]);
const set = (user, change, params = []) => as(db, user, () => db.query(`update lists set ${change} where id = $1`, [list, ...params]));

console.log('\nList icons and colours');

await test('a list starts with no icon and no colour', async () => {
  eq(await lookOf(), { icon: null, color: null });
});

await test('any member can give a list an icon and a colour', async () => {
  await set(bo, `icon = 'movie', color = '#7B3FE4'`);
  eq(await lookOf(), { icon: 'movie', color: '#7B3FE4' });
});

await test('a new list can be made with them', async () => {
  const made = await as(db, ann, () =>
    one(db, `insert into lists (group_id, name, position, icon, color) values ($1, 'Camping', 2, 'tent', '#1fa98a') returning icon, color`, [group]));
  eq(made, { icon: 'tent', color: '#1fa98a' });
});

await test('they can be taken away again', async () => {
  await set(ann, `icon = null, color = null`);
  eq(await lookOf(), { icon: null, color: null });
});

await test('only a plain icon name is accepted', async () => {
  for (const bad of ['', 'Movie', 'two words', '<svg>', 'a'.repeat(31), '9lives']) {
    await rejects(set(ann, `icon = $2`, [bad]), /lists_icon_check/, bad.slice(0, 20) || 'empty');
  }
});

await test('only a six-figure colour code is accepted', async () => {
  for (const bad of ['', 'red', '#abc', '7B3FE4', '#7B3FE4FF', '#GGGGGG', 'url(x)']) {
    await rejects(set(ann, `color = $2`, [bad]), /lists_color_check/, bad || 'empty');
  }
});

await test('someone outside the group cannot change a list', async () => {
  await set(zed, `icon = 'star', color = '#000000'`);
  eq(await lookOf(), { icon: null, color: null });
});

await test('running the update again changes nothing', async () => {
  await set(ann, `icon = 'pin', color = '#2F7BE8'`);
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { REPO } = await import('./harness.mjs');
  await db.exec(fs.readFileSync(path.join(REPO, 'supabase', 'updates', UPDATE), 'utf8'));
  eq(await lookOf(), { icon: 'pin', color: '#2F7BE8' });
});
