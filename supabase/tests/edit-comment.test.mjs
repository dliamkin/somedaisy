// Database tests for supabase/updates/028-edit-comment.sql. Run with: npm run test:db
import fs from 'node:fs';
import path from 'node:path';

import { as, eq, freshDb, newUser, one, REPO, rejects, rows, test } from './harness.mjs';

const UPDATE = '028-edit-comment.sql';
const BEFORE = ['001-push-notifications.sql', '002-account-transfer.sql', '003-comments.sql', '016-live-updates.sql', '026-comment-reactions.sql'];

// A stand-in for Supabase's Realtime: records every signal instead of sending it.
const REALTIME = `
create schema realtime;
create table realtime.sent (id bigserial primary key, payload jsonb, event text, topic text, private boolean);
create function realtime.send(payload jsonb, event text, topic text, private boolean default true)
returns void language plpgsql security definer as $$
begin
  insert into realtime.sent (payload, event, topic, private) values (payload, event, topic, private);
end; $$;
`;

// Ann and Bo share "Friends", where Ann added "Picnic". Zed is a stranger.
async function world(updates = [...BEFORE, UPDATE]) {
  const db = await freshDb(updates);
  await db.exec(REALTIME);
  const ann = await newUser(db, 'Ann');
  const bo = await newUser(db, 'Bo');
  const zed = await newUser(db, 'Zed');
  const friends = await as(db, ann, async () => (await one(db, `select create_group('Friends', 'sky', array['Food']) as id`)).id);
  const { invite_code: code } = await one(db, `select invite_code from groups where id = $1`, [friends]);
  await as(db, bo, () => db.query(`select join_group($1)`, [code]));
  const { id: food } = await one(db, `select id from lists where group_id = $1`, [friends]);
  for (const [user, name] of [[ann, 'ann'], [bo, 'bo']]) {
    await as(db, user, () => db.query(`select register_push_token($1, 'ios', 'UTC')`, [`ExponentPushToken[${name}-phone]`]));
  }
  const picnic = await as(db, ann, async () =>
    (await one(db, `insert into ideas (group_id, list_id, title, added_by) values ($1, $2, 'Picnic', $3) returning id`, [friends, food, ann])).id);

  const comment = (user, body) => as(db, user, async () =>
    (await one(db, `insert into comments (idea_id, group_id, user_id, body) values ($1, $2, $3, $4) returning id`, [picnic, friends, user, body])).id);
  const edit = (user, id, body) => as(db, user, async () => (await one(db, `select edit_comment($1, $2) as ok`, [id, body])).ok);
  const read = (id) => one(db, `select body, edited_at, user_id, idea_id, group_id, created_at from comments where id = $1`, [id]);
  // The notifications queued since the last look, and the signals sent to whoever has a page open.
  const pushed = async () => {
    const calls = await rows(db, `select body from net.calls order by id`);
    await db.exec(`delete from net.calls`);
    return calls.flatMap((c) => c.body).map((p) => p.body);
  };
  const told = async () => {
    const sent = await rows(db, `select topic from realtime.sent order by id`);
    await db.exec(`delete from realtime.sent`);
    return sent.map((s) => s.topic);
  };
  return { db, ann, bo, zed, friends, picnic, comment, edit, read, pushed, told };
}

console.log('\nChanging the words of a comment');

await test('you can change your own comment, and it is marked as edited from then on', async () => {
  const w = await world();
  const mine = await w.comment(w.bo, 'I can bring a blanket');
  const before = await w.read(mine);
  eq(before.edited_at, null);
  eq(await w.edit(w.bo, mine, 'I can bring two blankets'), true);
  const after = await w.read(mine);
  eq(after.body, 'I can bring two blankets');
  eq(after.edited_at instanceof Date, true, 'has a time');
  eq([after.user_id, after.idea_id, after.group_id, String(after.created_at)], [before.user_id, before.idea_id, before.group_id, String(before.created_at)], 'nothing else changed');
});

await test('everyone in the group reads the new words and when they were changed', async () => {
  const w = await world();
  const mine = await w.comment(w.bo, 'Saturday?');
  await w.edit(w.bo, mine, 'Sunday?');
  const seen = await as(w.db, w.ann, () => one(w.db, `select body, edited_at from comments where id = $1`, [mine]));
  eq(seen.body, 'Sunday?');
  eq(seen.edited_at instanceof Date, true);
});

await test('nobody can change somebody else\'s comment, in the group or out of it', async () => {
  const w = await world();
  const bos = await w.comment(w.bo, 'Mine');
  await rejects(w.edit(w.ann, bos, 'Ann was here'), /not your comment/, 'another member');
  await rejects(w.edit(w.zed, bos, 'Zed was here'), /not your comment/, 'a stranger');
  await rejects(w.edit(w.bo, '00000000-0000-4000-8000-000000000000', 'Nothing'), /not your comment/, 'no such comment');
  eq(await w.read(bos).then((c) => [c.body, c.edited_at]), ['Mine', null]);
});

await test('someone who is not signed in cannot', async () => {
  const w = await world();
  const bos = await w.comment(w.bo, 'Mine');
  await rejects(one(w.db, `select edit_comment($1, 'Hello')`, [bos]), /Not signed in/);
  await rejects((async () => {
    await w.db.exec('set role anon');
    try {
      await w.db.query(`select edit_comment($1, 'Hello')`, [bos]);
    } finally {
      await w.db.exec('reset role');
    }
  })(), /permission denied/);
  eq((await w.read(bos)).body, 'Mine');
});

