// Database tests for supabase/updates/010-notification-polish.sql. Run with: npm run test:db
import fs from 'node:fs';
import path from 'node:path';

import { as, eq, freshDb, newUser, one, REPO, rejects, rows, test } from './harness.mjs';

const UPDATE = '010-notification-polish.sql';
const BEFORE = ['001-push-notifications.sql', '002-account-transfer.sql', '003-comments.sql'];

// Ann and Bo share "Friends" and "Book club". Zed is a stranger. Everyone has a phone registered.
async function world() {
  const db = await freshDb([...BEFORE, UPDATE]);
  const ann = await newUser(db, 'Ann');
  const bo = await newUser(db, 'Bo');
  const zed = await newUser(db, 'Zed');
  const makeGroup = async (name) => {
    const id = await as(db, ann, async () => (await one(db, `select create_group($1, 'sky', array['Food']) as id`, [name])).id);
    const { invite_code: code } = await one(db, `select invite_code from groups where id = $1`, [id]);
    await as(db, bo, () => db.query(`select join_group($1)`, [code]));
    const { id: list } = await one(db, `select id from lists where group_id = $1`, [id]);
    return { id, list };
  };
  const friends = await makeGroup('Friends');
  const club = await makeGroup('Book club');
  for (const [user, name] of [[ann, 'ann'], [bo, 'bo'], [zed, 'zed']]) {
    await as(db, user, () => db.query(`select register_push_token($1, 'android', 'UTC')`, [`ExponentPushToken[${name}-phone]`]));
  }
  const addIdea = (user, group, title) => as(db, user, async () =>
    (await one(db, `insert into ideas (group_id, list_id, title, added_by) values ($1, $2, $3, $4) returning id`, [group.id, group.list, title, user])).id);
  const react = (user, group, idea, emoji = '👍') => as(db, user, () =>
    db.query(`insert into reactions (idea_id, group_id, user_id, emoji) values ($1, $2, $3, $4)`, [idea, group.id, user, emoji]));
  const comment = (user, group, idea, body) => as(db, user, () =>
    db.query(`insert into comments (idea_id, group_id, user_id, body) values ($1, $2, $3, $4)`, [idea, group.id, user, body]));
  const mute = (user, group, muted = true) => as(db, user, () => db.query(`select set_group_muted($1, $2)`, [group.id, muted]));
  // The pushes queued since the last look.
  const sent = async () => {
    const calls = await rows(db, `select body from net.calls order by id`);
    await db.exec(`delete from net.calls`);
    return calls.flatMap((c) => c.body);
  };
  const to = (pushes) => pushes.map((p) => p.to.replace(/ExponentPushToken\[(.*)-phone\]/, '$1')).sort();
  return { db, ann, bo, zed, friends, club, addIdea, react, comment, mute, sent, to };
}

console.log('\nMuting a group');

await test('a muted group sends that person no reaction or comment notifications', async () => {
  const w = await world();
  const picnic = await w.addIdea(w.ann, w.friends, 'Picnic');
  await w.mute(w.ann, w.friends);
  await w.react(w.bo, w.friends, picnic);
  await w.comment(w.bo, w.friends, picnic, 'Yes!');
  eq(await w.sent(), []);
});

await test('their other groups still notify them', async () => {
  const w = await world();
  const novel = await w.addIdea(w.ann, w.club, 'Read a novel');
  await w.mute(w.ann, w.friends);
  await w.react(w.bo, w.club, novel);
  eq(w.to(await w.sent()), ['ann']);
});

await test('other members of a muted group still get theirs', async () => {
  const w = await world();
  const bowling = await w.addIdea(w.bo, w.friends, 'Bowling');
  await w.mute(w.ann, w.friends);
  await w.react(w.ann, w.friends, bowling);
  eq(w.to(await w.sent()), ['bo']);
});

