// Database tests for supabase/updates/001-push-notifications.sql. Run with: npm run test:db
import fs from 'node:fs';
import path from 'node:path';

import { as, eq, freshDb, newUser, one, REPO, rejects, rows, test } from './harness.mjs';

const UPDATE = '001-push-notifications.sql';
const db = await freshDb([UPDATE]);

// Ann and Bo share "Friends"; Cy joins later. Dee is an outsider with her own phone.
const ann = await newUser(db, 'Ann');
const bo = await newUser(db, 'Bo');
const cy = await newUser(db, 'Cy');
const dee = await newUser(db, 'Dee');

const group = await as(db, ann, async () => (await one(db, `select create_group('Friends', 'sky', array['Food']) as id`)).id);
const { invite_code: code } = await one(db, `select invite_code from groups where id = $1`, [group]);
await as(db, bo, () => db.query(`select join_group($1)`, [code]));
const { id: list } = await one(db, `select id from lists where group_id = $1`, [group]);

const register = (user, token, tz = 'America/New_York') =>
  as(db, user, () => db.query(`select register_push_token($1, 'ios', $2)`, [token, tz]));
await register(ann, 'ExponentPushToken[ann-phone]');
await register(bo, 'ExponentPushToken[bo-phone]', 'Europe/London');
await register(dee, 'ExponentPushToken[dee-phone]');

const sent = async () => {
  const calls = await rows(db, `select url, body from net.calls order by id`);
  await db.exec(`delete from net.calls`);
  return calls.flatMap((c) => c.body);
};
const addIdea = (user, title) =>
  as(db, user, async () =>
    (await one(db, `insert into ideas (group_id, list_id, title, added_by) values ($1, $2, $3, $4) returning id`, [group, list, title, user])).id);
const thumb = (user, idea, emoji = '👍') =>
  as(db, user, () => db.query(`insert into reactions (idea_id, group_id, user_id, emoji) values ($1, $2, $3, $4)`, [idea, group, user, emoji]));

console.log('\nRegistering phones');

await test('running the update a second time changes nothing and does not fail', async () => {
  await db.exec(fs.readFileSync(path.join(REPO, 'supabase/updates', UPDATE), 'utf8'));
  eq((await one(db, `select count(*)::int as n from push_tokens`)).n, 3);
});

await test('a person sees only their own phones', async () => {
  const mine = await as(db, ann, () => rows(db, `select token from push_tokens`));
  eq(mine, [{ token: 'ExponentPushToken[ann-phone]' }]);
});

await test('the app cannot write the phone table directly', async () => {
  await rejects(as(db, ann, () => db.query(`insert into push_tokens (token, user_id) values ('ExponentPushToken[sneaky]', $1)`, [bo])), /row-level security/, 'insert');
  await as(db, ann, () => db.query(`delete from push_tokens where user_id = $1`, [bo]));
  eq((await one(db, `select count(*)::int as n from push_tokens where user_id = $1`, [bo])).n, 1, "Bo's phone survives Ann's delete");
});

await test('an unknown time zone falls back to UTC instead of failing', async () => {
  await register(dee, 'ExponentPushToken[dee-tablet]', 'Mars/Olympus_Mons');
  eq((await one(db, `select timezone from push_tokens where token = 'ExponentPushToken[dee-tablet]'`)).timezone, 'UTC');
});

await test('a phone moves to whoever signs in on it last, and signing out removes only your own', async () => {
  await register(cy, 'ExponentPushToken[shared]');
  await register(dee, 'ExponentPushToken[shared]');
  eq((await one(db, `select user_id from push_tokens where token = 'ExponentPushToken[shared]'`)).user_id, dee);
  await as(db, cy, () => db.query(`select unregister_push_token('ExponentPushToken[shared]')`));
  eq((await one(db, `select count(*)::int as n from push_tokens where token = 'ExponentPushToken[shared]'`)).n, 1, 'Cy cannot remove it');
  await as(db, dee, () => db.query(`select unregister_push_token('ExponentPushToken[shared]')`));
  eq((await one(db, `select count(*)::int as n from push_tokens where token = 'ExponentPushToken[shared]'`)).n, 0, 'Dee can');
});

await test('someone with no name yet, or not signed in, cannot register', async () => {
  const nameless = await newUser(db, null);
  await rejects(as(db, nameless, () => db.query(`select register_push_token('ExponentPushToken[x-phone]', 'ios', 'UTC')`)), /Set your name first/);
  await rejects(as(db, null, () => db.query(`select register_push_token('ExponentPushToken[y-phone]', 'ios', 'UTC')`)), /Not signed in/);
});

