// Database tests for supabase/updates/016-live-updates.sql. Run with: npm run test:db
import fs from 'node:fs';
import path from 'node:path';

import { as, eq, freshDb, newUser, one, rejects, REPO, rows, test } from './harness.mjs';

const UPDATE = '016-live-updates.sql';
const BEFORE = ['001-push-notifications.sql', '002-account-transfer.sql', '003-comments.sql'];

// A stand-in for Supabase's Realtime: records every signal instead of sending it.
const REALTIME = `
create schema realtime;
create table realtime.sent (id bigserial primary key, payload jsonb, event text, topic text, private boolean);
create function realtime.send(payload jsonb, event text, topic text, private boolean default true)
returns void language plpgsql security definer as $$
begin
  if current_setting('test.realtime_broken', true) = 'on' then raise exception 'realtime is down'; end if;
  insert into realtime.sent (payload, event, topic, private) values (payload, event, topic, private);
end; $$;
`;

const db = await freshDb([...BEFORE, UPDATE]);
await db.exec(REALTIME);

const ann = await newUser(db, 'Ann');
const bo = await newUser(db, 'Bo');
const zed = await newUser(db, 'Zed');
const makeGroup = (user, name) => as(db, user, async () => (await one(db, `select create_group($1, 'sky', array['Food']) as id`, [name])).id);
const group = await makeGroup(ann, 'Friends');
const other = await makeGroup(zed, 'Zed only');
const { invite_code: code } = await one(db, `select invite_code from groups where id = $1`, [group]);
const { id: list } = await one(db, `select id from lists where group_id = $1`, [group]);
const { id: otherList } = await one(db, `select id from lists where group_id = $1`, [other]);

// The signals sent since the last look, as "topic" strings in order.
const told = async () => {
  const sent = await rows(db, `select topic from realtime.sent order by id`);
  await db.exec(`delete from realtime.sent`);
  return sent.map((s) => s.topic);
};
const addIdea = (user, title, g = group, l = list) =>
  as(db, user, async () => (await one(db, `insert into ideas (group_id, list_id, title, added_by) values ($1, $2, $3, $4) returning id`, [g, l, title, user])).id);

await told();

console.log('\nLive updates sent by the database');

await test('adding an idea tells the group, with a signal that carries nothing', async () => {
  await addIdea(ann, 'Sunrise walk');
  const sent = await rows(db, `select payload, event, topic, private from realtime.sent`);
  eq(sent, [{ payload: {}, event: 'changed', topic: `group:${group}`, private: false }]);
  await told();
});

await test('someone joining tells the group', async () => {
  await as(db, bo, () => db.query(`select join_group($1)`, [code]));
  eq(await told(), [`group:${group}`]);
});

const idea = await addIdea(ann, 'Denya visit');
await told();

await test('setting a date on an idea tells the group', async () => {
  await as(db, bo, () => db.query(`update ideas set planned_for = now() + interval '2 days' where id = $1`, [idea]));
  eq(await told(), [`group:${group}`]);
});

await test('a reaction, and taking it back, each tell the group', async () => {
  await as(db, bo, () => db.query(`insert into reactions (idea_id, group_id, user_id, emoji) values ($1, $2, $3, '👍')`, [idea, group, bo]));
  eq(await told(), [`group:${group}`]);
  await as(db, bo, () => db.query(`delete from reactions where idea_id = $1 and user_id = $2`, [idea, bo]));
  eq(await told(), [`group:${group}`]);
});

await test('a comment tells the group and the people reading that idea', async () => {
  await as(db, bo, () => db.query(`insert into comments (idea_id, group_id, user_id, body) values ($1, $2, $3, 'Yes please')`, [idea, group, bo]));
  eq(await told(), [`group:${group}`, `idea:${idea}`]);
});

await test('renaming a list, and renaming the group, each tell the group', async () => {
  await as(db, ann, () => db.query(`update lists set name = 'Dinner' where id = $1`, [list]));
  eq(await told(), [`group:${group}`]);
  await as(db, ann, () => db.query(`update groups set name = 'Best friends' where id = $1`, [group]));
  eq(await told(), [`group:${group}`]);
});

