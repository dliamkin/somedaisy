// Database tests for supabase/updates/020-admin.sql. Run with: npm run test:db
import fs from 'node:fs';
import path from 'node:path';

import { as, eq, freshDb, one, rejects, REPO, rows, test } from './harness.mjs';

const UPDATE = '020-admin.sql';
// Everything before it, since it counts what the other updates added.
const BEFORE = fs.readdirSync(path.join(REPO, 'supabase/updates')).filter((file) => file.endsWith('.sql') && file < UPDATE).sort();

const db = await freshDb([...BEFORE, UPDATE]);
// The parts of Supabase's own table of sign-ins that the update reads.
await db.exec(`alter table auth.users add column if not exists is_anonymous boolean not null default false;
               alter table auth.users add column if not exists last_sign_in_at timestamptz;
               alter table auth.users add column if not exists raw_app_meta_data jsonb;`);

async function person(name, { email = null, guest = false, providers = ['email'] } = {}) {
  const { id } = await one(db, `insert into auth.users (email, is_anonymous, raw_app_meta_data) values ($1, $2, $3) returning id`, [
    email,
    guest,
    JSON.stringify(guest ? {} : { provider: providers[0], providers }),
  ]);
  if (name) await db.query(`insert into public.profiles (id, name) values ($1, $2)`, [id, name]);
  return id;
}
/** Let an account in the way the update's own instructions say to. Answers how many rows went in. */
const letIn = async (email) =>
  (await db.query(`insert into public.admins (user_id) select id from auth.users where lower(email) = lower($1) on conflict do nothing`, [email])).affectedRows;

// Olga runs the app, and signs in by email and with Google. Ann has an account, Bo is a guest,
// Zed keeps to himself, and one guest never picked a name.
const olga = await person('Olga', { email: 'Olga@Example.com', providers: ['email', 'google'] });
const ann = await person('Ann', { email: 'ann@example.com' });
const bo = await person('Bo', { guest: true });
const zed = await person('Zed', { email: 'zed@example.com' });
await person(null, { guest: true });

const makeGroup = (user, name) => as(db, user, async () => (await one(db, `select create_group($1, 'sky', array['Food', 'Movies']) as id`, [name])).id);
const friends = await makeGroup(ann, 'Friends');
const zeds = await makeGroup(zed, 'Zed only');
const { invite_code: code } = await one(db, `select invite_code from groups where id = $1`, [friends]);
await as(db, bo, () => db.query(`select join_group($1)`, [code]));
await as(db, olga, () => db.query(`select join_group($1)`, [code]));
const [{ id: food }] = await rows(db, `select id from lists where group_id = $1 order by position`, [friends]);
const { id: zedsList } = await one(db, `select id from lists where group_id = $1 order by position limit 1`, [zeds]);

const addIdea = (user, group, list, title, note = null) =>
  as(db, user, async () => (await one(db, `insert into ideas (group_id, list_id, title, note, added_by) values ($1, $2, $3, $4, $5) returning id`, [group, list, title, note, user])).id);
const picnic = await addIdea(ann, friends, food, 'Secret picnic', 'Bring the blue blanket');
const ramen = await addIdea(bo, friends, food, 'Ramen night');
await addIdea(zed, zeds, zedsList, 'Quiet walk');
await as(db, bo, () => db.query(`insert into reactions (idea_id, group_id, user_id, emoji) values ($1, $2, $3, '👍')`, [picnic, friends, bo]));
await as(db, ann, () => db.query(`insert into comments (idea_id, group_id, user_id, body) values ($1, $2, $3, 'Whispered words')`, [picnic, friends, ann]));
await as(db, ann, () => db.query(`update ideas set planned_for = now() + interval '3 days' where id = $1`, [ramen]));
await as(db, ann, () => db.query(`update ideas set done_at = now() where id = $1`, [picnic]));
await as(db, ann, () => db.query(`select register_push_token('ExponentPushToken[aaaaaaaaaaaa]', 'android', 'UTC')`));
await as(db, ann, () => db.query(`update groups set cover_style = $2 where id = $1`, [friends, JSON.stringify({ kind: 'look', background: '#4B2A8C', shape1: '#6D2FC4', shape2: '#B8339A', pattern: true })]));

// The database keeps the parts of an answer in an order of its own, so they are put in one order before comparing.
const inOrder = (value) =>
  Array.isArray(value) ? value.map(inOrder) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, inOrder(value[key])])) : value;
