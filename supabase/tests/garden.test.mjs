// Database tests for supabase/updates/023-garden-look.sql and 024-nudges.sql. Run with: npm run test:db
import fs from 'node:fs';
import path from 'node:path';

import { as, eq, freshDb, newUser, one, rejects, REPO, rows, test } from './harness.mjs';

const LOOK = '023-garden-look.sql';
const NUDGES = '024-nudges.sql';

// ---------- How a group's garden looks ----------

// With and without update 007 (group settings), which also watches what changes on a group.
for (const before of [[], ['001-push-notifications.sql', '002-account-transfer.sql', '003-comments.sql', '004-profile-photo.sql', '005-delete-account.sql', '007-group-settings.sql']]) {
  const db = await freshDb([...before, LOOK]);
  const ann = await newUser(db, 'Ann');
  const bo = await newUser(db, 'Bo');
  const zed = await newUser(db, 'Zed');
  const group = await as(db, ann, async () => (await one(db, `select create_group('Friends', 'mint', array['Food']) as id`)).id);
  const { invite_code: code } = await one(db, `select invite_code from groups where id = $1`, [group]);
  await as(db, bo, () => db.query(`select join_group($1)`, [code]));

  const lookOf = async () => (await one(db, `select garden from groups where id = $1`, [group])).garden;
  const setLook = (user, look) => as(db, user, () => db.query(`update groups set garden = $2 where id = $1`, [group, look === null ? null : JSON.stringify(look)]));
  const teal = { roof: '#1FA98A', walls: '#FFD9C7', door: '#E8B923', lawn: 'mown', bench: true, bath: false, lights: true };

  console.log(`\nGarden look${before.length ? ' (with update 007)' : ''}`);

  await test('every group starts with no choices: the garden as it first was', async () => {
    eq(await lookOf(), null);
  });

  await test('any member can change how the garden looks', async () => {
    await setLook(bo, teal);
    eq((await lookOf()).roof, '#1FA98A');
    eq((await lookOf()).lawn, 'mown');
    eq((await lookOf()).bath, false);
    await setLook(ann, { ...teal, lawn: 'meadow' });
    eq((await lookOf()).lawn, 'meadow');
  });

  await test('someone outside the group cannot', async () => {
    await setLook(zed, { ...teal, roof: '#000000' });
    eq((await lookOf()).roof, '#1FA98A');
  });

  await test('the choices can be emptied again', async () => {
    await setLook(ann, null);
    eq(await lookOf(), null);
  });

  await test('anything not shaped the way the app writes it is refused', async () => {
    const bad = {
      'not an object': 'mown',
      'a list': [teal],
      'no roof': { ...teal, roof: undefined },
      'a colour by name': { ...teal, walls: 'pink' },
      'a short colour': { ...teal, door: '#fff' },
      'a colour with something after it': { ...teal, roof: '#1FA98A; x' },
      'an unknown lawn': { ...teal, lawn: 'astroturf' },
      'a switch that is not yes or no': { ...teal, bench: 'yes' },
      'a missing switch': { ...teal, lights: undefined },
      'far too much': { ...teal, extra: 'x'.repeat(500) },
    };
    for (const [what, look] of Object.entries(bad)) await rejects(setLook(ann, look), /groups_garden_check/, what);
    eq(await lookOf(), null);
  });

  await test('running the update a second time changes nothing and does not fail', async () => {
    await setLook(ann, teal);
    await db.exec(fs.readFileSync(path.join(REPO, 'supabase/updates', LOOK), 'utf8'));
    eq((await lookOf()).door, '#E8B923');
  });
}

// ---------- Water to nudge ----------