await test('the app cannot send pushes or run reminders itself', async () => {
  await rejects(as(db, ann, () => db.query(`select push_to_group($1, null, 'Hi', 'Spam')`, [group])), /permission denied/, 'push_to_group');
  await rejects(as(db, ann, () => db.query(`select send_plan_reminders()`)), /permission denied/, 'send_plan_reminders');
});

console.log('\nNew ideas');
await db.exec(`delete from net.calls`);

let picnic;
await test('adding an idea tells the other members, not the author and not outsiders', async () => {
  picnic = await addIdea(ann, 'Picnic');
  const pushes = await sent();
  eq(pushes.map((p) => p.to), ['ExponentPushToken[bo-phone]']);
  eq(pushes[0].title, 'Friends');
  eq(pushes[0].body, 'Ann added an idea: Picnic');
  eq(pushes[0].data, { url: `/group/${group}` });
  eq(pushes[0].channelId, 'default');
});

await test('the request goes to the Expo push service as JSON', async () => {
  await addIdea(bo, 'Bowling');
  const call = await one(db, `select url, headers from net.calls order by id desc limit 1`);
  eq(call.url, 'https://exp.host/--/api/v2/push/send');
  eq(call.headers['Content-Type'], 'application/json');
  await sent();
});

await test('a member with two phones gets it on both', async () => {
  await register(bo, 'ExponentPushToken[bo-tablet]', 'Europe/London');
  await addIdea(ann, 'Museum');
  eq((await sent()).map((p) => p.to).sort(), ['ExponentPushToken[bo-phone]', 'ExponentPushToken[bo-tablet]']);
  await as(db, bo, () => db.query(`select unregister_push_token('ExponentPushToken[bo-tablet]')`));
});

await test('the idea is still saved when the push cannot be queued', async () => {
  await db.query(`select set_config('test.net_broken', 'on', false)`);
  const id = await addIdea(ann, 'Karaoke');
  await db.query(`select set_config('test.net_broken', 'off', false)`);
  eq((await one(db, `select title from ideas where id = $1`, [id])).title, 'Karaoke');
  eq(await sent(), []);
});

console.log("\nEveryone's in");

await test('nothing is sent until the last thumbs up, then the others are told', async () => {
  await thumb(ann, picnic);
  eq(await sent(), [], 'after the first thumbs up');
  await thumb(bo, picnic, '🍿');
  eq(await sent(), [], 'other emoji do not count');
  await thumb(bo, picnic);
  const pushes = await sent();
  eq(pushes.map((p) => p.to), ['ExponentPushToken[ann-phone]']);
  eq(pushes[0].body, 'You are both in for Picnic. Pick a date!');
});

await test('with three members it waits for all three and says "everyone"', async () => {
  await as(db, cy, () => db.query(`select join_group($1)`, [code]));
  await register(cy, 'ExponentPushToken[cy-phone]', 'Asia/Tokyo');
  const hike = await addIdea(ann, 'Hike');
  await sent();
  await thumb(ann, hike);
  await thumb(bo, hike);
  eq(await sent(), [], 'two of three');
  await thumb(cy, hike);
  const pushes = await sent();
  eq(pushes.map((p) => p.to).sort(), ['ExponentPushToken[ann-phone]', 'ExponentPushToken[bo-phone]']);
  eq(pushes[0].body, "Everyone's in for Hike. Pick a date!");
});

await test('a group of one never gets an "everyone\'s in" push', async () => {
  const solo = await as(db, dee, async () => (await one(db, `select create_group('Solo', 'sky', array['Stuff']) as id`)).id);
  const { id: soloList } = await one(db, `select id from lists where group_id = $1`, [solo]);
  await as(db, dee, async () => {
    const { id } = await one(db, `insert into ideas (group_id, list_id, title, added_by) values ($1, $2, 'Nap', $3) returning id`, [solo, soloList, dee]);
    await db.query(`insert into reactions (idea_id, group_id, user_id, emoji) values ($1, $2, $3, '👍')`, [id, solo, dee]);
  });
  eq(await sent(), []);
});

console.log('\nPicking a date');

// A fixed moment: 21 Nov 2026, midnight UTC = 7:00 PM on the 20th in New York, 9:00 AM on the 21st in Tokyo.
const farDate = '2026-11-21T00:00:00Z';

await test('picking a date tells the others, each in their own time zone', async () => {
  await db.query(`update ideas set planned_for = null where id = $1`, [picnic]);
  await sent();
  await as(db, bo, () => db.query(`update ideas set planned_for = $2 where id = $1`, [picnic, farDate]));
  const pushes = await sent();
  const byPhone = Object.fromEntries(pushes.map((p) => [p.to, p.body]));
  eq(byPhone, {
    'ExponentPushToken[ann-phone]': 'Bo picked a date for Picnic: Fri 20 Nov, 7:00 PM',
    'ExponentPushToken[cy-phone]': 'Bo picked a date for Picnic: Sat 21 Nov, 9:00 AM',
  });
});

