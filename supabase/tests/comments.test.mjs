// Database tests for supabase/updates/003-comments.sql. Run with: npm run test:db
import fs from 'node:fs';
import path from 'node:path';

import { as, eq, freshDb, newUser, one, REPO, rejects, rows, test } from './harness.mjs';

const UPDATE = '003-comments.sql';
const db = await freshDb(['001-push-notifications.sql', '002-account-transfer.sql', UPDATE]);

// Ann, Bo and Cy share "Friends". Zed is a stranger with a group of his own.
const ann = await newUser(db, 'Ann');
const bo = await newUser(db, 'Bo');
const cy = await newUser(db, 'Cy');
const zed = await newUser(db, 'Zed');

const makeGroup = (user, name) => as(db, user, async () => (await one(db, `select create_group($1, 'sky', array['Food']) as id`, [name])).id);
const group = await makeGroup(ann, 'Friends');
const zedsGroup = await makeGroup(zed, 'Zed only');
const { invite_code: code } = await one(db, `select invite_code from groups where id = $1`, [group]);
await as(db, bo, () => db.query(`select join_group($1)`, [code]));
await as(db, cy, () => db.query(`select join_group($1)`, [code]));
const { id: list } = await one(db, `select id from lists where group_id = $1`, [group]);
const { id: zedsList } = await one(db, `select id from lists where group_id = $1`, [zedsGroup]);

for (const [user, name] of [[ann, 'ann'], [bo, 'bo'], [cy, 'cy'], [zed, 'zed']]) {
  await as(db, user, () => db.query(`select register_push_token($1, 'ios', 'UTC')`, [`ExponentPushToken[${name}-phone]`]));
}

const addIdea = (user, title, g = group, l = list) =>
  as(db, user, async () =>
    (await one(db, `insert into ideas (group_id, list_id, title, added_by) values ($1, $2, $3, $4) returning id`, [g, l, title, user])).id);
const comment = (user, idea, body, { g = group, author = user, opts } = {}) =>
  as(db, user, async () =>
    (await one(db, `insert into comments (idea_id, group_id, user_id, body) values ($1, $2, $3, $4) returning id`, [idea, g, author, body])).id, opts);
const sent = async () => {
  const calls = await rows(db, `select body from net.calls order by id`);
  await db.exec(`delete from net.calls`);
  return calls.flatMap((c) => c.body);
};
const count = (user, sql, params = []) => as(db, user, async () => (await rows(db, sql, params)).length);
// Make every comment so far look older than the "one push per burst" window.
const later = () => db.exec(`update comments set created_at = created_at - interval '11 minutes'`);

const picnic = await addIdea(ann, 'Picnic');
const zedsIdea = await addIdea(zed, 'Secret plan', zedsGroup, zedsList);

console.log('\nWho can comment, and who can read');

let first;
await test('a member can comment on an idea, and every member can read it', async () => {
  first = await comment(bo, picnic, 'I can bring a blanket');
  for (const who of [ann, bo, cy]) eq(await count(who, `select 1 from comments where idea_id = $1`, [picnic]), 1);
  await sent();
});

await test('running the update a second time keeps the comments and does not fail', async () => {
  await db.exec(fs.readFileSync(path.join(REPO, 'supabase/updates', UPDATE), 'utf8'));
  eq((await one(db, `select count(*)::int as n from comments`)).n, 1);
});

await test('a stranger, or someone not signed in, sees no comments', async () => {
  eq(await count(zed, `select 1 from comments`), 0, 'stranger');
  eq(await count(null, `select 1 from comments`), 0, 'signed out');
});

await test('a stranger cannot comment on a group\'s idea', async () => {
  await rejects(comment(zed, picnic, 'Hello'), /row-level security/, 'in their group');
  await rejects(comment(zed, picnic, 'Hello', { g: zedsGroup }), /row-level security/, 'filed under his own group');
});

await test('nobody can comment in someone else\'s name', async () => {
  await rejects(comment(bo, picnic, 'Ann says yes', { author: ann }), /row-level security/);
});

await test('an empty comment, or one over 500 characters, is refused', async () => {
  await rejects(comment(bo, picnic, ''), /check constraint/, 'empty');
  await rejects(comment(bo, picnic, 'x'.repeat(501)), /check constraint/, 'too long');
});

await test('you can remove your own comment and nobody else\'s, and none can be edited', async () => {
  await as(db, ann, () => db.query(`delete from comments where id = $1`, [first]));
  await as(db, ann, () => db.query(`update comments set body = 'Edited' where id = $1`, [first]));
  eq((await one(db, `select body from comments where id = $1`, [first])).body, 'I can bring a blanket', 'untouched by Ann');
  await as(db, bo, () => db.query(`update comments set body = 'Edited' where id = $1`, [first]));
  eq((await one(db, `select body from comments where id = $1`, [first])).body, 'I can bring a blanket', 'no editing, even your own');
  await as(db, bo, () => db.query(`delete from comments where id = $1`, [first]));
  eq((await one(db, `select count(*)::int as n from comments where id = $1`, [first])).n, 0, 'removed by Bo');
});

