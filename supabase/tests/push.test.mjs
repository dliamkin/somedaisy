// Database tests for supabase/updates/001-push-notifications.sql. Run with: npm run test:db
import fs from 'node:fs';
import path from 'node:path';

import { as, eq, freshDb, newUser, one, REPO, rejects, rows, test } from './harness.mjs';

const UPDATE = '001-push-notifications.sql';
const db = await freshDb([UPDATE]);

// Ann, Bo and Cy share "Friends". Dee is an outsider with her own phone.
const ann = await newUser(db, 'Ann');
const bo = await newUser(db, 'Bo');
const cy = await newUser(db, 'Cy');
const dee = await newUser(db, 'Dee');

const group = await as(db, ann, async () => (await one(db, `select create_group('Friends', 'sky', array['Food']) as id`)).id);
const { invite_code: code } = await one(db, `select invite_code from groups where id = $1`, [group]);
await as(db, bo, () => db.query(`select join_group($1)`, [code]));
await as(db, cy, () => db.query(`select join_group($1)`, [code]));
const { id: list } = await one(db, `select id from lists where group_id = $1`, [group]);

const register = (user, token, tz = 'America/New_York') =>
  as(db, user, () => db.query(`select register_push_token($1, 'ios', $2)`, [token, tz]));
await register(ann, 'ExponentPushToken[ann-phone]');
await register(bo, 'ExponentPushToken[bo-phone]', 'Europe/London');
await register(cy, 'ExponentPushToken[cy-phone]', 'Asia/Tokyo');
await register(dee, 'ExponentPushToken[dee-phone]');

const sent = async () => {
  const calls = await rows(db, `select url, body from net.calls order by id`);
  await db.exec(`delete from net.calls`);
  return calls.flatMap((c) => c.body);
};
const addIdea = (user, title) =>
  as(db, user, async () =>
    (await one(db, `insert into ideas (group_id, list_id, title, added_by) values ($1, $2, $3, $4) returning id`, [group, list, title, user])).id);
const react = (user, idea, emoji = '👍') =>
  as(db, user, () => db.query(`insert into reactions (idea_id, group_id, user_id, emoji) values ($1, $2, $3, $4)`, [idea, group, user, emoji]));
const choose = (user, reactions, reminders) =>
  as(db, user, () => db.query(`select set_notification_settings($1, $2)`, [reactions, reminders]));
// Make every reaction so far look older than the "one push per burst" window.
const later = () => db.exec(`update reactions set created_at = created_at - interval '11 minutes'`);

console.log('\nRegistering phones');

await test('running the update a second time changes nothing and does not fail', async () => {
  await db.exec(fs.readFileSync(path.join(REPO, 'supabase/updates', UPDATE), 'utf8'));
  eq((await one(db, `select count(*)::int as n from push_tokens`)).n, 4);
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
  await rejects(as(db, ann, () => db.query(`select push_send(array[$1]::uuid[], $2, 'Hi', 'Spam')`, [bo, group])), /permission denied/, 'push_send');
  await rejects(as(db, ann, () => db.query(`select send_plan_reminders()`)), /permission denied/, 'send_plan_reminders');
});

console.log('\nChoosing what to hear about');

await test('with nothing chosen there is no row, which means everything is on', async () => {
  eq(await as(db, ann, () => rows(db, `select * from notification_settings`)), []);
});

await test('a person can save their choices, change them, and sees only their own', async () => {
  await choose(ann, false, true);
  await choose(bo, true, false);
  eq(await as(db, ann, () => rows(db, `select reactions, reminders from notification_settings`)), [{ reactions: false, reminders: true }]);
  await choose(ann, true, true);
  await choose(bo, true, true);
  eq(await as(db, ann, () => rows(db, `select reactions, reminders from notification_settings`)), [{ reactions: true, reminders: true }]);
});

await test('the app cannot write the choices table directly, least of all for someone else', async () => {
  await rejects(as(db, dee, () => db.query(`insert into notification_settings (user_id, reactions) values ($1, false)`, [dee])), /row-level security/, 'insert');
  await as(db, dee, () => db.query(`update notification_settings set reactions = false where user_id = $1`, [ann]));
  await as(db, dee, () => db.query(`delete from notification_settings where user_id = $1`, [ann]));
  eq(await rows(db, `select reactions from notification_settings where user_id = $1`, [ann]), [{ reactions: true }]);
});

