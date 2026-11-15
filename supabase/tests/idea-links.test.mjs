// Database tests for supabase/updates/006-idea-links.sql. Run with: npm run test:db
import fs from 'node:fs';
import path from 'node:path';

import { as, eq, freshDb, newUser, one, REPO, rejects, rows, test } from './harness.mjs';

const UPDATE = '006-idea-links.sql';
const sql = fs.readFileSync(path.join(REPO, 'supabase/updates', UPDATE), 'utf8');

// Start without the update, so there can be ideas saved the old way for it to repair.
const db = await freshDb();

const ann = await newUser(db, 'Ann');
const bo = await newUser(db, 'Bo');
const zed = await newUser(db, 'Zed');

const makeGroup = (user, name) => as(db, user, async () => (await one(db, `select create_group($1, 'sky', array['Food', 'Movies']) as id`, [name])).id);
const group = await makeGroup(ann, 'Friends');
const zedsGroup = await makeGroup(zed, 'Zed only');
const { invite_code: code } = await one(db, `select invite_code from groups where id = $1`, [group]);
await as(db, bo, () => db.query(`select join_group($1)`, [code]));
const [{ id: food }, { id: movies }] = await rows(db, `select id from lists where group_id = $1 order by position`, [group]);
const { id: zedsList } = await one(db, `select id from lists where group_id = $1 order by position limit 1`, [zedsGroup]);

const addIdea = (user, title, { link = null, note = null, g = group, l = food } = {}) =>
  as(db, user, async () =>
    (await one(db, `insert into ideas (group_id, list_id, title, link, note, added_by) values ($1, $2, $3, $4, $5, $6) returning id`, [g, l, title, link, note, user])).id);
const linkOf = async (id) => (await one(db, `select link from ideas where id = $1`, [id])).link;

// Saved before the update, in the ways people really typed them.
const old = {
  fine: await addIdea(ann, 'Fine', { link: 'https://example.com/menu' }),
  bare: await addIdea(ann, 'Bare', { link: 'youtube.com/watch?v=abc' }),
  padded: await addIdea(ann, 'Padded', { link: '  https://example.com/a  ' }),
  empty: await addIdea(ann, 'Empty', { link: '   ' }),
  phone: await addIdea(ann, 'Phone', { link: 'tel:5551234' }),
  script: await addIdea(ann, 'Script', { link: 'javascript:alert(1)' }),
  huge: await addIdea(ann, 'Huge', { link: `https://example.com/${'a'.repeat(3000)}` }),
  longNote: await addIdea(ann, 'Long note', { note: 'n'.repeat(1500) }),
};

await db.exec(sql);

console.log('\nRepairing links saved before the update');

await test('a good link is left alone', async () => {
  eq(await linkOf(old.fine), 'https://example.com/menu');
});

await test('a link typed without https:// gets it', async () => {
  eq(await linkOf(old.bare), 'https://youtube.com/watch?v=abc');
});

await test('spaces around a link are trimmed, and an empty one becomes no link', async () => {
  eq(await linkOf(old.padded), 'https://example.com/a');
  eq(await linkOf(old.empty), null);
});

await test('a link that is not a web address, or is far too long, is removed', async () => {
  eq(await linkOf(old.phone), null);
  eq(await linkOf(old.script), null);
  eq(await linkOf(old.huge), null);
});

await test('a very long note is cut to the limit, and the idea itself is kept', async () => {
  const { n, title } = await one(db, `select char_length(note) as n, title from ideas where id = $1`, [old.longNote]);
  eq([n, title], [1000, 'Long note']);
});

await test('every idea is still there', async () => {
  eq((await one(db, `select count(*)::int as n from ideas where group_id = $1`, [group])).n, Object.keys(old).length);
});

console.log('\nThe limits on new and edited ideas');

await test('a web address is accepted, with http or https', async () => {
  eq(await linkOf(await addIdea(bo, 'Tacos', { link: 'https://example.com/tacos?x=1#menu' })), 'https://example.com/tacos?x=1#menu');
  eq(await linkOf(await addIdea(bo, 'Old site', { link: 'http://example.com' })), 'http://example.com');
});