await test('a plan reminder skips the people who muted the group', async () => {
  const w = await world();
  const picnic = await w.addIdea(w.ann, w.friends, 'Picnic');
  await w.db.query(`update ideas set planned_for = now() + interval '1 hour' where id = $1`, [picnic]);
  await w.mute(w.ann, w.friends);
  eq((await one(w.db, `select send_plan_reminders() as n`)).n, 1);
  eq(w.to(await w.sent()), ['bo']);
});

await test('unmuting brings the notifications back', async () => {
  const w = await world();
  const picnic = await w.addIdea(w.ann, w.friends, 'Picnic');
  await w.mute(w.ann, w.friends);
  await w.mute(w.ann, w.friends, false);
  await w.react(w.bo, w.friends, picnic);
  eq(w.to(await w.sent()), ['ann']);
});

await test('you can mute only your own membership, and only in a group you are in', async () => {
  const w = await world();
  await rejects(w.mute(w.zed, w.friends), /not in that group/);
  await w.mute(w.bo, w.friends);
  eq(await rows(w.db, `select p.name, m.muted from group_members m join profiles p on p.id = m.user_id where m.group_id = $1 order by p.name`, [w.friends.id]),
    [{ name: 'Ann', muted: false }, { name: 'Bo', muted: true }]);
  // Not by changing the row directly either: members have no way to edit memberships.
  await as(w.db, w.bo, () => w.db.query(`update group_members set muted = true where group_id = $1`, [w.friends.id]));
  eq((await one(w.db, `select muted from group_members where group_id = $1 and user_id = $2`, [w.friends.id, w.ann])).muted, false);
});

console.log('\nWhat a notification carries');

await test('a comment notification says which idea, so the app can open its comments', async () => {
  const w = await world();
  const picnic = await w.addIdea(w.ann, w.friends, 'Picnic');
  await w.comment(w.bo, w.friends, picnic, 'Yes!');
  const [push] = await w.sent();
  eq(push.data, { url: `/group/${w.friends.id}`, idea: picnic });
  eq(push.body, 'Bo commented on Picnic: Yes!');
});

await test('a reaction notification and a reminder open the group, as before', async () => {
  const w = await world();
  const picnic = await w.addIdea(w.ann, w.friends, 'Picnic');
  await w.react(w.bo, w.friends, picnic);
  eq((await w.sent())[0].data, { url: `/group/${w.friends.id}` });
  await w.db.query(`update ideas set planned_for = now() + interval '1 hour' where id = $1`, [picnic]);
  await w.db.query(`select send_plan_reminders()`);
  const reminders = await w.sent();
  eq(reminders.length, 2);
  eq(reminders[0].data, { url: `/group/${w.friends.id}` });
});

await test('the app still cannot send notifications itself', async () => {
  const w = await world();
  await rejects(as(w.db, w.zed, () => w.db.query(`select push_send(array[$1]::uuid[], $2, 'Hi', 'Spam')`, [w.ann, w.friends.id])), /permission denied/);
  eq(await w.sent(), []);
});

await test('a failure to send still does not undo the comment', async () => {
  const w = await world();
  const picnic = await w.addIdea(w.ann, w.friends, 'Picnic');
  await w.db.query(`select set_config('test.net_broken', 'on', false)`);
  await w.comment(w.bo, w.friends, picnic, 'Yes!');
  await w.db.query(`select set_config('test.net_broken', 'off', false)`);
  eq((await one(w.db, `select count(*)::int as n from comments`)).n, 1);
});

console.log('\nRunning the update twice');

await test('is harmless, and keeps who has muted what', async () => {
  const w = await world();
  await w.mute(w.ann, w.friends);
  await w.db.exec(fs.readFileSync(path.join(REPO, 'supabase/updates', UPDATE), 'utf8'));
  const picnic = await w.addIdea(w.ann, w.friends, 'Picnic');
  await w.react(w.bo, w.friends, picnic);
  eq(await w.sent(), []);
  eq((await one(w.db, `select count(*)::int as n from pg_proc where proname = 'push_send'`)).n, 1, 'one push_send, not two');
});
