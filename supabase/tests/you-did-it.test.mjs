// Database tests for supabase/updates/008-you-did-it.sql. Run with: npm run test:db
import fs from 'node:fs';
import path from 'node:path';

import { as, eq, freshDb, newUser, one, REPO, rejects, rows, test } from './harness.mjs';

const UPDATE = '008-you-did-it.sql';
const BEFORE = ['001-push-notifications.sql', '002-account-transfer.sql', '003-comments.sql'];
const sql = fs.readFileSync(path.join(REPO, 'supabase/updates', UPDATE), 'utf8');

// Ann and Bo share "Friends", which has a Food list and a Movies list. Zed is a stranger.
async function world({ withUpdate = true } = {}) {
  const db = await freshDb(withUpdate ? [...BEFORE, UPDATE] : BEFORE);
  const ann = await newUser(db, 'Ann');
  const bo = await newUser(db, 'Bo');
  const zed = await newUser(db, 'Zed');
  const makeGroup = (user, name) => as(db, user, async () => (await one(db, `select create_group($1, 'sky', array['Food', 'Movies']) as id`, [name])).id);
  const friends = await makeGroup(ann, 'Friends');
  const zeds = await makeGroup(zed, 'Zed only');
  const { invite_code: code } = await one(db, `select invite_code from groups where id = $1`, [friends]);
  await as(db, bo, () => db.query(`select join_group($1)`, [code]));
  const [{ id: food }, { id: movies }] = await rows(db, `select id from lists where group_id = $1 order by position`, [friends]);
  const { id: zedsList } = await one(db, `select id from lists where group_id = $1 order by position limit 1`, [zeds]);

  // `daysAgo` is how long ago the idea was added.
  const addIdea = async (user, title, { list = food, group = friends, daysAgo = 0 } = {}) => {
    const id = await as(db, user, async () =>
      (await one(db, `insert into ideas (group_id, list_id, title, added_by) values ($1, $2, $3, $4) returning id`, [group, list, title, user])).id);
    if (daysAgo) await db.query(`update ideas set created_at = now() - make_interval(days => $2) where id = $1`, [id, daysAgo]);
    return id;
  };
  const finish = (user, idea) => as(db, user, () => db.query(`update ideas set done_at = now() where id = $1`, [idea]));
  const putBack = (user, idea) => as(db, user, () => db.query(`update ideas set done_at = null where id = $1`, [idea]));
  // Make everything recorded so far look like it happened that many days ago.
  const age = (days) => db.query(`update completions set done_at = done_at - make_interval(days => $1)`, [days]);
  const done = (group = friends) => rows(db, `select title, list_name, points, repeat, first_in_list, long_wait, waited_days from completions where group_id = $1 order by done_at, title`, [group]);
  const points = async (group = friends) => (await one(db, `select coalesce(sum(points), 0)::int as n from completions where group_id = $1`, [group])).n;
  const vote = (user, idea, again, group = friends) => as(db, user, () =>
    db.query(`insert into do_again_votes (idea_id, group_id, user_id, again) values ($1, $2, $3, $4)
              on conflict (idea_id, user_id) do update set again = excluded.again, updated_at = now()`, [idea, group, user, again]));
  return { db, ann, bo, zed, friends, zeds, food, movies, zedsList, addIdea, finish, putBack, age, done, points, vote };
}

console.log('\nPoints for doing an idea');

await test('the first thing done from a list earns 10, plus 5 for everyone being there, plus 5 for the first', async () => {
  const w = await world();
  const picnic = await w.addIdea(w.ann, 'Picnic');
  await w.finish(w.bo, picnic);
  eq(await w.done(), [{ title: 'Picnic', list_name: 'Food', points: 20, repeat: false, first_in_list: true, long_wait: false, waited_days: 0 }]);
  eq((await one(w.db, `select marked_by from completions`)).marked_by, w.bo, 'who marked it');
});

