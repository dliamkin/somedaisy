// Database tests for supabase/updates/002-account-transfer.sql. Run with: npm run test:db
import fs from 'node:fs';
import path from 'node:path';

import { as, eq, freshDb, newUser, one, REPO, rejects, rows, test } from './harness.mjs';

// Both updates are loaded, so this also checks that moving a guest sends no stray notifications.
const db = await freshDb(['001-push-notifications.sql', '002-account-transfer.sql']);

const GUEST = { guest: true };
const group = async (owner, name, opts) =>
  as(db, owner, async () => (await one(db, `select create_group($1, 'sky', array['Food']) as id`, [name])).id, opts);
const join = async (user, groupId, opts) => {
  const { invite_code } = await one(db, `select invite_code from groups where id = $1`, [groupId]);
  await as(db, user, () => db.query(`select join_group($1)`, [invite_code]), opts);
};
const idea = async (user, groupId, title, opts) => {
  const { id: list } = await one(db, `select id from lists where group_id = $1 limit 1`, [groupId]);
  return as(db, user, async () =>
    (await one(db, `insert into ideas (group_id, list_id, title, added_by) values ($1, $2, $3, $4) returning id`, [groupId, list, title, user])).id, opts);
};
const react = (user, groupId, ideaId, emoji, opts) =>
  as(db, user, () => db.query(`insert into reactions (idea_id, group_id, user_id, emoji) values ($1, $2, $3, $4)`, [ideaId, groupId, user, emoji]), opts);
const start = (guest) => as(db, guest, async () => (await one(db, `select start_transfer() as pass`)).pass, GUEST);
const claim = (account, pass) => as(db, account, async () => (await one(db, `select claim_transfer($1) as moved`, [pass])).moved);
const groupsOf = async (user) => (await rows(db, `select g.name from group_members m join groups g on g.id = m.group_id where m.user_id = $1 order by g.name`, [user])).map((r) => r.name);
const reactionsOf = async (user, ideaId) => (await rows(db, `select emoji from reactions where user_id = $1 and idea_id = $2 order by emoji`, [user, ideaId])).map((r) => r.emoji);

// Ann has an account and is in "Book club" with Bo. On a new phone she used the app as a guest,
// started "Hiking" and joined "Book club" again, before signing in to her account.
const ann = await newUser(db, 'Ann');
const bo = await newUser(db, 'Bo');
const guest = await newUser(db, 'Ann (new phone)');

const bookClub = await group(bo, 'Book club');
await join(ann, bookClub);
await join(guest, bookClub, GUEST);
const hiking = await group(guest, 'Hiking', GUEST);
await join(bo, hiking);

const novel = await idea(bo, bookClub, 'Read a novel');
const poems = await idea(bo, bookClub, 'Read poems');
const summit = await idea(guest, hiking, 'Summit at dawn', GUEST);

await react(ann, bookClub, novel, '👎');          // the account already said no to the novel
await react(guest, bookClub, novel, '👍', GUEST);  // the guest said yes: the account's answer should win
await react(guest, bookClub, novel, '😍', GUEST);  // a different emoji: should come along
await react(ann, bookClub, poems, '😂');
await react(guest, bookClub, poems, '😂', GUEST);  // the same emoji on both: no duplicate
await react(guest, bookClub, poems, '👍', GUEST);  // the account has no thumb here: should come along
await react(guest, hiking, summit, '👍', GUEST);
await react(bo, hiking, summit, '👍');             // everyone in "Hiking" is in

await as(db, guest, () => db.query(`select register_push_token('ExponentPushToken[new-phone]', 'ios', 'UTC')`), GUEST);
await db.exec(`delete from net.calls`);

console.log('\nThe pass');

await test('running the update a second time does not fail', async () => {
  await db.exec(fs.readFileSync(path.join(REPO, 'supabase/updates/002-account-transfer.sql'), 'utf8'));
});

await test('only a guest can ask for a pass, and only an account can use one', async () => {
  await rejects(as(db, ann, () => db.query(`select start_transfer()`)), /Only a guest/, 'account asking');
  await rejects(as(db, null, () => db.query(`select start_transfer()`)), /Not signed in/, 'signed out asking');
  const pass = await start(guest);
  await rejects(as(db, guest, () => db.query(`select claim_transfer($1)`, [pass]), GUEST), /Sign in to an account first/, 'guest using');
  await rejects(as(db, null, () => db.query(`select claim_transfer($1)`, [pass])), /Not signed in/, 'signed out using');
});

await test('the app cannot read the passes, and the stored value is not the pass itself', async () => {
  const pass = await start(guest);
  eq(await as(db, guest, () => rows(db, `select * from account_transfers`), GUEST), [], 'guest sees none');
  eq(await as(db, ann, () => rows(db, `select * from account_transfers`)), [], 'account sees none');
  await rejects(as(db, ann, () => db.query(`insert into account_transfers (token_hash, from_user) values ('x', $1)`, [guest])), /row-level security/, 'forging');
  const stored = await rows(db, `select token_hash from account_transfers`);
  eq(stored.length, 1, 'asking again replaces the earlier pass');
  if (stored[0].token_hash === pass || stored[0].token_hash.includes(pass)) throw new Error('the pass is stored in the clear');
  if (pass.length < 60) throw new Error(`pass is too short to be unguessable: ${pass.length} characters`);
});

