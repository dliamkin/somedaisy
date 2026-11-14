// Database tests for the access rules in supabase/schema.sql: who can see and change what.
// Run with: npm run test:db
import { as, eq, freshDb, newUser, one, rejects, rows, test } from './harness.mjs';

const db = await freshDb();

// Ann and Bo share "Friends". Zed is a stranger with a group of his own.
const ann = await newUser(db, 'Ann');
const bo = await newUser(db, 'Bo');
const zed = await newUser(db, 'Zed');

const makeGroup = (user, name) => as(db, user, async () => (await one(db, `select create_group($1, 'sky', array['Food']) as id`, [name])).id);
const friends = await makeGroup(ann, 'Friends');
const zedsGroup = await makeGroup(zed, 'Zed only');
const { invite_code: code } = await one(db, `select invite_code from groups where id = $1`, [friends]);
await as(db, bo, () => db.query(`select join_group($1)`, [code]));
const { id: list } = await one(db, `select id from lists where group_id = $1`, [friends]);
const { id: zedsList } = await one(db, `select id from lists where group_id = $1`, [zedsGroup]);

const insertIdea = (user, group, listId, title, addedBy = user) =>
  as(db, user, async () =>
    (await one(db, `insert into ideas (group_id, list_id, title, added_by) values ($1, $2, $3, $4) returning id`, [group, listId, title, addedBy])).id);
const picnic = await insertIdea(ann, friends, list, 'Picnic');
const zedsIdea = await insertIdea(zed, zedsGroup, zedsList, 'Secret plan');
await as(db, ann, () => db.query(`insert into reactions (idea_id, group_id, user_id, emoji) values ($1, $2, $3, '👍')`, [picnic, friends, ann]));

const count = (user, sql, params = []) => as(db, user, async () => (await rows(db, sql, params)).length);

console.log('\nSeeing things');

await test('members see their group, its lists, ideas, reactions and members', async () => {
  for (const who of [ann, bo]) {
    eq(await count(who, `select 1 from groups where id = $1`, [friends]), 1, 'group');
    eq(await count(who, `select 1 from lists where group_id = $1`, [friends]), 1, 'lists');
    eq(await count(who, `select 1 from ideas where group_id = $1`, [friends]), 1, 'ideas');
    eq(await count(who, `select 1 from reactions where group_id = $1`, [friends]), 1, 'reactions');
    eq(await count(who, `select 1 from group_members where group_id = $1`, [friends]), 2, 'members');
  }
});

await test('a stranger sees none of it, including the invite code', async () => {
  eq(await count(zed, `select 1 from groups where id = $1`, [friends]), 0, 'group');
  eq(await count(zed, `select invite_code from groups`), 1, 'only his own group');
  eq(await count(zed, `select 1 from lists where group_id = $1`, [friends]), 0, 'lists');
  eq(await count(zed, `select 1 from ideas where group_id = $1`, [friends]), 0, 'ideas');
  eq(await count(zed, `select 1 from reactions where group_id = $1`, [friends]), 0, 'reactions');
  eq(await count(zed, `select 1 from group_members where group_id = $1`, [friends]), 0, 'members');
});

await test('someone who is not signed in sees nothing at all', async () => {
  for (const table of ['profiles', 'groups', 'group_members', 'lists', 'ideas', 'reactions']) {
    eq(await count(null, `select 1 from ${table}`), 0, table);
  }
});

await test('people see the names of those they share a group with, and nobody else', async () => {
  const seenBy = async (user) => (await as(db, user, () => rows(db, `select name from profiles order by name`))).map((r) => r.name);
  eq(await seenBy(ann), ['Ann', 'Bo']);
  eq(await seenBy(zed), ['Zed']);
});

console.log('\nGetting into a group');

await test('nobody can add themselves, or anyone else, to a group without its invite code', async () => {
  await rejects(as(db, zed, () => db.query(`insert into group_members (group_id, user_id) values ($1, $2)`, [friends, zed])), /row-level security/, 'self');
  await rejects(as(db, ann, () => db.query(`insert into group_members (group_id, user_id) values ($1, $2)`, [friends, zed])), /row-level security/, 'by a member');
  await rejects(as(db, zed, () => db.query(`select join_group('wrong-code')`)), /not valid/, 'wrong code');
});

await test('an invite code shows only the name and size of the group', async () => {
  const preview = await as(db, zed, () => rows(db, `select * from group_preview($1)`, [code]));
  eq(preview, [{ name: 'Friends', cover: 'sky', member_count: 2 }]);
});

await test('creating a group directly, bypassing the function, is refused', async () => {
  await rejects(as(db, zed, () => db.query(`insert into groups (name) values ('Sneaky')`)), /row-level security/);
});