const same = (actual, expected, label) => eq(inOrder(actual), inOrder(expected), label);
const overview = (user) => as(db, user, async () => (await one(db, `select admin_overview() as o`)).o);
const people = (user, search = null, limit = 50, offset = 0) => as(db, user, () => rows(db, `select * from admin_people($1, $2, $3)`, [search, limit, offset]));
const groups = (user, sort = 'busy', search = null, limit = 50, offset = 0) => as(db, user, () => rows(db, `select * from admin_groups($1, $2, $3, $4)`, [sort, search, limit, offset]));
const personOf = (user, id) => as(db, user, async () => (await one(db, `select admin_person($1) as p`, [id])).p);
const groupOf = (user, id) => as(db, user, async () => (await one(db, `select admin_group($1) as g`, [id])).g);
const isAdmin = (user, options) => as(db, user, async () => (await one(db, `select is_admin() as yes`)).yes, options);
/** Everything the page can ask for, asked by one person. */
const everything = (user, options) => [
  ['the overview', () => as(db, user, () => db.query(`select admin_overview()`), options)],
  ['people', () => as(db, user, () => db.query(`select * from admin_people()`), options)],
  ['one person', () => as(db, user, () => db.query(`select admin_person($1)`, [ann]), options)],
  ['groups', () => as(db, user, () => db.query(`select * from admin_groups()`), options)],
  ['one group', () => as(db, user, () => db.query(`select admin_group($1)`, [friends]), options)],
];

console.log('\nThe admin page: who gets in');

await test('running the update lets nobody in', async () => {
  eq((await one(db, `select count(*)::int as n from admins`)).n, 0);
  for (const user of [olga, ann, zed]) eq(await isAdmin(user), false);
  eq(await isAdmin(bo, { guest: true }), false);
  eq(await isAdmin(null), false);
});

await test('everything the page asks for is refused to a member, a guest and someone not signed in', async () => {
  for (const [who, user, options] of [['a member', ann, {}], ['a guest', bo, { guest: true }], ['nobody', null, {}]]) {
    for (const [what, ask] of everything(user, options)) await rejects(ask(), /Not allowed/, `${what}, asked by ${who}`);
  }
});

await test('a visitor who is not signed in cannot even ask', async () => {
  await db.exec('set role anon');
  try {
    for (const sql of [`select is_admin()`, `select admin_overview()`, `select * from admin_people()`, `select * from admin_groups()`, `select admin_person('${ann}')`, `select admin_group('${friends}')`]) {
      await rejects(db.query(sql), /permission denied/, sql);
    }
  } finally {
    await db.exec('reset role');
  }
});

await test('the one line with an email lets that account in, whatever its capitals', async () => {
  eq(await letIn('nobody@example.com'), 0, 'an email nobody has');
  eq(await letIn('olga@example.com'), 1);
  eq(await letIn('OLGA@example.com'), 0, 'a second time');
  eq(await isAdmin(olga), true);
  for (const user of [ann, zed]) eq(await isAdmin(user), false);
  for (const [what, ask] of everything(olga)) {
    try {
      await ask();
    } catch (e) {
      throw new Error(`${what}: ${e.message}`);
    }
  }
});

await test('the app can neither read the list nor add to it, not even as an admin', async () => {
  for (const user of [ann, olga]) {
    eq(await as(db, user, () => rows(db, `select * from admins`)), []);
    await rejects(as(db, user, () => db.query(`insert into admins (user_id) values ($1)`, [ann])), /row-level security/, 'adding');
    await as(db, user, () => db.query(`delete from admins`));
  }
  eq((await rows(db, `select user_id from admins`)).map((r) => r.user_id), [olga]);
  eq(await isAdmin(ann), false);
});

await test('the app cannot call the helper that lists what everyone did', async () => {
  for (const user of [ann, olga]) await rejects(as(db, user, () => db.query(`select * from admin_activity()`)), /permission denied/);
});

await test('a guest is never an admin, even when the list names them', async () => {
  await db.query(`insert into admins (user_id) values ($1)`, [bo]);
  eq(await isAdmin(bo, { guest: true }), false);
  await rejects(as(db, bo, () => db.query(`select admin_overview()`), { guest: true }), /Not allowed/);
  await db.query(`delete from admins where user_id = $1`, [bo]);
});

console.log('\nThe admin page: what it shows');