await test('the next thing from the same list earns 15, and the first from another list 20 again', async () => {
  const w = await world();
  await w.finish(w.ann, await w.addIdea(w.ann, 'Picnic'));
  await w.finish(w.ann, await w.addIdea(w.ann, 'Tacos'));
  await w.finish(w.ann, await w.addIdea(w.ann, 'Film night', { list: w.movies }));
  eq((await w.done()).map((c) => [c.title, c.points, c.first_in_list]).sort(), [['Film night', 20, true], ['Picnic', 20, true], ['Tacos', 15, false]]);
  eq(await w.points(), 55);
});

await test('an idea that waited more than 90 days earns 10 more', async () => {
  const w = await world();
  await w.finish(w.ann, await w.addIdea(w.ann, 'First', { daysAgo: 1 }));
  await w.finish(w.ann, await w.addIdea(w.ann, 'Ninety', { daysAgo: 90 }));
  await w.finish(w.ann, await w.addIdea(w.ann, 'Ninety-one', { daysAgo: 91 }));
  const byTitle = Object.fromEntries((await w.done()).map((c) => [c.title, c]));
  eq([byTitle['Ninety'].points, byTitle['Ninety'].long_wait, byTitle['Ninety'].waited_days], [15, false, 90]);
  eq([byTitle['Ninety-one'].points, byTitle['Ninety-one'].long_wait, byTitle['Ninety-one'].waited_days], [25, true, 91]);
});

await test('each group has its own points and its own firsts', async () => {
  const w = await world();
  await w.finish(w.ann, await w.addIdea(w.ann, 'Picnic'));
  await w.finish(w.zed, await w.addIdea(w.zed, 'Solo hike', { group: w.zeds, list: w.zedsList }));
  eq([await w.points(w.friends), await w.points(w.zeds)], [20, 20]);
});

await test('changing anything else about an idea earns nothing', async () => {
  const w = await world();
  const picnic = await w.addIdea(w.ann, 'Picnic');
  await as(w.db, w.ann, () => w.db.query(`update ideas set title = 'Big picnic', planned_for = now() + interval '1 day' where id = $1`, [picnic]));
  eq(await w.done(), []);
});

console.log('\nDoing something again');

await test('a repeat earns 5, plus 5 for everyone being there, and no other bonuses', async () => {
  const w = await world();
  const picnic = await w.addIdea(w.ann, 'Picnic', { daysAgo: 200 });
  await w.finish(w.ann, picnic);
  await w.age(30);
  await w.putBack(w.ann, picnic);
  await w.finish(w.bo, picnic);
  eq((await w.done()).map((c) => [c.points, c.repeat, c.first_in_list, c.long_wait]), [[30, false, true, true], [10, true, false, false]]);
  eq(await w.points(), 40);
});

await test('marking it done, putting it back and marking it done again the same day counts once', async () => {
  const w = await world();
  const picnic = await w.addIdea(w.ann, 'Picnic');
  await w.finish(w.ann, picnic);
  await w.putBack(w.ann, picnic);
  await w.finish(w.ann, picnic);
  eq(await w.points(), 20);
  eq((await w.done()).length, 1);
});

await test('a made-up date earns nothing extra: the database uses its own clock', async () => {
  const w = await world();
  const picnic = await w.addIdea(w.ann, 'Picnic');
  // Marked done "200 days from now", then put back and marked done again further and further ahead.
  for (let n = 1; n <= 5; n++) {
    await as(w.db, w.ann, () => w.db.query(`update ideas set done_at = now() + make_interval(days => $2) where id = $1`, [picnic, 200 * n]));
    await w.putBack(w.ann, picnic);
  }
  eq((await w.done()).map((c) => [c.points, c.long_wait, c.waited_days]), [[20, false, 0]]);
  eq((await one(w.db, `select done_at <= now() as sane from completions`)).sane, true, 'recorded at the real time');
});

console.log('\nPoints never go down');