await test('saving the same date again, removing it, or marking it done sends nothing', async () => {
  await as(db, ann, () => db.query(`update ideas set planned_for = $2 where id = $1`, [picnic, farDate]));
  eq(await sent(), [], 'same date');
  await as(db, ann, () => db.query(`update ideas set title = 'Big picnic' where id = $1`, [picnic]));
  eq(await sent(), [], 'other edit');
  await as(db, ann, () => db.query(`update ideas set planned_for = null where id = $1`, [picnic]));
  eq(await sent(), [], 'date removed');
  await as(db, ann, () => db.query(`update ideas set planned_for = $2, done_at = now() where id = $1`, [picnic, farDate]));
  eq(await sent(), [], 'done');
  await db.query(`update ideas set done_at = null, planned_for = null, title = 'Picnic' where id = $1`, [picnic]);
  await sent();
});

console.log('\nReminders');

const plan = (idea, when) => db.query(`update ideas set planned_for = ${when} where id = $1`, [idea]);
const remind = async () => (await one(db, `select send_plan_reminders() as n`)).n;
const reminded = async (idea) => (await one(db, `select reminded_at from ideas where id = $1`, [idea])).reminded_at !== null;

await test('a plan more than two hours away is not reminded yet', async () => {
  await plan(picnic, `now() + interval '5 hours'`);
  await sent();
  eq(await remind(), 0);
  eq(await sent(), []);
  eq(await reminded(picnic), false);
});

await test('once it is within two hours, every member is reminded exactly once', async () => {
  // Move the clock forward by moving the plan: set it directly so the "date picked" trigger logic is bypassed.
  await db.exec(`alter table ideas disable trigger ideas_reset_reminder`);
  await plan(picnic, `now() + interval '90 minutes'`);
  await db.exec(`alter table ideas enable trigger ideas_reset_reminder`);
  await sent();
  eq(await remind(), 1);
  const pushes = await sent();
  eq(pushes.map((p) => p.to).sort(), ['ExponentPushToken[ann-phone]', 'ExponentPushToken[bo-phone]', 'ExponentPushToken[cy-phone]']);
  if (!/^Picnic is coming up at \d{1,2}:\d{2} (AM|PM)$/.test(pushes[0].body)) throw new Error(`unexpected body: ${pushes[0].body}`);
  eq(pushes[0].title, 'Friends');
  eq(await remind(), 0, 'second run');
  eq(await sent(), [], 'second run sends nothing');
});

await test('moving the plan to a later date arms the reminder again', async () => {
  await as(db, ann, () => plan(picnic, `now() + interval '3 days'`));
  eq(await reminded(picnic), false);
  await sent();
});

await test('a plan set for less than two hours away gets the "date picked" push but no second reminder', async () => {
  await as(db, ann, () => plan(picnic, `now() + interval '30 minutes'`));
  eq((await sent()).length, 2, 'date picked push to Bo and Cy');
  eq(await reminded(picnic), true);
  eq(await remind(), 0);
  eq(await sent(), []);
});

await test('plans that are done, or already in the past, are not reminded', async () => {
  await db.exec(`alter table ideas disable trigger ideas_reset_reminder`);
  await db.query(`update ideas set planned_for = now() + interval '1 hour', reminded_at = null, done_at = now() where id = $1`, [picnic]);
  eq(await remind(), 0, 'done');
  await db.query(`update ideas set planned_for = now() - interval '1 hour', done_at = null where id = $1`, [picnic]);
  eq(await remind(), 0, 'past');
  await db.exec(`alter table ideas enable trigger ideas_reset_reminder`);
  eq(await sent(), []);
});

console.log('\nBig groups');

await test('more than 100 phones are split into requests of at most 100', async () => {
  await db.query(
    `insert into push_tokens (token, user_id, platform) select 'ExponentPushToken[bulk-' || n || ']', $1, 'ios' from generate_series(1, 230) n`,
    [bo],
  );
  await addIdea(ann, 'Festival');
  const calls = await rows(db, `select jsonb_array_length(body) as n from net.calls order by id`);
  eq(calls.map((c) => c.n), [100, 100, 32]); // 230 + Bo's phone + Cy's phone
  const all = await sent();
  eq(new Set(all.map((p) => p.to)).size, 232, 'no phone is skipped or repeated');
});