await test('no link at all is fine', async () => {
  eq(await linkOf(await addIdea(bo, 'No link')), null);
});

await test('anything that is not a web address is refused', async () => {
  for (const bad of ['tel:5551234', 'javascript:alert(1)', 'example.com', 'intent://scan', 'https://exa mple.com', '']) {
    await rejects(addIdea(bo, 'Bad', { link: bad }), /ideas_link_check/, bad);
  }
});

await test('a link or note over the limit is refused', async () => {
  await rejects(addIdea(bo, 'Long', { link: `https://example.com/${'a'.repeat(2000)}` }), /ideas_link_check/, 'link');
  await rejects(addIdea(bo, 'Long', { note: 'n'.repeat(1001) }), /ideas_note_check/, 'note');
  eq((await one(db, `select char_length(note) as n from ideas where id = $1`, [await addIdea(bo, 'Just fits', { note: 'n'.repeat(1000) })])).n, 1000);
});

await test('editing a link has to follow the same rule', async () => {
  await rejects(as(db, bo, () => db.query(`update ideas set link = 'tel:5551234' where id = $1`, [old.fine])), /ideas_link_check/);
  await as(db, bo, () => db.query(`update ideas set link = 'https://example.com/new' where id = $1`, [old.fine]));
  eq(await linkOf(old.fine), 'https://example.com/new');
});

console.log('\nEditing and removing ideas');

await test('any member can change an idea and move it to another list in the group', async () => {
  await as(db, bo, () => db.query(`update ideas set title = 'Renamed', note = 'new note', list_id = $2 where id = $1`, [old.fine, movies]));
  eq(await one(db, `select title, note, list_id from ideas where id = $1`, [old.fine]), { title: 'Renamed', note: 'new note', list_id: movies });
});

await test('an idea cannot be put on another group\'s list', async () => {
  await rejects(as(db, bo, () => db.query(`update ideas set list_id = $2 where id = $1`, [old.fine, zedsList])), /not in this group/);
  await rejects(addIdea(bo, 'Stray', { l: zedsList }), /not in this group/);
});

await test('an idea cannot be moved to another group', async () => {
  await rejects(db.query(`update ideas set group_id = $2, list_id = $3 where id = $1`, [old.fine, zedsGroup, zedsList]), /another group/);
});

await test('planning and finishing an idea still work', async () => {
  await as(db, bo, () => db.query(`update ideas set planned_for = now() + interval '1 day' where id = $1`, [old.bare]));
  await as(db, bo, () => db.query(`update ideas set done_at = now() where id = $1`, [old.bare]));
  eq((await one(db, `select done_at is not null as done from ideas where id = $1`, [old.bare])).done, true);
});

await test('a stranger can neither change nor remove an idea', async () => {
  await as(db, zed, () => db.query(`update ideas set title = 'Hacked' where id = $1`, [old.fine]));
  await as(db, zed, () => db.query(`delete from ideas where id = $1`, [old.fine]));
  eq((await one(db, `select title from ideas where id = $1`, [old.fine])).title, 'Renamed');
});

await test('a member can remove an idea, and its reactions go with it', async () => {
  const doomed = await addIdea(ann, 'Doomed');
  await as(db, bo, () => db.query(`insert into reactions (idea_id, group_id, user_id, emoji) values ($1, $2, $3, '👍')`, [doomed, group, bo]));
  await as(db, bo, () => db.query(`delete from ideas where id = $1`, [doomed]));
  eq((await one(db, `select count(*)::int as n from ideas where id = $1`, [doomed])).n, 0);
  eq((await one(db, `select count(*)::int as n from reactions where idea_id = $1`, [doomed])).n, 0);
});

console.log('\nRunning the update twice');

await test('is harmless', async () => {
  const before = await rows(db, `select id, link, note from ideas order by id`);
  await db.exec(sql);
  eq(await rows(db, `select id, link, note from ideas order by id`), before);
});