await test('putting an idea back on the list keeps its points', async () => {
  const w = await world();
  const picnic = await w.addIdea(w.ann, 'Picnic');
  await w.finish(w.ann, picnic);
  await w.putBack(w.ann, picnic);
  eq(await w.points(), 20);
});

await test('removing the idea, or its list, keeps the points and the idea\'s name', async () => {
  const w = await world();
  const picnic = await w.addIdea(w.ann, 'Picnic');
  await w.finish(w.ann, picnic);
  await as(w.db, w.ann, () => w.db.query(`delete from ideas where id = $1`, [picnic]));
  await as(w.db, w.ann, () => w.db.query(`delete from lists where id = $1`, [w.food]));
  eq(await rows(w.db, `select title, list_name, points, idea_id, list_id from completions`), [{ title: 'Picnic', list_name: 'Food', points: 20, idea_id: null, list_id: null }]);
});

await test('the person who marked it leaving does not take the points away', async () => {
  const w = await world();
  await w.finish(w.bo, await w.addIdea(w.ann, 'Picnic'));
  await w.db.query(`delete from profiles where id = $1`, [w.bo]);
  eq(await rows(w.db, `select points, marked_by from completions`), [{ points: 20, marked_by: null }]);
});

await test('the app cannot add, change or remove a completion', async () => {
  const w = await world();
  await w.finish(w.ann, await w.addIdea(w.ann, 'Picnic'));
  await rejects(as(w.db, w.ann, () => w.db.query(`insert into completions (group_id, title, points) values ($1, 'Cheat', 1000)`, [w.friends])), /row-level security/);
  await as(w.db, w.ann, () => w.db.query(`update completions set points = 1000`));
  await as(w.db, w.ann, () => w.db.query(`delete from completions`));
  eq(await w.points(), 20);
  await rejects(as(w.db, w.ann, () => w.db.query(`select record_completion($1, now(), $2)`, [w.friends, w.ann])), /permission denied/);
});

console.log('\nWho can see them');

await test('members see their group\'s completions, strangers see none', async () => {
  const w = await world();
  await w.finish(w.ann, await w.addIdea(w.ann, 'Picnic'));
  const seen = (user) => as(w.db, user, async () => (await rows(w.db, `select 1 from completions where group_id = $1`, [w.friends])).length);
  eq([await seen(w.ann), await seen(w.bo), await seen(w.zed)], [1, 1, 0]);
});

console.log('\nWould you do it again?');

await test('a member can answer, change their answer, and take it back', async () => {
  const w = await world();
  const picnic = await w.addIdea(w.ann, 'Picnic');
  await w.finish(w.ann, picnic);
  await w.vote(w.ann, picnic, true);
  await w.vote(w.bo, picnic, true);
  await w.vote(w.bo, picnic, false);
  eq(await rows(w.db, `select p.name, v.again from do_again_votes v join profiles p on p.id = v.user_id order by p.name`), [{ name: 'Ann', again: true }, { name: 'Bo', again: false }]);
  await as(w.db, w.bo, () => w.db.query(`delete from do_again_votes where idea_id = $1 and user_id = $2`, [picnic, w.bo]));
  eq((await one(w.db, `select count(*)::int as n from do_again_votes`)).n, 1);
});

await test('nobody can answer for someone else, or change their answer', async () => {
  const w = await world();
  const picnic = await w.addIdea(w.ann, 'Picnic');
  await rejects(as(w.db, w.ann, () => w.db.query(`insert into do_again_votes (idea_id, group_id, user_id, again) values ($1, $2, $3, true)`, [picnic, w.friends, w.bo])), /row-level security/);
  await w.vote(w.bo, picnic, false);
  await as(w.db, w.ann, () => w.db.query(`update do_again_votes set again = true where user_id = $1`, [w.bo]));
  await as(w.db, w.ann, () => w.db.query(`delete from do_again_votes where user_id = $1`, [w.bo]));
  eq(await rows(w.db, `select again from do_again_votes where user_id = $1`, [w.bo]), [{ again: false }]);
});