await test('the overview counts people, groups and what they did', async () => {
  const o = await overview(olga);
  same(o.totals, { people: 4, accounts: 3, guests: 1, groups: 2, shared_groups: 1, ideas: 3, plans: 1, done: 1, reactions: 1, comments: 1, phones: 1 });
  same(o.week, { new_people: 4, new_groups: 2, active_people: 4, active_groups: 2, ideas: 3, done: 1 });
  same(o.funnel, { named: 4, in_group: 4, added_idea: 3, did_one: 3 });
  // Bo and Olga got into Friends with its invite.
  eq(o.invited, 2);
  same(o.covers, { classic: 1, look: 1, uploaded: 0, searched: 0 });
  eq(o.idea_pictures, 0);
});

await test('the overview has the last eight weeks, oldest first, ending with this one', async () => {
  const { weeks } = await overview(olga);
  eq(weeks.length, 8);
  eq(weeks.map((w) => w.start), [...weeks.map((w) => w.start)].sort());
  for (const week of weeks) eq(/^\d{4}-\d{2}-\d{2}$/.test(week.start), true, week.start);
  eq(new Date(`${weeks[7].start}T00:00:00Z`).getUTCDay(), 1, 'weeks start on Monday');
  same(weeks[7], { start: weeks[7].start, people: 4, groups: 2 });
  eq(weeks.slice(0, 7).every((w) => w.people === 0 && w.groups === 0), true);
});

await test('a group counts as lasting when it was still used four weeks after it was made', async () => {
  same((await overview(olga)).lasting, { old_groups: 0, still_used: 0 });
  // Friends was made six weeks ago and is still in use. Zed's was made then too, and nothing has happened in it since.
  await db.query(`update groups set created_at = now() - interval '42 days'`);
  await db.query(`update ideas set created_at = now() - interval '41 days' where group_id = $1`, [zeds]);
  await db.query(`update group_members set joined_at = now() - interval '42 days' where group_id = $1`, [zeds]);
  same((await overview(olga)).lasting, { old_groups: 2, still_used: 1 });
});

await test('cover photos and pictures on ideas are counted by kind', async () => {
  await db.query(`update groups set cover_style = $2 where id = $1`, [zeds, JSON.stringify({ kind: 'photo', background: '#CDEFE0', pattern: true, photo: { source: 'upload', path: `${zeds}/cover.jpg`, version: 1 } })]);
  await db.query(`update ideas set picture = $2 where id = $1`, [ramen, `${friends}/0f0e0d0c-0b0a-4908-8706-050403020100.jpg`]);
  const o = await overview(olga);
  same(o.covers, { classic: 0, look: 1, uploaded: 1, searched: 0 });
  eq(o.idea_pictures, 1);
});

await test('people are listed newest first, with how they sign in and what they have done', async () => {
  // Joined a day apart, so the order is certain.
  for (const [i, id] of [olga, ann, bo, zed].entries()) await db.query(`update profiles set created_at = now() - make_interval(days => $2) where id = $1`, [id, 10 - i]);
  const list = await people(olga);
  eq(list.map((p) => p.name), ['Zed', 'Bo', 'Ann', 'Olga']);
  eq(list.map((p) => Number(p.total)), [4, 4, 4, 4]);
  const byName = Object.fromEntries(list.map((p) => [p.name, p]));
  eq([byName.Olga.email, byName.Olga.guest, byName.Olga.google], ['Olga@Example.com', false, true]);
  eq([byName.Ann.email, byName.Ann.guest, byName.Ann.google, byName.Ann.groups, byName.Ann.ideas], ['ann@example.com', false, false, 1, 1]);
  eq([byName.Bo.email, byName.Bo.guest, byName.Bo.google, byName.Bo.groups, byName.Bo.ideas], [null, true, false, 1, 1]);
  eq(byName.Ann.last_active !== null, true);
  // Someone who never picked a name is not a person yet.
  eq(list.some((p) => p.name === null), false);
});

await test('people can be found by part of a name or of an email, and shown a few at a time', async () => {
  eq((await people(olga, ' an ')).map((p) => p.name), ['Ann']);
  eq((await people(olga, 'ZED@EXAMPLE')).map((p) => p.name), ['Zed']);
  eq((await people(olga, 'example.com')).map((p) => p.name), ['Zed', 'Ann', 'Olga']);
  eq(await people(olga, 'nobody at all'), []);
  // A percent sign or an underscore is looked for as itself.
  eq(await people(olga, '%'), []);
  eq(await people(olga, '_'), []);
  const firstTwo = await people(olga, null, 2, 0);
  eq([firstTwo.map((p) => p.name), Number(firstTwo[0].total)], [['Zed', 'Bo'], 4]);
  eq((await people(olga, null, 2, 2)).map((p) => p.name), ['Ann', 'Olga']);
  // Odd numbers are put right, not refused.
  eq((await people(olga, null, -5, -5)).length, 1);
  eq((await people(olga, null, 100000, 0)).length, 4);
});