await test('removing an idea tells the group', async () => {
  const gone = await addIdea(ann, 'Never mind');
  await told();
  await as(db, ann, () => db.query(`delete from ideas where id = $1`, [gone]));
  eq(await told(), [`group:${group}`]);
});

await test('a change in one group tells only that group', async () => {
  await addIdea(zed, 'Solo trip', other, otherList);
  eq(await told(), [`group:${other}`]);
});

await test('one save that touches many rows sends one signal', async () => {
  await db.transaction(async (tx) => {
    for (const title of ['One', 'Two', 'Three']) {
      await tx.query(`insert into ideas (group_id, list_id, title, added_by) values ($1, $2, $3, $4)`, [group, list, title, ann]);
    }
  });
  eq(await told(), [`group:${group}`]);
});

await test('the next save sends its own signal', async () => {
  await addIdea(ann, 'Four');
  await addIdea(ann, 'Five');
  eq(await told(), [`group:${group}`, `group:${group}`]);
});

await test('a save that is refused sends nothing', async () => {
  await rejects(addIdea(zed, 'Sneaking in'), /row-level security|policy/i, 'a stranger adding an idea');
  eq(await told(), []);
});

await test('when the signal cannot be sent, the change is saved all the same', async () => {
  await db.exec(`set test.realtime_broken = 'on'`);
  try {
    const kept = await addIdea(ann, 'Still saved');
    eq((await one(db, `select title from ideas where id = $1`, [kept])).title, 'Still saved');
    eq(await told(), []);
  } finally {
    await db.exec(`set test.realtime_broken = 'off'`);
  }
  await addIdea(ann, 'Back to normal');
  eq(await told(), [`group:${group}`]);
});

await test('removing a whole group, ideas and all, sends one signal', async () => {
  await addIdea(zed, 'Another', other, otherList);
  await told();
  await db.query(`delete from groups where id = $1`, [other]);
  eq(await told(), [`group:${other}`]);
});

await test('people cannot call the signal function themselves', async () => {
  await rejects(as(db, ann, () => db.query(`select public.tell_group()`)), /permission denied|trigger/i, 'calling tell_group directly');
});

await test('the update is safe to run twice, and still sends one signal per save', async () => {
  await db.exec(fs.readFileSync(path.join(REPO, 'supabase/updates', UPDATE), 'utf8'));
  await addIdea(ann, 'After the second run');
  eq(await told(), [`group:${group}`]);
});

await test('where Realtime is not installed, saving works and nothing is sent', async () => {
  const plain = await freshDb([UPDATE]);
  const cy = await newUser(plain, 'Cy');
  const g = await as(plain, cy, async () => (await one(plain, `select create_group('Quiet', 'sky', array['Food']) as id`)).id);
  const { id: l } = await one(plain, `select id from lists where group_id = $1`, [g]);
  await as(plain, cy, () => plain.query(`insert into ideas (group_id, list_id, title, added_by) values ($1, $2, 'Works', $3)`, [g, l, cy]));
  eq((await one(plain, `select count(*)::int as n from ideas where group_id = $1`, [g])).n, 1);
});

await test('a table from an update not yet run is skipped, and picked up on a second run', async () => {
  const early = await freshDb([UPDATE]);
  eq((await rows(early, `select 1 from pg_trigger where tgname = 'tell_group' and tgrelid = to_regclass('public.comments')`)).length, 0);
  for (const file of BEFORE) await early.exec(fs.readFileSync(path.join(REPO, 'supabase/updates', file), 'utf8'));
  await early.exec(fs.readFileSync(path.join(REPO, 'supabase/updates', UPDATE), 'utf8'));
  eq((await rows(early, `select 1 from pg_trigger where tgname = 'tell_group' and tgrelid = 'public.comments'::regclass`)).length, 1);
});