await test('removing an idea removes its comments', async () => {
  const temp = await addIdea(ann, 'Temp');
  await comment(bo, temp, 'Soon gone');
  await as(db, ann, () => db.query(`delete from ideas where id = $1`, [temp]));
  eq((await one(db, `select count(*)::int as n from comments where idea_id = $1`, [temp])).n, 0);
  await sent();
});

console.log('\nNotifications');
await later();

await test('a comment tells only the person who added the idea', async () => {
  await comment(bo, picnic, 'Saturday works for me');
  const pushes = await sent();
  eq(pushes.map((p) => p.to), ['ExponentPushToken[ann-phone]']);
  eq(pushes[0].title, 'Friends');
  eq(pushes[0].body, 'Bo commented on Picnic: Saturday works for me');
  eq(pushes[0].data, { url: `/group/${group}` });
});

await test('commenting on your own idea sends nothing', async () => {
  await later();
  await comment(ann, picnic, 'Great!');
  eq(await sent(), []);
});

await test('more comments from the same person straight after stay quiet', async () => {
  await later();
  await comment(bo, picnic, 'One');
  eq((await sent()).length, 1, 'first of the burst');
  await comment(bo, picnic, 'Two');
  await comment(bo, picnic, 'Three');
  eq(await sent(), [], 'rest of the burst');
});

await test('but once the idea\'s owner has answered, the next comment is told again', async () => {
  await comment(ann, picnic, 'Sounds good');
  await comment(bo, picnic, 'Four');
  eq((await sent()).map((p) => p.body), ['Bo commented on Picnic: Four']);
});

await test('a different person commenting is its own push', async () => {
  await comment(cy, picnic, 'Count me in');
  eq((await sent()).map((p) => p.body), ['Cy commented on Picnic: Count me in']);
});

await test('a very long comment is cut to fit a notification', async () => {
  await later();
  await comment(cy, picnic, 'y'.repeat(500));
  const [push] = await sent();
  eq(push.body.length, 240);
});

await test('turning comments off stops them without touching the other choices', async () => {
  await later();
  await as(db, ann, () => db.query(`select set_notification_settings(true, false, false)`));
  await comment(bo, picnic, 'Anyone there?');
  eq(await sent(), [], 'off');
  eq(await rows(db, `select reactions, reminders, comments from notification_settings where user_id = $1`, [ann]),
    [{ reactions: true, reminders: false, comments: false }]);
});

await test('an older copy of the app, which knows two choices, saves them and leaves comments as it was', async () => {
  await as(db, ann, () => db.query(`select set_notification_settings(false, true)`));
  eq(await rows(db, `select reactions, reminders, comments from notification_settings where user_id = $1`, [ann]),
    [{ reactions: false, reminders: true, comments: false }]);
  await as(db, ann, () => db.query(`select set_notification_settings(true, true, true)`));
  await later();
  await comment(bo, picnic, 'Back on');
  eq((await sent()).length, 1, 'on again');
});

await test('someone choosing for the first time from an older copy gets comments on', async () => {
  await as(db, cy, () => db.query(`select set_notification_settings(true, true)`));
  eq(await rows(db, `select comments from notification_settings where user_id = $1`, [cy]), [{ comments: true }]);
});

await test('someone who has left the group hears nothing about the ideas they left behind', async () => {
  const eve = await newUser(db, 'Eve');
  await as(db, eve, () => db.query(`select join_group($1)`, [code]));
  await as(db, eve, () => db.query(`select register_push_token('ExponentPushToken[eve-phone]', 'ios', 'UTC')`));
  const sailing = await addIdea(eve, 'Sailing');
  await db.query(`delete from group_members where group_id = $1 and user_id = $2`, [group, eve]);
  await comment(bo, sailing, 'Still on?');
  eq(await sent(), []);
});

await test('the comment is still saved when the push cannot be queued', async () => {
  await later();
  await db.query(`select set_config('test.net_broken', 'on', false)`);
  const id = await comment(bo, picnic, 'Is this thing on?');
  await db.query(`select set_config('test.net_broken', 'off', false)`);
  eq((await one(db, `select body from comments where id = $1`, [id])).body, 'Is this thing on?');
  eq(await sent(), []);
});

console.log('\nMoving a guest into an account');

await test('a guest\'s comments move to the account with their groups', async () => {
  const GUEST = { guest: true };
  const guest = await newUser(db, 'Bo (new phone)');
  await as(db, guest, () => db.query(`select join_group($1)`, [code]), GUEST);
  const written = await comment(guest, picnic, 'Written as a guest', { opts: GUEST });
  await sent();
  const pass = await as(db, guest, async () => (await one(db, `select start_transfer() as pass`)).pass, GUEST);
  await as(db, bo, () => db.query(`select claim_transfer($1)`, [pass]));
  eq((await one(db, `select user_id from comments where id = $1`, [written])).user_id, bo);
  eq((await one(db, `select count(*)::int as n from profiles where id = $1`, [guest])).n, 0, 'guest removed');
  eq(await sent(), [], 'no stray notifications');
});