await test('one person shows their groups, and nothing for someone who is not there', async () => {
  const p = await personOf(olga, ann);
  eq([p.name, p.email, p.guest, p.ideas, p.reactions, p.comments, p.phones], ['Ann', 'ann@example.com', false, 1, 0, 1, 1]);
  eq(p.groups.map((g) => [g.name, g.members, g.started]), [['Friends', 3, true]]);
  eq((await personOf(olga, bo)).groups.map((g) => [g.name, g.started]), [['Friends', false]]);
  eq(await personOf(olga, '0f0e0d0c-0b0a-4908-8706-050403020100'), null);
});

await test('groups can be put in order: busiest, newest or biggest', async () => {
  const busy = await groups(olga);
  eq(busy.map((g) => g.name), ['Friends', 'Zed only']);
  eq(busy.map((g) => Number(g.total)), [2, 2]);
  const [f, z] = busy;
  eq([f.members, f.ideas, f.done, f.points > 0, f.recent > 0], [3, 2, 1, true, true]);
  eq([z.members, z.ideas, z.done, z.points, z.recent], [1, 1, 0, 0, 0]);
  await db.query(`update groups set created_at = now() - interval '50 days' where id = $1`, [friends]);
  eq((await groups(olga, 'new')).map((g) => g.name), ['Zed only', 'Friends']);
  eq((await groups(olga, 'big')).map((g) => g.name), ['Friends', 'Zed only']);
  // An order nobody offers is the usual one.
  eq((await groups(olga, 'name; drop table groups')).map((g) => g.name), ['Friends', 'Zed only']);
  eq((await groups(olga, 'busy', 'zed')).map((g) => g.name), ['Zed only']);
  eq((await groups(olga, 'busy', null, 1, 1)).map((g) => g.name), ['Zed only']);
});

await test('one group shows its people and its lists, and nothing for a group that is not there', async () => {
  const g = await groupOf(olga, friends);
  eq([g.name, g.cover, g.ideas, g.plans, g.done, g.reactions, g.comments], ['Friends', 'look', 2, 1, 1, 1, 1]);
  eq(g.members.map((m) => [m.name, m.guest, m.started]), [['Ann', false, true], ['Bo', true, false], ['Olga', false, false]]);
  eq(g.lists.map((l) => [l.name, l.ideas]), [['Food', 2], ['Movies', 0]]);
  eq((await groupOf(olga, zeds)).cover, 'upload');
  eq(await groupOf(olga, '0f0e0d0c-0b0a-4908-8706-050403020100'), null);
});

await test('nothing the page is given has the words of an idea, a note or a comment in it', async () => {
  const given = JSON.stringify([await overview(olga), await people(olga), await groups(olga), await personOf(olga, ann), await groupOf(olga, friends)]);
  for (const words of ['Secret picnic', 'Ramen night', 'blue blanket', 'Whispered words', 'ExponentPushToken', 'cover.jpg']) eq(given.includes(words), false, words);
  // What it is meant to have.
  for (const words of ['Friends', 'ann@example.com', 'Food']) eq(given.includes(words), true, words);
});

console.log('\nThe admin page: taking it away again');

await test('running the update twice keeps the list and the rules', async () => {
  await db.exec(fs.readFileSync(path.join(REPO, 'supabase/updates', UPDATE), 'utf8'));
  eq(await isAdmin(olga), true);
  eq(await isAdmin(ann), false);
  await rejects(as(db, ann, () => db.query(`select admin_overview()`)), /Not allowed/);
  // On Supabase the app is not even allowed to look at the list. (The first time round, this test's
  // stand-in for Supabase hands that right back afterwards, and the rules alone keep the list shut.)
  for (const user of [ann, olga]) await rejects(as(db, user, () => db.query(`select * from admins`)), /permission denied/);
});

await test('someone taken off the list is shut out at once', async () => {
  await db.query(`delete from admins where user_id in (select id from auth.users where lower(email) = lower('olga@example.com'))`);
  eq(await isAdmin(olga), false);
  for (const [what, ask] of everything(olga)) await rejects(ask(), /Not allowed/, what);
});

await test('an admin whose account is deleted leaves the list', async () => {
  await letIn('zed@example.com');
  eq(await isAdmin(zed), true);
  await db.query(`delete from auth.users where id = $1`, [zed]);
  eq((await one(db, `select count(*)::int as n from admins`)).n, 0);
});