// With and without update 010, which adds muting a group.
for (const withMute of [false, true]) {
  const db = await freshDb(['001-push-notifications.sql', '003-comments.sql', ...(withMute ? ['010-notification-polish.sql'] : []), NUDGES]);
  // Ann, Bo, Cy and Di share "Friends". Zed is an outsider.
  const ann = await newUser(db, 'Ann');
  const bo = await newUser(db, 'Bo');
  const cy = await newUser(db, 'Cy');
  const di = await newUser(db, 'Di');
  const zed = await newUser(db, 'Zed');
  const group = await as(db, ann, async () => (await one(db, `select create_group('Friends', 'sky', array['Food']) as id`)).id);
  const { invite_code: code } = await one(db, `select invite_code from groups where id = $1`, [group]);
  for (const user of [bo, cy, di]) await as(db, user, () => db.query(`select join_group($1)`, [code]));
  const { id: list } = await one(db, `select id from lists where group_id = $1`, [group]);
  for (const [user, token] of [[ann, 'ann'], [bo, 'bo'], [cy, 'cy'], [di, 'di'], [zed, 'zed']]) {
    await as(db, user, () => db.query(`select register_push_token($1, 'ios', 'UTC')`, [`ExponentPushToken[${token}-phone]`]));
  }

  const sent = async () => {
    const calls = await rows(db, `select body from net.calls order by id`);
    await db.exec(`delete from net.calls`);
    return calls.flatMap((c) => c.body);
  };
  const addIdea = (user, title) =>
    as(db, user, async () => (await one(db, `insert into ideas (group_id, list_id, title, added_by) values ($1, $2, $3, $4) returning id`, [group, list, title, user])).id);
  const react = (user, idea, emoji) => as(db, user, () => db.query(`insert into reactions (idea_id, group_id, user_id, emoji) values ($1, $2, $3, $4)`, [idea, group, user, emoji]));
  const water = (user, idea) => as(db, user, async () => (await one(db, `select nudge_idea($1) as nudged`, [idea])).nudged);
  // Make every nudge so far look older than the limit.
  const nextDay = () => db.exec(`update idea_nudges set sent_at = sent_at - interval '25 hours'`);
  const sorted = (ids) => [...ids].sort();

  console.log(`\nWater to nudge${withMute ? ' (with update 010)' : ''}`);

  const golf = await addIdea(ann, 'Mini golf');
  await react(bo, golf, '👍');
  await react(di, golf, '👎');
  await sent();

  await test('watering nudges the members who have not voted, and nobody else', async () => {
    eq(await water(ann, golf), [cy], 'Bo is in, Di said Eh, Ann is the one watering');
    const pushes = await sent();
    eq(pushes.map((p) => p.to), ['ExponentPushToken[cy-phone]']);
    eq(pushes[0].title, 'Friends');
    eq(pushes[0].body, 'Ann watered Mini golf. Are you in?');
    eq(pushes[0].data.url, `/group/${group}`);
  });

  await test('a person gets one nudge about an idea in 24 hours, whoever waters', async () => {
    eq(await water(ann, golf), []);
    eq(await water(bo, golf), [ann], 'Bo watering nudges Ann, who has not voted, but not Cy again');
    eq((await sent()).map((p) => p.to), ['ExponentPushToken[ann-phone]']);
    eq(await water(di, golf), []);
    eq(await sent(), []);
  });

  await test('the next day they can be nudged again', async () => {
    await nextDay();
    eq(sorted(await water(bo, golf)), sorted([ann, cy]));
    eq((await sent()).length, 2);
  });

  await test('someone who has since answered is left alone', async () => {
    await nextDay();
    await react(cy, golf, '👎');
    await sent();
    eq(await water(bo, golf), [ann]);
    await sent();
  });

  await test('a reaction that is not an answer does not count as one', async () => {
    const ramen = await addIdea(ann, 'Ramen');
    await react(bo, ramen, '❤️');
    await sent();
    eq(sorted(await water(ann, ramen)), sorted([bo, cy, di]));
    await sent();
  });

  await test('someone who has switched nudges off gets no push, and their other choices stay', async () => {
    const tacos = await addIdea(ann, 'Tacos');
    await as(db, cy, () => db.query(`select set_notification_settings(true, false, false)`));
    await as(db, cy, () => db.query(`select set_notification_settings(true, false, p_nudges => false)`));
    eq(await one(db, `select reactions, reminders, comments, nudges from notification_settings where user_id = $1`, [cy]), { reactions: true, reminders: false, comments: false, nudges: false });
    eq(sorted(await water(ann, tacos)), sorted([bo, cy, di]), 'the answer does not give away who has them off');
    eq(sorted((await sent()).map((p) => p.to)), ['ExponentPushToken[bo-phone]', 'ExponentPushToken[di-phone]']);
    // An older copy of the app saves three choices and leaves nudges as they were.
    await as(db, cy, () => db.query(`select set_notification_settings(true, true, true)`));
    eq((await one(db, `select nudges from notification_settings where user_id = $1`, [cy])).nudges, false);
  });

  if (withMute) {
    await test('a muted group stays silent', async () => {
      const hike = await addIdea(ann, 'Hike');
      await as(db, bo, () => db.query(`select set_group_muted($1, true)`, [group]));
      await water(ann, hike);
      eq(sorted((await sent()).map((p) => p.to)), ['ExponentPushToken[di-phone]'], 'Bo has muted the group and Cy has nudges off');
      await as(db, bo, () => db.query(`select set_group_muted($1, false)`, [group]));
    });
  }

  await test('an idea that is done nudges nobody', async () => {
    const swim = await addIdea(ann, 'Swim');
    await as(db, ann, () => db.query(`update ideas set done_at = now() where id = $1`, [swim]));
    await sent();
    eq(await water(ann, swim), []);
    eq(await sent(), []);
  });

  await test('only a member of the group can water its ideas', async () => {
    await nextDay();
    await rejects(water(zed, golf), /not in one of your groups/, 'an outsider');
    await rejects(water(ann, '00000000-0000-0000-0000-000000000000'), /not in one of your groups/, 'an idea that is not there');
    await rejects(water(null, golf), /Not signed in|permission denied/, 'nobody');
    eq(await sent(), []);
  });

  await test('the app cannot read or write the record of nudges directly', async () => {
    eq(await as(db, ann, () => rows(db, `select * from idea_nudges`)), []);
    await rejects(as(db, ann, () => db.query(`insert into idea_nudges (idea_id, user_id) values ($1, $2)`, [golf, bo])), /row-level security/, 'insert');
  });

  await test('a push that cannot be sent does not stop the nudge being recorded', async () => {
    const cinema = await addIdea(ann, 'Cinema');
    await db.exec(`set test.net_broken = 'on'`);
    try {
      eq(sorted(await water(ann, cinema)), sorted([bo, cy, di]));
    } finally {
      await db.exec(`set test.net_broken = 'off'`);
    }
    eq(await water(ann, cinema), []);
  });

  await test('running the update a second time changes nothing and does not fail', async () => {
    const before = (await one(db, `select count(*)::int as n from idea_nudges`)).n;
    await db.exec(fs.readFileSync(path.join(REPO, 'supabase/updates', NUDGES), 'utf8'));
    eq((await one(db, `select count(*)::int as n from idea_nudges`)).n, before);
    eq((await one(db, `select nudges from notification_settings where user_id = $1`, [cy])).nudges, false);
  });
}
