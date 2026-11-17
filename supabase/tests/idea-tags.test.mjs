// Database tests for supabase/updates/014-idea-tags.sql. Run with: npm run test:db
import { as, eq, freshDb, newUser, one, rejects, test } from './harness.mjs';

const UPDATE = '014-idea-tags.sql';

const db = await freshDb([UPDATE]);
const ann = await newUser(db, 'Ann');
const bo = await newUser(db, 'Bo');
const zed = await newUser(db, 'Zed');
const group = await as(db, ann, async () => (await one(db, `select create_group('Friends', 'sky', array['Food']) as id`)).id);
const { invite_code: code } = await one(db, `select invite_code from groups where id = $1`, [group]);
await as(db, bo, () => db.query(`select join_group($1)`, [code]));
const { id: list } = await one(db, `select id from lists where group_id = $1`, [group]);
const { id: idea } = await as(db, ann, () =>
  one(db, `insert into ideas (group_id, list_id, title, added_by) values ($1, $2, 'Tacos', $3) returning id`, [group, list, ann]));
const tagsOf = async () => one(db, `select takes, setting from ideas where id = $1`, [idea]);
const set = (user, change, params = []) => as(db, user, () => db.query(`update ideas set ${change} where id = $1`, [idea, ...params]));

console.log('\nIdea tags for Pick for us');

await test('an idea starts with no tags', async () => {
  eq(await tagsOf(), { takes: null, setting: null });
});

await test('any member can tag an idea', async () => {
  await set(bo, `takes = 'medium', setting = 'out'`);
  eq(await tagsOf(), { takes: 'medium', setting: 'out' });
});

await test('a new idea can be made with tags', async () => {
  const made = await as(db, bo, () =>
    one(db, `insert into ideas (group_id, list_id, title, added_by, takes, setting) values ($1, $2, 'Film night', $3, 'short', 'in') returning takes, setting`, [group, list, bo]));
  eq(made, { takes: 'short', setting: 'in' });
});

await test('one tag can be set without the other, and both can be taken away', async () => {
  await set(ann, `takes = 'long', setting = null`);
  eq(await tagsOf(), { takes: 'long', setting: null });
  await set(ann, `takes = null`);
  eq(await tagsOf(), { takes: null, setting: null });
});

await test('only the three lengths are accepted', async () => {
  for (const bad of ['', 'Short', 'quick', 'all day', '2']) {
    await rejects(set(ann, `takes = $2`, [bad]), /ideas_takes_check/, bad || 'empty');
  }
});

await test('only in or out is accepted', async () => {
  for (const bad of ['', 'In', 'home', 'outside', 'both']) {
    await rejects(set(ann, `setting = $2`, [bad]), /ideas_setting_check/, bad || 'empty');
  }
});

await test('someone outside the group cannot tag an idea', async () => {
  await set(zed, `takes = 'short', setting = 'in'`);
  eq(await tagsOf(), { takes: null, setting: null });
});

await test('running the update again changes nothing', async () => {
  await set(ann, `takes = 'short', setting = 'out'`);
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { REPO } = await import('./harness.mjs');
  await db.exec(fs.readFileSync(path.join(REPO, 'supabase', 'updates', UPDATE), 'utf8'));
  eq(await tagsOf(), { takes: 'short', setting: 'out' });
});