await test('a wrong, expired or already replaced pass moves nothing', async () => {
  const old = await start(guest);
  const current = await start(guest);
  await rejects(claim(ann, 'not-a-real-pass'), /not valid any more/, 'wrong');
  await rejects(claim(ann, old), /not valid any more/, 'replaced');
  await db.exec(`update account_transfers set expires_at = now() - interval '1 minute'`);
  await rejects(claim(ann, current), /not valid any more/, 'expired');
  eq(await groupsOf(guest), ['Book club', 'Hiking'], 'guest untouched');
  eq(await groupsOf(ann), ['Book club'], 'account untouched');
});

await test("someone else's pass cannot be used to take over a different guest", async () => {
  const other = await newUser(db, 'Other guest');
  await group(other, 'Private', GUEST);
  const pass = await start(guest);
  // Bo has no pass for "Other guest", and guessing gets him nowhere.
  await rejects(claim(bo, pass.split('').reverse().join('')), /not valid any more/);
  eq(await groupsOf(other), ['Private']);
});

console.log('\nMoving the guest into the account');

let moved;
await test('the account gains the groups it was not already in', async () => {
  moved = await claim(ann, await start(guest));
  eq(moved, 1, 'one new group (Hiking); Book club was already hers');
  eq(await groupsOf(ann), ['Book club', 'Hiking']);
});

await test('the guest is gone, with nothing left behind', async () => {
  eq(await rows(db, `select 1 from profiles where id = $1`, [guest]), [], 'profile');
  eq(await groupsOf(guest), [], 'memberships');
  eq(await rows(db, `select 1 from reactions where user_id = $1`, [guest]), [], 'reactions');
  eq(await rows(db, `select 1 from push_tokens where user_id = $1`, [guest]), [], 'phones');
  eq(await rows(db, `select 1 from account_transfers`), [], 'the pass is used up');
});

await test('each group has the right people, with no double entry', async () => {
  const members = async (g) => (await rows(db, `select p.name from group_members m join profiles p on p.id = m.user_id where m.group_id = $1 order by p.name`, [g])).map((r) => r.name);
  eq(await members(bookClub), ['Ann', 'Bo']);
  eq(await members(hiking), ['Ann', 'Bo']);
});

await test('ideas the guest added and groups the guest started now belong to the account', async () => {
  eq((await one(db, `select added_by from ideas where id = $1`, [summit])).added_by, ann);
  eq((await one(db, `select created_by from groups where id = $1`, [hiking])).created_by, ann);
});

await test("reactions come along, but the account's own thumb wins and nothing is doubled", async () => {
  eq(await reactionsOf(ann, novel), ['👎', '😍'], 'novel: kept her thumbs down, gained the heart eyes');
  eq(await reactionsOf(ann, poems), ['👍', '😂'], 'poems: gained the thumbs up, one laugh not two');
  eq(await reactionsOf(ann, summit), ['👍'], 'summit: thumbs up carried over');
});

await test('an idea that was "everyone\'s in" still is', async () => {
  const { n } = await one(db, `select count(*)::int as n from reactions r join group_members m on m.group_id = r.group_id and m.user_id = r.user_id where r.idea_id = $1 and r.emoji = '👍'`, [summit]);
  eq(n, 2);
});

await test('moving sends no notifications to anyone', async () => {
  eq(await rows(db, `select 1 from net.calls`), []);
});

await test('the same pass cannot be used twice', async () => {
  const again = await newUser(db, 'Guest again');
  await group(again, 'Second phone', GUEST);
  const pass = await start(again);
  eq(await claim(ann, pass), 1);
  await rejects(claim(bo, pass), /not valid any more/);
  eq(await groupsOf(ann), ['Book club', 'Hiking', 'Second phone']);
});

console.log('\nEdge cases');

await test('a guest who never picked a name gets no pass, and signing in still works', async () => {
  const nameless = await newUser(db, null);
  eq(await start(nameless), null);
});

await test('a guest with a name but no groups can be moved, harmlessly', async () => {
  const empty = await newUser(db, 'Empty guest');
  eq(await claim(bo, await start(empty)), 0);
  eq(await rows(db, `select 1 from profiles where id = $1`, [empty]), []);
  eq(await groupsOf(bo), ['Book club', 'Hiking']);
});

await test('an account with no name yet cannot receive a guest', async () => {
  const guestToo = await newUser(db, 'Guest too');
  const namelessAccount = await newUser(db, null);
  const pass = await start(guestToo);
  await rejects(claim(namelessAccount, pass), /Set your name first/);
  // The refusal undid everything, so the pass still works for the right account.
  eq(await claim(bo, pass), 0);
});
