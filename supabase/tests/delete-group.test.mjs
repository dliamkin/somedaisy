// Database tests for supabase/updates/025-delete-group.sql. Run with: npm run test:db
import fs from 'node:fs';
import path from 'node:path';

import { as, eq, freshDb, newUser, one, rejects, REPO, test } from './harness.mjs';

const UPDATE = '025-delete-group.sql';

// By itself, and with the updates that hang more things on a group (group settings, comments, points, nudges).
for (const before of [[], ['001-push-notifications.sql', '003-comments.sql', '007-group-settings.sql', '008-you-did-it.sql', '016-live-updates.sql', '024-nudges.sql']]) {
  const db = await freshDb([...before, UPDATE]);
  const ann = await newUser(db, 'Ann');
  const bo = await newUser(db, 'Bo');
  const cy = await newUser(db, 'Cy');
  const zed = await newUser(db, 'Zed');

  const start = async (user, name) => {
    const id = await as(db, user, async () => (await one(db, `select create_group($1, 'mint', array['Food']) as id`, [name])).id);
    const { invite_code: code } = await one(db, `select invite_code from groups where id = $1`, [id]);
    const { id: list } = await one(db, `select id from lists where group_id = $1`, [id]);
    return { id, code, list };
  };
  const join = (user, group) => as(db, user, () => db.query(`select join_group($1)`, [group.code]));
  const addIdea = (user, group, title) =>
    as(db, user, async () => (await one(db, `insert into ideas (group_id, list_id, title, added_by) values ($1, $2, $3, $4) returning id`, [group.id, group.list, title, user])).id);
  const remove = (user, group, checkOnly = false) => as(db, user, () => db.query(`select delete_group($1, $2)`, [group.id, checkOnly]));
  const count = async (table, group) => (await one(db, `select count(*)::int as n from ${table} where ${table === 'groups' ? 'id' : 'group_id'} = $1`, [group.id])).n;

  console.log(`\nDelete a group${before.length ? ' (with the other updates)' : ''}`);

  const friends = await start(ann, 'Friends');
  await join(bo, friends);
  await join(cy, friends);
  const golf = await addIdea(ann, friends, 'Mini golf');
  await addIdea(bo, friends, 'Ramen');
  await as(db, bo, () => db.query(`insert into reactions (idea_id, group_id, user_id, emoji) values ($1, $2, $3, '👍')`, [golf, friends.id, bo]));
  const others = await start(zed, 'Strangers');
  await addIdea(zed, others, 'Chess');

  await test('only the owner can delete a group', async () => {
    await rejects(remove(bo, friends), /Only the group's owner/, 'a member');
    await rejects(remove(zed, friends), /not in that group/, 'an outsider');
    await rejects(remove(null, friends), /Not signed in|permission denied/, 'nobody');
    eq(await count('groups', friends), 1);
    eq(await count('ideas', friends), 2);
  });

  await test('asking only to check deletes nothing, and still says no to anyone but the owner', async () => {
    await remove(ann, friends, true);
    eq(await count('groups', friends), 1);
    eq(await count('ideas', friends), 2);
    await rejects(remove(bo, friends, true), /Only the group's owner/, 'a member');
  });

  await test('when the owner has left, whoever has been in the group longest can delete it', async () => {
    const club = await start(ann, 'Club');
    await join(bo, club);
    await join(cy, club);
    // In a test both join in the same instant. Cy is made the later of the two, as he would be in life.
    await db.query(`update group_members set joined_at = joined_at + interval '1 minute' where group_id = $1 and user_id = $2`, [club.id, cy]);
    await db.query(`delete from reactions where group_id = $1 and user_id = $2`, [club.id, ann]);
    await db.query(`delete from group_members where group_id = $1 and user_id = $2`, [club.id, ann]);
    await rejects(remove(cy, club), /Only the group's owner/, 'the newer member');
    await remove(bo, club);
    eq(await count('groups', club), 0);
  });

  await test('the owner deleting a group takes everything in it, for everyone', async () => {
    await remove(ann, friends);
    eq(await count('groups', friends), 0);
    for (const table of ['group_members', 'lists', 'ideas', 'reactions']) eq(await count(table, friends), 0, table);
    eq(await as(db, bo, async () => (await one(db, `select count(*)::int as n from groups where id = $1`, [friends.id])).n), 0, 'gone for the other members too');
  });

  await test('other groups, and the people themselves, are untouched', async () => {
    eq(await count('groups', others), 1);
    eq(await count('ideas', others), 1);
    eq((await one(db, `select count(*)::int as n from profiles where id in ($1, $2, $3)`, [ann, bo, cy])).n, 3);
  });

  await test('deleting a group that is already gone is refused, not an error to worry about', async () => {
    await rejects(remove(ann, friends), /not in that group/, 'a second time');
  });

  await test('running the update a second time changes nothing and does not fail', async () => {
    await db.exec(fs.readFileSync(path.join(REPO, 'supabase/updates', UPDATE), 'utf8'));
    eq(await count('groups', others), 1);
    await remove(zed, others);
    eq(await count('groups', others), 0);
  });
}