await test('someone with no name yet, or not signed in, cannot save choices', async () => {
  const nameless = await newUser(db, null);
  await rejects(as(db, nameless, () => db.query(`select set_notification_settings(true, true)`)), /Set your name first/);
  await rejects(as(db, null, () => db.query(`select set_notification_settings(true, true)`)), /Not signed in/);
});

console.log('\nThings that stay quiet');
await db.exec(`delete from net.calls`);

let picnic;
await test('adding an idea sends nothing', async () => {
  picnic = await addIdea(ann, 'Picnic');
  eq(await sent(), []);
});

await test('picking, changing or removing a date sends nothing', async () => {
  await as(db, bo, () => db.query(`update ideas set planned_for = now() + interval '9 days' where id = $1`, [picnic]));
  await as(db, bo, () => db.query(`update ideas set planned_for = now() + interval '8 days' where id = $1`, [picnic]));
  await as(db, bo, () => db.query(`update ideas set planned_for = null where id = $1`, [picnic]));
  eq(await sent(), []);
});

await test('reacting to your own idea sends nothing', async () => {
  await react(ann, picnic);
  eq(await sent(), []);
});

console.log('\nReactions to your idea');

await test('a reaction tells only the person who added the idea', async () => {
  await react(bo, picnic);
  const pushes = await sent();
  eq(pushes.map((p) => p.to), ['ExponentPushToken[ann-phone]']);
  eq(pushes[0].title, 'Friends');
  eq(pushes[0].body, 'Bo reacted 👍 to your idea: Picnic');
  eq(pushes[0].data, { url: `/group/${group}` });
  eq(pushes[0].channelId, 'default');
});

await test('more emoji from the same person straight after stay quiet', async () => {
  await react(bo, picnic, '🍿');
  await react(bo, picnic, '🎉');
  eq(await sent(), []);
});

await test('a different person reacting is its own push', async () => {
  await react(cy, picnic, '🔥');
  eq((await sent()).map((p) => p.body), ['Cy reacted 🔥 to your idea: Picnic']);
});

await test('the same person reacting again later is told again', async () => {
  await later();
  await react(bo, picnic, '😍');
  eq((await sent()).map((p) => p.body), ['Bo reacted 😍 to your idea: Picnic']);
});

await test('the request goes to the Expo push service as JSON', async () => {
  await later();
  await react(cy, picnic, '👍');
  const call = await one(db, `select url, headers from net.calls order by id desc limit 1`);
  eq(call.url, 'https://exp.host/--/api/v2/push/send');
  eq(call.headers['Content-Type'], 'application/json');
  await sent();
});

await test('someone with two phones gets it on both', async () => {
  await register(ann, 'ExponentPushToken[ann-tablet]');
  const museum = await addIdea(ann, 'Museum');
  await react(bo, museum);
  eq((await sent()).map((p) => p.to).sort(), ['ExponentPushToken[ann-phone]', 'ExponentPushToken[ann-tablet]']);
  await as(db, ann, () => db.query(`select unregister_push_token('ExponentPushToken[ann-tablet]')`));
});

await test('turning reactions off stops them, and turning them back on starts them again', async () => {
  const bowling = await addIdea(ann, 'Bowling');
  await choose(ann, false, true);
  await react(bo, bowling);
  eq(await sent(), [], 'off');
  await choose(ann, true, true);
  await react(cy, bowling);
  eq((await sent()).map((p) => p.to), ['ExponentPushToken[ann-phone]'], 'on again');
});

await test('someone who has left the group hears nothing about the ideas they left behind', async () => {
  const eve = await newUser(db, 'Eve');
  await as(db, eve, () => db.query(`select join_group($1)`, [code]));
  await register(eve, 'ExponentPushToken[eve-phone]');
  const sailing = await addIdea(eve, 'Sailing');
  await db.query(`delete from group_members where group_id = $1 and user_id = $2`, [group, eve]);
  await react(bo, sailing);
  eq(await sent(), []);
});

await test('the reaction is still saved when the push cannot be queued', async () => {
  const karaoke = await addIdea(ann, 'Karaoke');
  await db.query(`select set_config('test.net_broken', 'on', false)`);
  await react(bo, karaoke);
  await db.query(`select set_config('test.net_broken', 'off', false)`);
  eq((await one(db, `select count(*)::int as n from reactions where idea_id = $1`, [karaoke])).n, 1);
  eq(await sent(), []);
});

