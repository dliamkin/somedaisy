// Database tests for supabase/updates/027-delete-done.sql. Run with: npm run test:db
import fs from 'node:fs';
import path from 'node:path';

import { as, eq, freshDb, newUser, one, REPO, rejects, rows, test } from './harness.mjs';

const BEFORE = ['001-push-notifications.sql', '002-account-transfer.sql', '003-comments.sql', '008-you-did-it.sql', '013-undo-done.sql', '026-comment-reactions.sql'];
const UPDATES = [...BEFORE, '027-delete-done.sql'];

// Ann and Bo share "Friends", which has a Food list. Zed is a stranger.
async function world(updates = UPDATES) {
  const db = await freshDb(updates);
  const ann = await newUser(db, 'Ann');
  const bo = await newUser(db, 'Bo');
  const zed = await newUser(db, 'Zed');
  const friends = await as(db, ann, async () => (await one(db, `select create_group('Friends', 'sky', array['Food']) as id`)).id);
  const { invite_code: code } = await one(db, `select invite_code from groups where id = $1`, [friends]);
  await as(db, bo, () => db.query(`select join_group($1)`, [code]));
  const { id: food } = await one(db, `select id from lists where group_id = $1`, [friends]);

  const addIdea = (user, title) => as(db, user, async () =>
    (await one(db, `insert into ideas (group_id, list_id, title, added_by) values ($1, $2, $3, $4) returning id`, [friends, food, title, user])).id);
  const finish = (user, idea) => as(db, user, () => db.query(`update ideas set done_at = now() where id = $1`, [idea]));
  const putBack = (user, idea) => as(db, user, () => db.query(`update ideas set done_at = null where id = $1`, [idea]));
  const remove = (user, idea) => as(db, user, async () => (await one(db, `select delete_done($1) as ok`, [idea])).ok);
  // Make everything so far look like it happened that many days ago.
  const age = async (days) => {
    await db.query(`update completions set done_at = done_at - make_interval(days => $1)`, [days]);
    await db.query(`update ideas set done_at = done_at - make_interval(days => $1) where done_at is not null`, [days]);
  };
  const points = async () => (await one(db, `select coalesce(sum(points), 0)::int as n from completions where group_id = $1`, [friends])).n;
  const exists = async (idea) => (await rows(db, `select id from ideas where id = $1`, [idea])).length === 1;
  const records = () => rows(db, `select title, idea_id, forgotten, repeat, first_in_list, points from completions order by done_at, id`);
  return { db, ann, bo, zed, friends, food, addIdea, finish, putBack, remove, age, points, exists, records };
}

console.log('\nDeleting something the group did');

await test('the idea goes, its record is kept without its name, and the group keeps the points', async () => {
  const w = await world();
  const picnic = await w.addIdea(w.ann, 'Picnic');
  await w.finish(w.ann, picnic);
  eq(await w.points(), 20);
  eq(await w.remove(w.ann, picnic), true);
  eq(await w.exists(picnic), false);
  eq(await w.points(), 20);
  eq(await w.records(), [{ title: '', idea_id: null, forgotten: true, repeat: false, first_in_list: true, points: 20 }]);
});

await test('anyone in the group can delete it, not only whoever added or finished it', async () => {
  const w = await world();
  const picnic = await w.addIdea(w.ann, 'Picnic');
  await w.finish(w.ann, picnic);
  eq(await w.remove(w.bo, picnic), true);
  eq(await w.exists(picnic), false);
});

await test('a stranger cannot, and is told the same for an idea that does not exist', async () => {
  const w = await world();
  const picnic = await w.addIdea(w.ann, 'Picnic');
  await w.finish(w.ann, picnic);
  await rejects(w.remove(w.zed, picnic), /not in that group/);
  await rejects(w.remove(w.zed, '00000000-0000-4000-8000-000000000000'), /not in that group/);
  eq(await w.exists(picnic), true);
  eq((await w.records())[0].forgotten, false);
});

await test('someone who is not signed in cannot', async () => {
  const w = await world();
  const picnic = await w.addIdea(w.ann, 'Picnic');
  await w.finish(w.ann, picnic);
  await rejects(one(w.db, `select delete_done($1)`, [picnic]), /Not signed in/);
  eq(await w.exists(picnic), true);
});

await test('an idea that is not done is left alone, and so is one put back on its list', async () => {
  const w = await world();
  const picnic = await w.addIdea(w.ann, 'Picnic');
  eq(await w.remove(w.ann, picnic), false);
  await w.finish(w.ann, picnic);
  await w.age(2);
  await w.putBack(w.ann, picnic);
  eq(await w.remove(w.ann, picnic), false);
  eq(await w.exists(picnic), true);
  eq((await w.records()).map((r) => [r.title, r.forgotten]), [['Picnic', false]]);
});

