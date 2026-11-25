// Database tests for supabase/updates/026-comment-reactions.sql. Run with: npm run test:db
import fs from 'node:fs';
import path from 'node:path';

import { as, eq, freshDb, newUser, one, rejects, REPO, rows, test } from './harness.mjs';

const UPDATE = '026-comment-reactions.sql';

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

await test('it will not run before comments exist, and says which update to run first', async () => {
  const bare = await freshDb([]);
  await rejects(bare.exec(fs.readFileSync(path.join(REPO, 'supabase/updates', UPDATE), 'utf8')), /Run update 003/);
});

// With comments alone, and with live updates (016) and everything else that hangs things on a group.
for (const [label, before, live] of [
  ['', ['001-push-notifications.sql', '002-account-transfer.sql', '003-comments.sql'], false],
  [' (with live updates and the other updates)', ['001-push-notifications.sql', '002-account-transfer.sql', '003-comments.sql', '005-delete-account.sql', '007-group-settings.sql', '008-you-did-it.sql', '016-live-updates.sql', '025-delete-group.sql'], true],
]) {
  const db = await freshDb([...before, UPDATE]);
  if (live) await db.exec(REALTIME);

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

  const addIdea = (user, title, g = group, l = list) =>
    as(db, user, async () => (await one(db, `insert into ideas (group_id, list_id, title, added_by) values ($1, $2, $3, $4) returning id`, [g, l, title, user])).id);
  const comment = (user, idea, body, g = group) =>
    as(db, user, async () => (await one(db, `insert into comments (idea_id, group_id, user_id, body) values ($1, $2, $3, $4) returning id`, [idea, g, user, body])).id);
  // React the way the app does: add, or change the one already there.
  const react = (user, commentId, emoji, { idea = picnic, g = group, author = user } = {}) =>
    as(db, user, () =>
      db.query(
        `insert into comment_reactions (comment_id, idea_id, group_id, user_id, emoji) values ($1, $2, $3, $4, $5)
         on conflict (comment_id, user_id) do update set emoji = excluded.emoji`,
        [commentId, idea, g, author, emoji],
      ),
    );
  const unreact = (user, commentId, whose = user) => as(db, user, () => db.query(`delete from comment_reactions where comment_id = $1 and user_id = $2`, [commentId, whose]));
  const seenBy = (user, commentId) => as(db, user, async () => (await rows(db, `select user_id, emoji from comment_reactions where comment_id = $1 order by created_at, user_id`, [commentId])).map((r) => r.emoji));
  const all = async (commentId) => (await rows(db, `select emoji from comment_reactions where comment_id = $1 order by emoji`, [commentId])).map((r) => r.emoji);
  const told = async () => {
    if (!live) return [];
    const sent = await rows(db, `select topic from realtime.sent order by id`);
    await db.exec(`delete from realtime.sent`);
    return sent.map((s) => s.topic).filter((topic) => topic.startsWith('idea:'));
  };

  const picnic = await addIdea(ann, 'Picnic');
  const hike = await addIdea(ann, 'Hike');
  const zedsIdea = await addIdea(zed, 'Secret plan', zedsGroup, zedsList);
  const blanket = await comment(bo, picnic, 'I can bring a blanket');
  const boots = await comment(cy, hike, 'Bring boots');
  const secret = await comment(zed, zedsIdea, 'Nobody knows', zedsGroup);
  await told();

  console.log(`\nReactions on comments${label}`);

  await test('a member can react to a comment, and every member sees it', async () => {
    await react(ann, blanket, '😂');
    for (const who of [ann, bo, cy]) eq(await seenBy(who, blanket), ['😂']);
  });

  await test('someone can react to their own comment', async () => {
    await react(bo, blanket, '👍');
    eq(await all(blanket), ['👍', '😂']);
  });

  await test('a person has one reaction to a comment: choosing another emoji changes it', async () => {
    await react(ann, blanket, '❤️');
    eq(await all(blanket), ['❤️', '👍']);
    eq((await one(db, `select count(*)::int as n from comment_reactions where comment_id = $1 and user_id = $2`, [blanket, ann])).n, 1);
    // Without saying what to do about the one already there, a second is refused.
    await rejects(as(db, ann, () => db.query(`insert into comment_reactions (comment_id, idea_id, group_id, user_id, emoji) values ($1, $2, $3, $4, '🔥')`, [blanket, picnic, group, ann])), /duplicate key/);
  });

  await test('a stranger, or someone not signed in, sees no reactions and cannot add one', async () => {
    eq(await seenBy(zed, blanket), [], 'stranger');
    eq(await seenBy(null, blanket), [], 'signed out');
    await rejects(react(zed, blanket, '👀'), /row-level security/, 'in their group');
    await rejects(react(zed, blanket, '👀', { idea: zedsIdea, g: zedsGroup }), /row-level security/, 'filed under his own group');
    await rejects(react(null, blanket, '👀', { author: zed }), /row-level security|permission denied/, 'signed out');
  });

  await test('nobody can react in someone else\'s name', async () => {
    await rejects(react(cy, blanket, '🔥', { author: ann }), /row-level security/);
    eq(await all(blanket), ['❤️', '👍']);
  });

  await test('a reaction has to name its comment\'s own idea and group', async () => {
    await rejects(react(cy, blanket, '🔥', { idea: hike }), /row-level security/, 'another idea in the group');
    await rejects(react(cy, secret, '🔥'), /row-level security/, 'a comment in a group they are not in');
    eq(await all(secret), []);
  });

  await test('a reaction cannot be moved to another comment, or handed to someone else', async () => {
    await rejects(as(db, ann, () => db.query(`update comment_reactions set comment_id = $2, idea_id = $3 where comment_id = $1 and user_id = $4`, [blanket, secret, zedsIdea, ann])), /row-level security/, 'to a comment elsewhere');
    await rejects(as(db, ann, () => db.query(`update comment_reactions set user_id = $2 where comment_id = $1 and user_id = $3`, [blanket, cy, ann])), /row-level security/, 'to someone else');
    // Nobody can change another person's: it simply touches nothing.
    await as(db, cy, () => db.query(`update comment_reactions set emoji = '🙈' where comment_id = $1 and user_id = $2`, [blanket, ann]));
    eq(await all(blanket), ['❤️', '👍']);
  });

  await test('an empty reaction, or one too long to be an emoji, is refused', async () => {
    await rejects(react(cy, blanket, ''), /check constraint/, 'empty');
    await rejects(react(cy, blanket, 'x'.repeat(17)), /check constraint/, 'too long');
  });

  await test('you can remove your own reaction and nobody else\'s', async () => {
    await unreact(cy, blanket, ann);
    eq(await all(blanket), ['❤️', '👍']);
    await unreact(ann, blanket);
    eq(await all(blanket), ['👍']);
  });

  if (live) {
    await test('reacting, changing a reaction and removing one each tell whoever has that idea\'s comments open', async () => {
      await told();
      await react(cy, blanket, '🎉');
      eq(await told(), [`idea:${picnic}`], 'reacting');
      await react(cy, blanket, '😮');
      eq(await told(), [`idea:${picnic}`], 'changing');
      await unreact(cy, blanket);
      eq(await told(), [`idea:${picnic}`], 'removing');
      await react(cy, boots, '👍', { idea: hike });
      eq(await told(), [`idea:${hike}`], 'another idea');
      await unreact(cy, boots);
      await told();
    });

    await test('removing a comment with several reactions tells them once', async () => {
      const busy = await comment(bo, picnic, 'Who is driving?');
      for (const who of [ann, bo, cy]) await react(who, busy, '🚗');
      await told();
      await as(db, bo, () => db.query(`delete from comments where id = $1`, [busy]));
      eq(await told(), [`idea:${picnic}`]);
    });

    await test('a reaction is still saved when the signal cannot be sent', async () => {
      await db.exec(`set test.realtime_broken = 'on'`);
      try {
        await react(cy, blanket, '✨');
        eq(await all(blanket), ['✨', '👍']);
      } finally {
        await db.exec(`set test.realtime_broken = 'off'`);
      }
      await unreact(cy, blanket);
      await told();
    });
  }

  await test('a reaction goes with its comment', async () => {
    const gone = await comment(cy, picnic, 'Never mind');
    await react(ann, gone, '👍');
    await as(db, cy, () => db.query(`delete from comments where id = $1`, [gone]));
    eq(await all(gone), []);
  });

  await test('a reaction goes with its idea, and other ideas keep theirs', async () => {
    await react(ann, boots, '👍', { idea: hike });
    await react(ann, blanket, '😂');
    await as(db, ann, () => db.query(`delete from ideas where id = $1`, [hike]));
    eq(await all(boots), []);
    eq(await all(blanket), ['👍', '😂']);
  });

  await test('someone who leaves the group keeps their reaction on show, and can no longer see or change any', async () => {
    await react(cy, blanket, '🔥');
    await as(db, cy, () => db.query(`delete from group_members where group_id = $1 and user_id = $2`, [group, cy]));
    eq(await all(blanket), ['👍', '🔥', '😂']);
    eq(await seenBy(cy, blanket), []);
    await rejects(react(cy, blanket, '🙈'), /row-level security/);
  });

  await test('a reaction goes when the person who left it is removed', async () => {
    await db.query(`delete from profiles where id = $1`, [cy]);
    eq(await all(blanket), ['👍', '😂']);
  });

  await test('running the update a second time keeps the reactions and does not fail', async () => {
    await db.exec(fs.readFileSync(path.join(REPO, 'supabase/updates', UPDATE), 'utf8'));
    eq(await all(blanket), ['👍', '😂']);
    await react(ann, blanket, '❤️');
    eq(await all(blanket), ['❤️', '👍']);
  });

  await test('reactions go with the group', async () => {
    await db.query(`delete from groups where id = $1`, [group]);
    eq((await one(db, `select count(*)::int as n from comment_reactions`)).n, 0);
  });
}