await test('a member can leave, and cannot remove anyone else', async () => {
  const cy = await newUser(db, 'Cy');
  await as(db, cy, () => db.query(`select join_group($1)`, [code]));
  await as(db, cy, () => db.query(`delete from group_members where group_id = $1 and user_id = $2`, [friends, ann]));
  eq((await one(db, `select count(*)::int as n from group_members where group_id = $1`, [friends])).n, 3, 'Ann is still in');
  await as(db, cy, () => db.query(`delete from group_members where group_id = $1 and user_id = $2`, [friends, cy]));
  eq((await one(db, `select count(*)::int as n from group_members where group_id = $1`, [friends])).n, 2, 'Cy left');
  eq(await count(cy, `select 1 from ideas where group_id = $1`, [friends]), 0, 'and no longer sees the ideas');
});

console.log('\nChanging things');

await test('a stranger cannot add, edit or delete ideas in the group', async () => {
  await rejects(insertIdea(zed, friends, list, 'Graffiti'), /row-level security/, 'insert');
  await as(db, zed, () => db.query(`update ideas set title = 'Hacked' where id = $1`, [picnic]));
  await as(db, zed, () => db.query(`delete from ideas where id = $1`, [picnic]));
  eq((await one(db, `select title from ideas where id = $1`, [picnic])).title, 'Picnic');
});

await test('a member cannot add an idea in someone else\'s name', async () => {
  await rejects(insertIdea(bo, friends, list, 'Forged', ann), /row-level security/);
});

await test('a member cannot move an idea into a group they are not in', async () => {
  await rejects(as(db, ann, () => db.query(`update ideas set group_id = $2 where id = $1`, [picnic, zedsGroup])), /row-level security/);
});

await test('any member can set a date on an idea and mark it done', async () => {
  await as(db, bo, () => db.query(`update ideas set planned_for = now() + interval '3 days' where id = $1`, [picnic]));
  await as(db, bo, () => db.query(`update ideas set done_at = now() where id = $1`, [picnic]));
  const idea = await one(db, `select planned_for is not null as planned, done_at is not null as done from ideas where id = $1`, [picnic]);
  eq(idea, { planned: true, done: true });
  await db.query(`update ideas set planned_for = null, done_at = null where id = $1`, [picnic]);
});

await test('reactions can only be added and removed as yourself', async () => {
  await rejects(as(db, bo, () => db.query(`insert into reactions (idea_id, group_id, user_id, emoji) values ($1, $2, $3, '👎')`, [picnic, friends, ann])), /row-level security/, 'as Ann');
  await as(db, bo, () => db.query(`delete from reactions where idea_id = $1 and user_id = $2`, [picnic, ann]));
  eq((await one(db, `select count(*)::int as n from reactions where idea_id = $1 and user_id = $2`, [picnic, ann])).n, 1, "Ann's reaction survives");
});

await test('a stranger cannot react to an idea, even by naming their own group', async () => {
  await rejects(as(db, zed, () => db.query(`insert into reactions (idea_id, group_id, user_id, emoji) values ($1, $2, $3, '👍')`, [picnic, friends, zed])), /row-level security/, 'their group');
  await rejects(as(db, zed, () => db.query(`insert into reactions (idea_id, group_id, user_id, emoji) values ($1, $2, $3, '👍')`, [picnic, zedsGroup, zed])), /row-level security/, 'own group');
});

await test('people can change their own name and nobody else\'s', async () => {
  await as(db, ann, () => db.query(`update profiles set name = 'Annie' where id = $1`, [ann]));
  await as(db, ann, () => db.query(`update profiles set name = 'Bozo' where id = $1`, [bo]));
  eq((await rows(db, `select name from profiles where id in ($1, $2) order by name`, [ann, bo])).map((r) => r.name), ['Annie', 'Bo']);
  await db.query(`update profiles set name = 'Ann' where id = $1`, [ann]);
});

console.log('\nHow the app saves a reaction');

// The app saves a reaction with "insert, and do nothing if it is already there"
// (supabase-js upsert with ignoreDuplicates). These tests pin down why it must be that form.
const save = (user, emoji, onConflict) =>
  as(db, user, () =>
    db.query(
      `insert into reactions (idea_id, group_id, user_id, emoji) values ($1, $2, $3, $4)
       on conflict (idea_id, user_id, emoji) ${onConflict}`,
      [picnic, friends, user, emoji],
    ));
const reactionCount = async (user, emoji) =>
  (await one(db, `select count(*)::int as n from reactions where user_id = $1 and emoji = $2`, [user, emoji])).n;

await test('saving a new reaction works', async () => {
  await save(bo, '😍', 'do nothing');
  eq(await reactionCount(bo, '😍'), 1);
});

await test('saving the same reaction twice (a double tap, or a second device) does not fail', async () => {
  await save(bo, '😍', 'do nothing');
  eq(await reactionCount(bo, '😍'), 1);
});

await test('the "overwrite if already there" form is refused, because reactions cannot be edited', async () => {
  await rejects(save(bo, '😍', 'do update set group_id = excluded.group_id'), /row-level security/);
});
