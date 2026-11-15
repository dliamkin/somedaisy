// Database tests for supabase/updates/007-group-settings.sql. Run with: npm run test:db
import fs from 'node:fs';
import path from 'node:path';

import { as, eq, freshDb, newUser, one, REPO, rejects, rows, test } from './harness.mjs';

const UPDATE = '007-group-settings.sql';
const ALL = ['001-push-notifications.sql', '002-account-transfer.sql', '003-comments.sql', '004-profile-photo.sql', '005-delete-account.sql', UPDATE];

// Ann starts "Friends"; Bo then Cy join it. Zed is a stranger with a group of his own.
async function world() {
  const db = await freshDb(ALL);
  const ann = await newUser(db, 'Ann');
  const bo = await newUser(db, 'Bo');
  const cy = await newUser(db, 'Cy');
  const zed = await newUser(db, 'Zed');
  const makeGroup = (user, name) => as(db, user, async () => (await one(db, `select create_group($1, 'sky', array['Food']) as id`, [name])).id);
  const friends = await makeGroup(ann, 'Friends');
  const zeds = await makeGroup(zed, 'Zed only');
  const codeOf = async (g) => (await one(db, `select invite_code from groups where id = $1`, [g])).invite_code;
  const code = await codeOf(friends);
  await as(db, bo, () => db.query(`select join_group($1)`, [code]));
  await as(db, cy, () => db.query(`select join_group($1)`, [code]));
  // Make the order people joined in unmistakable.
  await db.query(`update group_members set joined_at = now() - interval '3 days' where user_id = $1`, [ann]);
  await db.query(`update group_members set joined_at = now() - interval '2 days' where user_id = $1`, [bo]);
  await db.query(`update group_members set joined_at = now() - interval '1 day' where user_id = $1`, [cy]);

  const { id: list } = await one(db, `select id from lists where group_id = $1`, [friends]);
  const addIdea = (user, title) => as(db, user, async () =>
    (await one(db, `insert into ideas (group_id, list_id, title, added_by) values ($1, $2, $3, $4) returning id`, [friends, list, title, user])).id);
  const react = (user, idea, emoji = '👍') => as(db, user, () =>
    db.query(`insert into reactions (idea_id, group_id, user_id, emoji) values ($1, $2, $3, $4)`, [idea, friends, user, emoji]));
  const picnic = await addIdea(ann, 'Picnic');
  const bowling = await addIdea(bo, 'Bowling');
  for (const user of [ann, bo, cy]) await react(user, picnic);
  await react(bo, bowling, '😍');
  await as(db, bo, () => db.query(`insert into comments (idea_id, group_id, user_id, body) values ($1, $2, $3, 'Yes!')`, [picnic, friends, bo]));

  const count = async (sql, params = []) => (await one(db, `select count(*)::int as n from ${sql}`, params)).n;
  const members = async (g = friends) => (await rows(db, `select p.name from group_members m join profiles p on p.id = m.user_id where m.group_id = $1 order by p.name`, [g])).map((r) => r.name);
  const owner = async (g = friends) => (await one(db, `select group_owner($1) as id`, [g])).id;
  return { db, ann, bo, cy, zed, friends, zeds, code, codeOf, picnic, bowling, count, members, owner };
}

console.log('\nWho the owner is');

await test('the person who started the group', async () => {
  const w = await world();
  eq(await w.owner(), w.ann);
});

await test('whoever has been there longest, once the starter has left', async () => {
  const w = await world();
  await as(w.db, w.ann, () => w.db.query(`select leave_group($1)`, [w.friends]));
  eq(await w.owner(), w.bo);
});

await test('whoever has been there longest, once the starter has deleted their account', async () => {
  const w = await world();
  await as(w.db, w.ann, () => w.db.query(`select delete_account()`));
  eq(await w.owner(), w.bo);
});

await test('the app cannot ask the database who owns a group', async () => {
  const w = await world();
  await rejects(as(w.db, w.zed, () => w.db.query(`select group_owner($1)`, [w.friends])), /permission denied/);
});

console.log('\nLeaving a group');

await test('takes you out, with your reactions, and leaves the rest', async () => {
  const w = await world();
  await as(w.db, w.bo, () => w.db.query(`select leave_group($1)`, [w.friends]));
  eq(await w.members(), ['Ann', 'Cy']);
  eq(await w.count(`reactions where group_id = $1 and user_id = $2`, [w.friends, w.bo]), 0, 'reactions');
  eq(await w.count(`reactions where idea_id = $1`, [w.picnic]), 2, 'friends\' reactions stay');
  eq(await rows(w.db, `select title, added_by from ideas where id = $1`, [w.bowling]), [{ title: 'Bowling', added_by: w.bo }]);
  eq(await w.count(`comments where idea_id = $1`, [w.picnic]), 1, 'comments stay');
  eq(await w.count(`profiles where id = $1`, [w.bo]), 1, 'still a person');
});

await test('someone who has left can no longer see the group', async () => {
  const w = await world();
  await as(w.db, w.bo, () => w.db.query(`select leave_group($1)`, [w.friends]));
  eq(await as(w.db, w.bo, async () => (await rows(w.db, `select 1 from ideas where group_id = $1`, [w.friends])).length), 0);
});

await test('the last person out deletes the group and everything in it', async () => {
  const w = await world();
  for (const user of [w.ann, w.bo, w.cy]) await as(w.db, user, () => w.db.query(`select leave_group($1)`, [w.friends]));
  eq(await w.count(`groups where id = $1`, [w.friends]), 0, 'group');
  eq(await w.count(`ideas where group_id = $1`, [w.friends]), 0, 'ideas');
  eq(await w.count(`groups where id = $1`, [w.zeds]), 1, 'other groups are untouched');
});

