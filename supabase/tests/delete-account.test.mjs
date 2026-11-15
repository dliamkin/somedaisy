// Database tests for supabase/updates/005-delete-account.sql. Run with: npm run test:db
import fs from 'node:fs';
import path from 'node:path';

import { as, eq, freshDb, newUser, one, REPO, rejects, rows, test } from './harness.mjs';

const UPDATE = '005-delete-account.sql';

// A fresh world for each test, since every test deletes someone.
//   Ann, Bo and Cy share "Friends", which Ann started. Ann also has "Just Ann" to herself.
//   Zed is a stranger with a group of his own.
async function world(updates = ['001-push-notifications.sql', '002-account-transfer.sql', '003-comments.sql', '004-profile-photo.sql', UPDATE]) {
  const db = await freshDb(updates);
  const full = updates.length > 1;
  const makeGroup = (user, name) => as(db, user, async () => (await one(db, `select create_group($1, 'sky', array['Food']) as id`, [name])).id);
  const listOf = async (g) => (await one(db, `select id from lists where group_id = $1`, [g])).id;
  const addIdea = (user, g, l, title) =>
    as(db, user, async () => (await one(db, `insert into ideas (group_id, list_id, title, added_by) values ($1, $2, $3, $4) returning id`, [g, l, title, user])).id);
  const react = (user, g, idea, emoji) => as(db, user, () => db.query(`insert into reactions (idea_id, group_id, user_id, emoji) values ($1, $2, $3, $4)`, [idea, g, user, emoji]));
  const comment = (user, g, idea, body) => as(db, user, () => db.query(`insert into comments (idea_id, group_id, user_id, body) values ($1, $2, $3, $4)`, [idea, g, user, body]));

  const [ann, bo, cy, zed] = [await newUser(db, 'Ann'), await newUser(db, 'Bo'), await newUser(db, 'Cy'), await newUser(db, 'Zed')];
  const friends = await makeGroup(ann, 'Friends');
  const justAnn = await makeGroup(ann, 'Just Ann');
  const zeds = await makeGroup(zed, 'Zed only');
  const { invite_code: code } = await one(db, `select invite_code from groups where id = $1`, [friends]);
  for (const user of [bo, cy]) await as(db, user, () => db.query(`select join_group($1)`, [code]));

  const friendsList = await listOf(friends);
  const picnic = await addIdea(ann, friends, friendsList, 'Picnic');
  const bowling = await addIdea(bo, friends, friendsList, 'Bowling');
  const solo = await addIdea(ann, justAnn, await listOf(justAnn), 'Solo hike');
  const zedsIdea = await addIdea(zed, zeds, await listOf(zeds), 'Secret plan');

  await react(ann, friends, bowling, '👍');
  await react(bo, friends, picnic, '🎉');
  await react(zed, zeds, zedsIdea, '👍');
  if (full) {
    await comment(ann, friends, bowling, 'I am in');
    await comment(bo, friends, picnic, 'Me too');
    for (const [user, name] of [[ann, 'ann'], [bo, 'bo']]) {
      await as(db, user, () => db.query(`select register_push_token($1, 'android', 'UTC')`, [`ExponentPushToken[${name}-phone]`]));
      await as(db, user, () => db.query(`select set_notification_settings(true, false, true)`));
    }
    await db.exec(`delete from net.calls`);
  }

  const count = async (sql, params = []) => (await one(db, `select count(*)::int as n from ${sql}`, params)).n;
  const remove = (user, opts) => as(db, user, () => db.query(`select delete_account()`), opts);
  return { db, ann, bo, cy, zed, friends, justAnn, zeds, picnic, bowling, solo, zedsIdea, count, remove };
}

console.log('\nDeleting an account');

await test('removes the person: sign-in, name, memberships, reactions, comments, phones and choices', async () => {
  const w = await world();
  await w.remove(w.ann);
  eq(await w.count(`auth.users where id = $1`, [w.ann]), 0, 'sign-in');
  eq(await w.count(`profiles where id = $1`, [w.ann]), 0, 'profile');
  eq(await w.count(`group_members where user_id = $1`, [w.ann]), 0, 'memberships');
  eq(await w.count(`reactions where user_id = $1`, [w.ann]), 0, 'reactions');
  eq(await w.count(`comments where user_id = $1`, [w.ann]), 0, 'comments');
  eq(await w.count(`push_tokens where user_id = $1`, [w.ann]), 0, 'phones');
  eq(await w.count(`notification_settings where user_id = $1`, [w.ann]), 0, 'choices');
});

await test('ideas they added stay in the group, with no name on them', async () => {
  const w = await world();
  await w.remove(w.ann);
  eq(await rows(w.db, `select title, added_by from ideas where id = $1`, [w.picnic]), [{ title: 'Picnic', added_by: null }]);
  // What friends said about it stays too.
  eq(await w.count(`reactions where idea_id = $1`, [w.picnic]), 1, 'reactions on it');
  eq(await w.count(`comments where idea_id = $1`, [w.picnic]), 1, 'comments on it');
});