await test('someone who has left the group cannot change what they wrote there', async () => {
  const w = await world();
  const bos = await w.comment(w.bo, 'Before leaving');
  await w.db.query(`delete from group_members where group_id = $1 and user_id = $2`, [w.friends, w.bo]);
  await rejects(w.edit(w.bo, bos, 'After leaving'), /not your comment/);
  eq((await w.read(bos)).body, 'Before leaving');
});

await test('the words are trimmed, and a comment cannot be emptied or made too long', async () => {
  const w = await world();
  const mine = await w.comment(w.bo, 'Fine');
  eq(await w.edit(w.bo, mine, '  \n Better \t\n'), true);
  eq((await w.read(mine)).body, 'Better');
  await rejects(w.edit(w.bo, mine, ''), /needs some words/, 'empty');
  await rejects(w.edit(w.bo, mine, '  \n '), /needs some words/, 'only spaces');
  await rejects(w.edit(w.bo, mine, null), /needs some words/, 'nothing at all');
  await rejects(w.edit(w.bo, mine, 'x'.repeat(501)), /500 characters/, 'too long');
  eq(await w.edit(w.bo, mine, 'x'.repeat(500)), true, 'as long as a comment can be');
  eq((await w.read(mine)).body.length, 500);
});

await test('saving the same words changes nothing and does not mark it as edited', async () => {
  const w = await world();
  const mine = await w.comment(w.bo, 'Same');
  await w.told();
  eq(await w.edit(w.bo, mine, 'Same'), false);
  eq(await w.edit(w.bo, mine, '  Same  '), false, 'with spaces round them');
  eq((await w.read(mine)).edited_at, null);
  eq(await w.told(), [], 'nobody is told');
});

await test('its reactions stay on it', async () => {
  const w = await world();
  const mine = await w.comment(w.bo, 'Tacos?');
  await as(w.db, w.ann, () => w.db.query(`insert into comment_reactions (comment_id, idea_id, group_id, user_id, emoji) values ($1, $2, $3, $4, '👍')`, [mine, w.picnic, w.friends, w.ann]));
  await w.edit(w.bo, mine, 'Tacos or pizza?');
  eq(await rows(w.db, `select emoji from comment_reactions where comment_id = $1`, [mine]), [{ emoji: '👍' }]);
});

await test('nobody is sent a notification about a changed comment', async () => {
  const w = await world();
  const mine = await w.comment(w.bo, 'Saturday works');
  eq(await w.pushed(), ['Bo commented on Picnic: Saturday works'], 'the comment itself');
  await w.edit(w.bo, mine, 'Sunday works');
  eq(await w.pushed(), []);
});

await test('whoever has the comments or the group open is told once, with nothing in the signal', async () => {
  const w = await world();
  const mine = await w.comment(w.bo, 'First');
  await w.told();
  await w.edit(w.bo, mine, 'Second');
  eq(await rows(w.db, `select payload, event, topic, private from realtime.sent order by id`), [
    { payload: {}, event: 'changed', topic: `group:${w.friends}`, private: false },
    { payload: {}, event: 'changed', topic: `idea:${w.picnic}`, private: false },
  ]);
});

await test('a comment still cannot be changed any other way, not even by whoever wrote it', async () => {
  const w = await world();
  const mine = await w.comment(w.bo, 'As written');
  await as(w.db, w.bo, () => w.db.query(`update comments set body = 'Changed', edited_at = null, user_id = $2, created_at = now() - interval '1 year' where id = $1`, [mine, w.ann]));
  await as(w.db, w.ann, () => w.db.query(`update comments set body = 'Changed' where id = $1`, [mine]));
  const after = await w.read(mine);
  eq([after.body, after.user_id, after.edited_at], ['As written', w.bo, null]);
});

await test('a changed comment can still be removed by whoever wrote it, and only by them', async () => {
  const w = await world();
  const mine = await w.comment(w.bo, 'First');
  await w.edit(w.bo, mine, 'Second');
  await as(w.db, w.ann, () => w.db.query(`delete from comments where id = $1`, [mine]));
  eq((await w.read(mine)).body, 'Second', 'still there after Ann tried');
  await as(w.db, w.bo, () => w.db.query(`delete from comments where id = $1`, [mine]));
  eq(await w.read(mine), undefined);
});

await test('the update can be run twice, and keeps which comments were edited', async () => {
  const w = await world();
  const mine = await w.comment(w.bo, 'First');
  const other = await w.comment(w.ann, 'Untouched');
  await w.edit(w.bo, mine, 'Second');
  await w.db.exec(fs.readFileSync(path.join(REPO, 'supabase/updates', UPDATE), 'utf8'));
  eq((await w.read(mine)).edited_at instanceof Date, true);
  eq((await w.read(other)).edited_at, null);
  eq(await w.edit(w.ann, other, 'Touched'), true);
});

await test('comments written before the update are not marked as edited', async () => {
  const w = await world(BEFORE);
  const old = await w.comment(w.bo, 'From before');
  await w.db.exec(fs.readFileSync(path.join(REPO, 'supabase/updates', UPDATE), 'utf8'));
  eq(await w.read(old).then((c) => [c.body, c.edited_at]), ['From before', null]);
});

await test('it will not run before the update it needs', async () => {
  const db = await freshDb(['001-push-notifications.sql', '002-account-transfer.sql']);
  await rejects(db.exec(fs.readFileSync(path.join(REPO, 'supabase/updates', UPDATE), 'utf8')), /Run update 003/);
});