await test('you cannot leave a group you are not in', async () => {
  const w = await world();
  await rejects(as(w.db, w.zed, () => w.db.query(`select leave_group($1)`, [w.friends])), /not in that group/);
  eq(await w.members(), ['Ann', 'Bo', 'Cy']);
});

console.log('\nRemoving someone');

await test('the owner can remove a member, and their reactions go too', async () => {
  const w = await world();
  await as(w.db, w.ann, () => w.db.query(`select remove_member($1, $2)`, [w.friends, w.cy]));
  eq(await w.members(), ['Ann', 'Bo']);
  eq(await w.count(`reactions where group_id = $1 and user_id = $2`, [w.friends, w.cy]), 0);
});

await test('nobody else can', async () => {
  const w = await world();
  await rejects(as(w.db, w.bo, () => w.db.query(`select remove_member($1, $2)`, [w.friends, w.cy])), /Only the group's owner/, 'a member');
  await rejects(as(w.db, w.zed, () => w.db.query(`select remove_member($1, $2)`, [w.friends, w.cy])), /Only the group's owner/, 'a stranger');
  eq(await w.members(), ['Ann', 'Bo', 'Cy']);
});

await test('the owner cannot remove themselves that way', async () => {
  const w = await world();
  await rejects(as(w.db, w.ann, () => w.db.query(`select remove_member($1, $2)`, [w.friends, w.ann])), /leave the group instead/);
});

await test('someone who was removed can come back only with a working invite link', async () => {
  const w = await world();
  await as(w.db, w.ann, () => w.db.query(`select remove_member($1, $2)`, [w.friends, w.cy]));
  await as(w.db, w.ann, () => w.db.query(`select reset_invite_code($1)`, [w.friends]));
  await rejects(as(w.db, w.cy, () => w.db.query(`select join_group($1)`, [w.code])), /not valid/);
  eq(await w.members(), ['Ann', 'Bo']);
});

console.log('\nA new invite link');

await test('the owner gets a new code, and the old one stops working', async () => {
  const w = await world();
  const fresh = (await as(w.db, w.ann, () => one(w.db, `select reset_invite_code($1) as code`, [w.friends]))).code;
  eq(fresh !== w.code && /^[0-9a-f]{10}$/.test(fresh), true, 'a new code');
  eq(await w.codeOf(w.friends), fresh);
  await rejects(as(w.db, w.zed, () => w.db.query(`select join_group($1)`, [w.code])), /not valid/);
  await as(w.db, w.zed, () => w.db.query(`select join_group($1)`, [fresh]));
  eq(await w.members(), ['Ann', 'Bo', 'Cy', 'Zed']);
});

await test('nobody else can change it', async () => {
  const w = await world();
  await rejects(as(w.db, w.bo, () => w.db.query(`select reset_invite_code($1)`, [w.friends])), /Only the group's owner/, 'a member');
  await rejects(as(w.db, w.zed, () => w.db.query(`select reset_invite_code($1)`, [w.friends])), /Only the group's owner/, 'a stranger');
  eq(await w.codeOf(w.friends), w.code);
});

console.log('\nChanging a group directly');

await test('a member can rename the group and change its cover', async () => {
  const w = await world();
  await as(w.db, w.bo, () => w.db.query(`update groups set name = 'Best friends', cover = 'mint' where id = $1`, [w.friends]));
  eq(await one(w.db, `select name, cover from groups where id = $1`, [w.friends]), { name: 'Best friends', cover: 'mint' });
});

await test('a member cannot set the invite code or who started the group', async () => {
  const w = await world();
  await rejects(as(w.db, w.bo, () => w.db.query(`update groups set invite_code = 'guessable1' where id = $1`, [w.friends])), /cannot be changed directly/, 'code');
  await rejects(as(w.db, w.bo, () => w.db.query(`update groups set created_by = $2 where id = $1`, [w.friends, w.bo])), /cannot be changed directly/, 'starter');
  eq(await w.codeOf(w.friends), w.code);
  eq(await w.owner(), w.ann);
});

await test('a stranger cannot rename it', async () => {
  const w = await world();
  await as(w.db, w.zed, () => w.db.query(`update groups set name = 'Hacked' where id = $1`, [w.friends]));
  eq((await one(w.db, `select name from groups where id = $1`, [w.friends])).name, 'Friends');
});

await test('moving a guest into an account still hands over the groups they started', async () => {
  const w = await world();
  const guest = await newUser(w.db, 'Guest');
  const g = await as(w.db, guest, async () => (await one(w.db, `select create_group('Guest group', 'sky', array['Food']) as id`)).id, { guest: true });
  const pass = (await as(w.db, guest, () => one(w.db, `select start_transfer() as pass`), { guest: true })).pass;
  await as(w.db, w.zed, () => w.db.query(`select claim_transfer($1)`, [pass]));
  eq((await one(w.db, `select created_by from groups where id = $1`, [g])).created_by, w.zed);
});

console.log('\nRunning the update twice');

await test('is harmless', async () => {
  const w = await world();
  await w.db.exec(fs.readFileSync(path.join(REPO, 'supabase/updates', UPDATE), 'utf8'));
  eq(await w.members(), ['Ann', 'Bo', 'Cy']);
  eq(await w.owner(), w.ann);
});