console.log('\nReminders');

const plan = (idea, when) => db.query(`update ideas set planned_for = ${when} where id = $1`, [idea]);
const remind = async () => (await one(db, `select send_plan_reminders() as n`)).n;
const reminded = async (idea) => (await one(db, `select reminded_at from ideas where id = $1`, [idea])).reminded_at !== null;
const everyone = ['ExponentPushToken[ann-phone]', 'ExponentPushToken[bo-phone]', 'ExponentPushToken[cy-phone]'];

await test('a plan more than two hours away is not reminded yet', async () => {
  await plan(picnic, `now() + interval '5 hours'`);
  eq(await remind(), 0);
  eq(await sent(), []);
  eq(await reminded(picnic), false);
});

await test('once it is within two hours, every member is reminded exactly once', async () => {
  await plan(picnic, `now() + interval '90 minutes'`);
  eq(await remind(), 1);
  const pushes = await sent();
  eq(pushes.map((p) => p.to).sort(), everyone);
  if (!/^Picnic is coming up at \d{1,2}:\d{2} (AM|PM)$/.test(pushes[0].body)) throw new Error(`unexpected body: ${pushes[0].body}`);
  eq(pushes[0].title, 'Friends');
  eq(pushes[0].data, { url: `/group/${group}` });
  eq(await remind(), 0, 'second run');
  eq(await sent(), [], 'second run sends nothing');
});

await test('the time in a reminder is in each phone\'s own time zone', async () => {
  // Midnight UTC on 21 Nov 2026 is 7:00 PM in New York and 9:00 AM in Tokyo.
  const at = '2026-11-21T00:00:00Z';
  eq((await one(db, `select push_time($1, 'America/New_York') as t`, [at])).t, '7:00 PM');
  eq((await one(db, `select push_time($1, 'Asia/Tokyo') as t`, [at])).t, '9:00 AM');
});

await test('moving the plan arms the reminder again', async () => {
  await as(db, ann, () => plan(picnic, `now() + interval '3 days'`));
  eq(await reminded(picnic), false);
  eq(await remind(), 0);
});

await test('a plan made for less than two hours away is still reminded', async () => {
  await as(db, ann, () => plan(picnic, `now() + interval '30 minutes'`));
  eq(await sent(), [], 'nothing at the moment the date is picked');
  eq(await remind(), 1);
  eq((await sent()).length, 3);
});

await test('someone who turned reminders off is left out, and the others still get theirs', async () => {
  await choose(bo, true, false);
  await plan(picnic, `now() + interval '1 hour'`);
  eq(await remind(), 1);
  eq((await sent()).map((p) => p.to).sort(), ['ExponentPushToken[ann-phone]', 'ExponentPushToken[cy-phone]']);
  await choose(bo, true, true);
});

await test('when nobody wants reminders the plan is not tried again every ten minutes', async () => {
  for (const user of [ann, bo, cy]) await choose(user, true, false);
  await plan(picnic, `now() + interval '100 minutes'`);
  eq(await remind(), 1);
  eq(await sent(), []);
  eq(await reminded(picnic), true);
  for (const user of [ann, bo, cy]) await choose(user, true, true);
});

await test('plans that are done, or already in the past, are not reminded', async () => {
  await db.query(`update ideas set planned_for = now() + interval '1 hour', done_at = now() where id = $1`, [picnic]);
  eq(await remind(), 0, 'done');
  await db.query(`update ideas set planned_for = now() - interval '1 hour', done_at = null where id = $1`, [picnic]);
  eq(await remind(), 0, 'past');
  eq(await sent(), []);
});

console.log('\nBig groups');

await test('more than 100 phones are split into requests of at most 100', async () => {
  await db.query(
    `insert into push_tokens (token, user_id, platform) select 'ExponentPushToken[bulk-' || n || ']', $1, 'ios' from generate_series(1, 230) n`,
    [bo],
  );
  await plan(picnic, `now() + interval '1 hour'`);
  eq(await remind(), 1);
  const calls = await rows(db, `select jsonb_array_length(body) as n from net.calls order by id`);
  eq(calls.map((c) => c.n), [100, 100, 33]); // 230 + one phone each for Ann, Bo and Cy
  const all = await sent();
  eq(new Set(all.map((p) => p.to)).size, 233, 'no phone is skipped or repeated');
});