await test('only that idea is forgotten: the others keep their names and stamps', async () => {
  const w = await world();
  const picnic = await w.addIdea(w.ann, 'Picnic');
  const tacos = await w.addIdea(w.ann, 'Tacos');
  await w.finish(w.ann, picnic);
  await w.finish(w.ann, tacos);
  eq(await w.remove(w.ann, picnic), true);
  eq((await w.records()).map((r) => [r.title, r.forgotten]).sort(), [['', true], ['Tacos', false]]);
  eq(await w.points(), 35);
  eq(await w.exists(tacos), true);
});

await test('something done twice has both of its records forgotten', async () => {
  const w = await world();
  const picnic = await w.addIdea(w.ann, 'Picnic');
  await w.finish(w.ann, picnic);
  await w.age(3);
  await w.putBack(w.ann, picnic);
  await w.finish(w.ann, picnic);
  eq(await w.points(), 30);
  eq(await w.remove(w.ann, picnic), true);
  eq((await w.records()).map((r) => [r.title, r.forgotten, r.repeat]), [['', true, false], ['', true, true]]);
  eq(await w.points(), 30);
});

await test('its comments, their reactions, its votes and its do-again answers go with it', async () => {
  const w = await world();
  const picnic = await w.addIdea(w.ann, 'Picnic');
  await as(w.db, w.bo, () => w.db.query(`insert into reactions (idea_id, group_id, user_id, emoji) values ($1, $2, $3, '👍')`, [picnic, w.friends, w.bo]));
  const { id: comment } = await as(w.db, w.ann, () =>
    one(w.db, `insert into comments (idea_id, group_id, user_id, body) values ($1, $2, $3, 'Bring a rug') returning id`, [picnic, w.friends, w.ann]));
  await as(w.db, w.bo, () => w.db.query(`insert into comment_reactions (comment_id, idea_id, group_id, user_id, emoji) values ($1, $2, $3, $4, '❤️')`, [comment, picnic, w.friends, w.bo]));
  await w.finish(w.ann, picnic);
  await as(w.db, w.bo, () => w.db.query(`insert into do_again_votes (idea_id, group_id, user_id, again) values ($1, $2, $3, true)`, [picnic, w.friends, w.bo]));
  eq(await w.remove(w.ann, picnic), true);
  for (const table of ['reactions', 'comments', 'comment_reactions', 'do_again_votes']) {
    eq((await one(w.db, `select count(*)::int as n from ${table}`)).n, 0, table);
  }
});

await test('the next thing done from that list is not a "first" again', async () => {
  const w = await world();
  const picnic = await w.addIdea(w.ann, 'Picnic');
  const tacos = await w.addIdea(w.ann, 'Tacos');
  await w.finish(w.ann, picnic);
  eq(await w.remove(w.ann, picnic), true);
  await w.finish(w.ann, tacos);
  eq((await w.records()).map((r) => [r.title, r.first_in_list, r.points]), [['', true, 20], ['Tacos', false, 15]]);
});

await test('a second delete of the same thing is refused like any idea that is not there', async () => {
  const w = await world();
  const picnic = await w.addIdea(w.ann, 'Picnic');
  await w.finish(w.ann, picnic);
  eq(await w.remove(w.ann, picnic), true);
  await rejects(w.remove(w.ann, picnic), /not in that group/);
  eq(await w.points(), 20);
});

await test('members still cannot change a record themselves', async () => {
  const w = await world();
  const picnic = await w.addIdea(w.ann, 'Picnic');
  await w.finish(w.ann, picnic);
  await as(w.db, w.ann, () => w.db.query(`update completions set forgotten = true, points = 0`));
  await as(w.db, w.ann, () => w.db.query(`delete from completions`));
  eq(await w.records(), [{ title: 'Picnic', idea_id: picnic, forgotten: false, repeat: false, first_in_list: true, points: 20 }]);
});

await test('the update can be run twice, and keeps what was forgotten', async () => {
  const w = await world();
  const picnic = await w.addIdea(w.ann, 'Picnic');
  await w.finish(w.ann, picnic);
  eq(await w.remove(w.ann, picnic), true);
  await w.db.exec(fs.readFileSync(path.join(REPO, 'supabase/updates', '027-delete-done.sql'), 'utf8'));
  eq((await w.records()).map((r) => [r.title, r.forgotten]), [['', true]]);
  const tacos = await w.addIdea(w.ann, 'Tacos');
  await w.finish(w.ann, tacos);
  eq(await w.remove(w.bo, tacos), true);
});

await test('records made before the update are not forgotten', async () => {
  const w = await world(BEFORE);
  const picnic = await w.addIdea(w.ann, 'Picnic');
  await w.finish(w.ann, picnic);
  await w.db.exec(fs.readFileSync(path.join(REPO, 'supabase/updates', '027-delete-done.sql'), 'utf8'));
  eq((await w.records()).map((r) => [r.title, r.forgotten]), [['Picnic', false]]);
});

await test('it will not run before the updates it needs', async () => {
  const db = await freshDb(['001-push-notifications.sql', '002-account-transfer.sql', '003-comments.sql']);
  await rejects(db.exec(fs.readFileSync(path.join(REPO, 'supabase/updates', '027-delete-done.sql'), 'utf8')), /Run update 008/);
});