await test('a stranger can neither answer nor see the answers', async () => {
  const w = await world();
  const picnic = await w.addIdea(w.ann, 'Picnic');
  await w.vote(w.ann, picnic, true);
  await rejects(w.vote(w.zed, picnic, true), /row-level security/, 'answering');
  await rejects(w.vote(w.zed, picnic, true, w.zeds), /row-level security/, 'claiming it is in his own group');
  eq(await as(w.db, w.zed, async () => (await rows(w.db, `select 1 from do_again_votes`)).length), 0);
});

await test('answers go when the idea is removed', async () => {
  const w = await world();
  const picnic = await w.addIdea(w.ann, 'Picnic');
  await w.vote(w.ann, picnic, true);
  await as(w.db, w.ann, () => w.db.query(`delete from ideas where id = $1`, [picnic]));
  eq((await one(w.db, `select count(*)::int as n from do_again_votes`)).n, 0);
});

console.log('\nIdeas done before the update');

await test('each gets its record and points, oldest first', async () => {
  const w = await world({ withUpdate: false });
  const old = await w.addIdea(w.ann, 'Old', { daysAgo: 300 });
  const newer = await w.addIdea(w.ann, 'Newer', { daysAgo: 10 });
  await w.addIdea(w.ann, 'Not done yet');
  await w.db.query(`update ideas set done_at = now() - interval '100 days' where id = $1`, [old]);
  await w.db.query(`update ideas set done_at = now() - interval '2 days' where id = $1`, [newer]);
  await w.db.exec(sql);
  eq((await w.done()).map((c) => [c.title, c.points, c.first_in_list, c.long_wait, c.waited_days]), [['Old', 30, true, true, 200], ['Newer', 15, false, false, 8]]);
  eq((await one(w.db, `select done_at < now() - interval '99 days' as kept from completions where title = 'Old'`)).kept, true, 'keeps when it was done');
});

await test('running the update again adds nothing', async () => {
  const w = await world();
  await w.finish(w.ann, await w.addIdea(w.ann, 'Picnic'));
  await w.db.exec(sql);
  await w.db.exec(sql);
  eq(await w.points(), 20);
  eq((await w.done()).length, 1);
});

console.log('\nMoving a guest into an account');

await test('the guest\'s answers and completions come along, and the account\'s own answer wins', async () => {
  const w = await world();
  const guest = await newUser(w.db, 'Ann (new phone)');
  const GUEST = { guest: true };
  const { invite_code: code } = await one(w.db, `select invite_code from groups where id = $1`, [w.friends]);
  await as(w.db, guest, () => w.db.query(`select join_group($1)`, [code]), GUEST);
  const picnic = await w.addIdea(w.ann, 'Picnic');
  const tacos = await w.addIdea(w.ann, 'Tacos');
  await as(w.db, guest, () => w.db.query(`update ideas set done_at = now() where id = any($1)`, [[picnic, tacos]]), GUEST);
  await w.vote(w.ann, picnic, false);
  for (const idea of [picnic, tacos]) {
    await as(w.db, guest, () => w.db.query(`insert into do_again_votes (idea_id, group_id, user_id, again) values ($1, $2, $3, true)`, [idea, w.friends, guest]), GUEST);
  }
  const pass = (await as(w.db, guest, () => one(w.db, `select start_transfer() as pass`), GUEST)).pass;
  await as(w.db, w.ann, () => w.db.query(`select claim_transfer($1)`, [pass]));

  eq(await rows(w.db, `select i.title, v.again from do_again_votes v join ideas i on i.id = v.idea_id where v.user_id = $1 order by i.title`, [w.ann]),
    [{ title: 'Picnic', again: false }, { title: 'Tacos', again: true }]);
  eq((await one(w.db, `select count(*)::int as n from do_again_votes where user_id = $1`, [guest])).n, 0, 'nothing left with the guest');
  eq((await rows(w.db, `select distinct marked_by from completions`)).map((r) => r.marked_by), [w.ann]);
  eq(await w.points(), 35);
});