await test('a group they started stays for its other members', async () => {
  const w = await world();
  await w.remove(w.ann);
  eq(await rows(w.db, `select name, created_by from groups where id = $1`, [w.friends]), [{ name: 'Friends', created_by: null }]);
  const members = await rows(w.db, `select p.name from group_members m join profiles p on p.id = m.user_id where m.group_id = $1 order by p.name`, [w.friends]);
  eq(members.map((m) => m.name), ['Bo', 'Cy']);
  // Bo can still see and use it.
  eq(await as(w.db, w.bo, async () => (await rows(w.db, `select title from ideas where group_id = $1 order by title`, [w.friends])).map((r) => r.title)), ['Bowling', 'Picnic']);
});

await test('a group where they were the only member is deleted, with everything in it', async () => {
  const w = await world();
  await w.remove(w.ann);
  eq(await w.count(`groups where id = $1`, [w.justAnn]), 0, 'group');
  eq(await w.count(`lists where group_id = $1`, [w.justAnn]), 0, 'lists');
  eq(await w.count(`ideas where id = $1`, [w.solo]), 0, 'ideas');
});

await test('nobody else is touched', async () => {
  const w = await world();
  await w.remove(w.ann);
  eq(await w.count(`auth.users`), 3, 'sign-ins');
  eq(await w.count(`profiles`), 3, 'profiles');
  eq(await w.count(`groups where id = $1`, [w.zeds]), 1, 'a stranger\'s group');
  eq(await w.count(`ideas where id = $1`, [w.zedsIdea]), 1, 'a stranger\'s idea');
  eq(await w.count(`reactions where user_id = $1`, [w.zed]), 1, 'a stranger\'s reaction');
  eq(await w.count(`reactions where user_id = $1`, [w.bo]), 1, 'a friend\'s reaction');
  eq(await w.count(`comments where user_id = $1`, [w.bo]), 1, 'a friend\'s comment');
  eq(await w.count(`push_tokens where user_id = $1`, [w.bo]), 1, 'a friend\'s phone');
});

await test('the last two people in a group can both leave, and the group goes with the second', async () => {
  const w = await world();
  await w.remove(w.cy);
  await w.remove(w.bo);
  eq(await w.count(`groups where id = $1`, [w.friends]), 1, 'still Ann\'s');
  await w.remove(w.ann);
  eq(await w.count(`groups where id = $1`, [w.friends]), 0, 'gone with the last member');
  eq(await w.count(`ideas where group_id = $1`, [w.friends]), 0, 'its ideas');
});

await test('a guest can delete themselves too', async () => {
  const w = await world();
  await w.remove(w.bo, { guest: true });
  eq(await w.count(`auth.users where id = $1`, [w.bo]), 0, 'sign-in');
  eq(await w.count(`profiles where id = $1`, [w.bo]), 0, 'profile');
});

await test('someone who never picked a name can delete their sign-in', async () => {
  const w = await world();
  const nameless = await newUser(w.db);
  await w.remove(nameless, { guest: true });
  eq(await w.count(`auth.users where id = $1`, [nameless]), 0);
  eq(await w.count(`auth.users`), 4, 'everyone else');
});

await test('it sends no notifications', async () => {
  const w = await world();
  await w.remove(w.ann);
  eq(await w.count(`net.calls`), 0);
});

await test('someone who is not signed in is refused, and nothing is deleted', async () => {
  const w = await world();
  await rejects(as(w.db, null, () => w.db.query(`select delete_account()`)), /Not signed in/, 'signed-in role, no user');
  await w.db.exec('set role anon');
  try {
    await rejects(w.db.query(`select delete_account()`), /permission denied/, 'anon role');
  } finally {
    await w.db.exec('reset role');
  }
  eq(await w.count(`auth.users`), 4);
  eq(await w.count(`groups`), 3);
});

await test('asking twice deletes nothing more', async () => {
  const w = await world();
  await w.remove(w.ann);
  // The old sign-in is still in the app's hand for a moment; using it again deletes nothing more.
  await w.remove(w.ann);
  eq(await w.count(`auth.users`), 3);
  eq(await w.count(`groups`), 2);
});

await test('works without the other updates, and running it a second time does not fail', async () => {
  const w = await world([UPDATE]);
  await w.db.exec(fs.readFileSync(path.join(REPO, 'supabase/updates', UPDATE), 'utf8'));
  await w.remove(w.ann);
  eq(await w.count(`profiles where id = $1`, [w.ann]), 0);
  eq(await w.count(`groups where id = $1`, [w.justAnn]), 0);
  eq(await rows(w.db, `select added_by from ideas where id = $1`, [w.picnic]), [{ added_by: null }]);
});
