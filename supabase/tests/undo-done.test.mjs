// Database tests for supabase/updates/013-undo-done.sql. Run with: npm run test:db
import { as, eq, freshDb, newUser, one, rejects, rows, test } from './harness.mjs';

const UPDATES = ['001-push-notifications.sql', '002-account-transfer.sql', '003-comments.sql', '008-you-did-it.sql', '013-undo-done.sql'];

// Ann and Bo share "Friends", which has a Food list. Zed is a stranger.
async function world() {
  const db = await freshDb(UPDATES);
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
  const undo = (user, idea) => as(db, user, async () => (await one(db, `select undo_done($1) as ok`, [idea])).ok);
  // Make everything so far look like it happened that many minutes ago.
  const age = async (minutes) => {
    await db.query(`update completions set done_at = done_at - make_interval(mins => $1)`, [minutes]);
    await db.query(`update ideas set done_at = done_at - make_interval(mins => $1) where done_at is not null`, [minutes]);
  };
  const points = async () => (await one(db, `select coalesce(sum(points), 0)::int as n from completions where group_id = $1`, [friends])).n;
  const isDone = async (idea) => (await one(db, `select done_at from ideas where id = $1`, [idea])).done_at !== null;
  const vote = (user, idea, again) => as(db, user, () =>
    db.query(`insert into do_again_votes (idea_id, group_id, user_id, again) values ($1, $2, $3, $4)`, [idea, friends, user, again]));
  const votes = async (idea) => (await one(db, `select count(*)::int as n from do_again_votes where idea_id = $1`, [idea])).n;
  return { db, ann, bo, zed, addIdea, finish, putBack, undo, age, points, isDone, vote, votes };
}

console.log('\nUndoing a mistaken "We did it"');

await test('straight away, the idea goes back and its points and stamp are removed', async () => {
  const w = await world();
  const picnic = await w.addIdea(w.ann, 'Picnic');
  await w.finish(w.ann, picnic);
  eq(await w.points(), 20);
  eq(await w.undo(w.ann, picnic), true);
  eq([await w.isDone(picnic), await w.points()], [false, 0]);
  eq(await rows(w.db, `select id from completions`), []);
});

await test('anyone in the group can undo it, not only the one who marked it', async () => {
  const w = await world();
  const picnic = await w.addIdea(w.ann, 'Picnic');
  await w.finish(w.ann, picnic);
  eq(await w.undo(w.bo, picnic), true);
  eq(await w.points(), 0);
});

await test('nine minutes later it still works, eleven minutes later it does not and nothing changes', async () => {
  const w = await world();
  const picnic = await w.addIdea(w.ann, 'Picnic');
  const tacos = await w.addIdea(w.ann, 'Tacos');
  await w.finish(w.ann, picnic);
  await w.age(9);
  await w.finish(w.ann, tacos);
  await w.age(2);
  eq(await w.undo(w.ann, picnic), false, 'eleven minutes');
  eq([await w.isDone(picnic), await w.points()], [true, 35]);
  await w.age(7);
  eq(await w.undo(w.ann, tacos), true, 'nine minutes');
  eq([await w.isDone(tacos), await w.points()], [false, 20]);
});

await test('undoing only takes back that idea, and it earns its points afresh when really done', async () => {
  const w = await world();
  const picnic = await w.addIdea(w.ann, 'Picnic');
  const tacos = await w.addIdea(w.ann, 'Tacos');
  await w.finish(w.ann, picnic);
  await w.finish(w.ann, tacos);
  eq(await w.undo(w.ann, picnic), true);
  eq(await w.points(), 15);
  await w.finish(w.bo, picnic);
  eq(await w.points(), 30);
});

await test('an idea that is not done answers "nothing to undo", and so does a second undo', async () => {
  const w = await world();
  const picnic = await w.addIdea(w.ann, 'Picnic');
  eq(await w.undo(w.ann, picnic), false);
  await w.finish(w.ann, picnic);
  eq(await w.undo(w.ann, picnic), true);
  eq(await w.undo(w.ann, picnic), false);
});

await test('a repeat undone keeps the earlier time it was done, and the answers given then', async () => {
  const w = await world();
  const picnic = await w.addIdea(w.ann, 'Picnic');
  await w.finish(w.ann, picnic);
  await w.vote(w.ann, picnic, true);
  await w.age(60 * 24 * 30);
  await w.putBack(w.ann, picnic);
  await w.finish(w.ann, picnic);
  eq(await w.points(), 30);
  eq(await w.undo(w.ann, picnic), true);
  eq([await w.isDone(picnic), await w.points(), await w.votes(picnic)], [false, 20, 1]);
});

await test('the same outing marked twice earned nothing the second time: undo puts it back and removes nothing', async () => {
  const w = await world();
  const picnic = await w.addIdea(w.ann, 'Picnic');
  await w.finish(w.ann, picnic);
  await w.age(60);
  await w.putBack(w.ann, picnic);
  await w.finish(w.ann, picnic);
  eq(await w.points(), 20);
  eq(await w.undo(w.ann, picnic), true);
  eq([await w.isDone(picnic), await w.points()], [false, 20]);
});

await test('answers to "would you do it again?" go with a first time that is undone', async () => {
  const w = await world();
  const picnic = await w.addIdea(w.ann, 'Picnic');
  await w.finish(w.ann, picnic);
  await w.vote(w.ann, picnic, true);
  await w.vote(w.bo, picnic, false);
  eq(await w.undo(w.ann, picnic), true);
  eq(await w.votes(picnic), 0);
});

await test('a stranger cannot undo it, and neither can someone who is not signed in', async () => {
  const w = await world();
  const picnic = await w.addIdea(w.ann, 'Picnic');
  await w.finish(w.ann, picnic);
  await rejects(w.undo(w.zed, picnic), /not in that group/);
  await rejects(w.db.query(`select undo_done($1)`, [picnic]), /Not signed in/);
  await rejects(w.undo(w.ann, '00000000-0000-0000-0000-000000000000'), /not in that group/);
  eq([await w.isDone(picnic), await w.points()], [true, 20]);
});

await test('running the update again changes nothing', async () => {
  const w = await world();
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { REPO } = await import('./harness.mjs');
  await w.db.exec(fs.readFileSync(path.join(REPO, 'supabase/updates/013-undo-done.sql'), 'utf8'));
  const picnic = await w.addIdea(w.ann, 'Picnic');
  await w.finish(w.ann, picnic);
  eq(await w.undo(w.ann, picnic), true);
});
