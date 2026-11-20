// Database tests for supabase/updates/017-idea-pictures.sql. Run with: npm run test:db
import fs from 'node:fs';
import path from 'node:path';

import { as, eq, freshDb, newUser, one, rejects, REPO, rows, test } from './harness.mjs';

const UPDATE = '017-idea-pictures.sql';
const FILE = '0f0e0d0c-0b0a-4908-8706-050403020100';
const OTHER = '11111111-2222-4333-8444-555555555555';

// With and without update 011 (the link's preview picture), since 017 does not depend on it.
for (const before of [[], ['011-link-previews.sql']]) {
  const db = await freshDb([...before, UPDATE]);
  const ann = await newUser(db, 'Ann');
  const bo = await newUser(db, 'Bo');
  const zed = await newUser(db, 'Zed');
  const group = await as(db, ann, async () => (await one(db, `select create_group('Friends', 'sky', array['Food']) as id`)).id);
  const { invite_code: code } = await one(db, `select invite_code from groups where id = $1`, [group]);
  await as(db, bo, () => db.query(`select join_group($1)`, [code]));
  const theirs = await as(db, zed, async () => (await one(db, `select create_group('Strangers', 'sky', array['Food']) as id`)).id);
  const { id: list } = await one(db, `select id from lists where group_id = $1`, [group]);
  const addIdea = (title, link = null) => as(db, ann, async () =>
    (await one(db, `insert into ideas (group_id, list_id, title, link, added_by) values ($1, $2, $3, $4, $5) returning id`, [group, list, title, link, ann])).id);
  const set = (user, id, change, params = []) => as(db, user, () => db.query(`update ideas set ${change} where id = $1`, [id, ...params]));
  const pictureOf = async (id) => (await one(db, `select picture from ideas where id = $1`, [id])).picture;
  const put = (user, name, bucket = 'idea-pictures') => as(db, user, () => db.query(`insert into storage.objects (bucket_id, name) values ($1, $2)`, [bucket, name]));
  const files = async () => (await rows(db, `select name from storage.objects where bucket_id = 'idea-pictures' order by name`)).map((r) => r.name);
  const mine = `${group}/${FILE}.jpg`;

  console.log(`\nAn idea's own picture${before.length ? ' (with update 011)' : ''}`);

  await test('the place for pictures is public, takes JPEGs only, and nothing over 1 MB', async () => {
    eq(await one(db, `select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'idea-pictures'`), { public: true, file_size_limit: 1048576, allowed_mime_types: ['image/jpeg'] });
  });

  await test('any member can give an idea a picture, with or without a link', async () => {
    const plain = await addIdea('Band name');
    await set(bo, plain, `picture = $2`, [mine]);
    eq(await pictureOf(plain), mine);
    const linked = await addIdea('Tacos', 'https://example.org/page');
    await set(ann, linked, `picture = $2`, [`${group}/${OTHER}.jpg`]);
    eq(await pictureOf(linked), `${group}/${OTHER}.jpg`);
  });

  await test('the picture stays when the link is changed or removed', async () => {
    const id = await addIdea('Tacos', 'https://example.org/page');
    await set(ann, id, `picture = $2`, [mine]);
    await set(ann, id, `link = 'https://example.org/other'`);
    await set(ann, id, `link = null`);
    eq(await pictureOf(id), mine);
  });

  await test('a picture can be taken off again', async () => {
    const id = await addIdea('Tacos');
    await set(ann, id, `picture = $2`, [mine]);
    await set(bo, id, `picture = null`);
    eq(await pictureOf(id), null);
  });

  await test('only a file in the idea\'s own group\'s folder, named the way the app names them, is accepted', async () => {
    const id = await addIdea('Tacos');
    for (const bad of [
      `${theirs}/${FILE}.jpg`,
      `${group}/${FILE}.png`,
      `${group}/photo.jpg`,
      `${group}/${FILE}.jpg/extra`,
      `${group}/../${theirs}/${FILE}.jpg`,
      `https://example.org/a.jpg`,
      `${FILE}.jpg`,
      '',
    ]) {
      await rejects(set(ann, id, `picture = $2`, [bad]), /ideas_picture_check/, bad.slice(-30) || 'empty');
    }
    eq(await pictureOf(id), null);
  });

  await test('a stranger cannot put a picture on a group\'s idea', async () => {
    const id = await addIdea('Tacos');
    await set(zed, id, `picture = $2`, [mine]);
    eq(await pictureOf(id), null);
  });

  await test('a member can add a file to their group\'s folder', async () => {
    await put(ann, mine);
    await put(bo, `${group}/${OTHER}.jpg`);
    eq(await files(), [`${group}/${FILE}.jpg`, `${group}/${OTHER}.jpg`].sort());
  });

  await test('nobody can add a file to a group they are not in', async () => {
    await rejects(put(zed, `${group}/22222222-2222-4222-8222-222222222222.jpg`), /row-level security/, 'a stranger');
    await rejects(put(ann, `${theirs}/${FILE}.jpg`), /row-level security/, 'into another group');
  });

  await test('a file with any other kind of name is refused, not an error', async () => {
    for (const bad of [`${group}/photo.jpg`, `${group}/${FILE}.png`, `${FILE}.jpg`, `not-a-group/${FILE}.jpg`, `${group}/sub/${FILE}.jpg`, '']) {
      await rejects(put(ann, bad), /row-level security/, bad.slice(-30) || 'empty');
    }
  });

  await test('the rules cover this place only: they open no other', async () => {
    await rejects(put(ann, mine, 'something-else'), /row-level security/, 'another bucket');
  });

  await test('someone not signed in can add nothing', async () => {
    await rejects(as(db, null, () => db.query(`insert into storage.objects (bucket_id, name) values ('idea-pictures', $1)`, [`${group}/33333333-3333-4333-8333-333333333333.jpg`])), /row-level security/, 'signed out');
  });

  await test('members can see what their group\'s folder holds, and strangers cannot', async () => {
    const seenBy = (user) => as(db, user, async () => (await rows(db, `select name from storage.objects where bucket_id = 'idea-pictures'`)).length);
    eq(await seenBy(bo), 2);
    eq(await seenBy(zed), 0);
  });

  await test('a stranger cannot remove a group\'s picture, and a member can', async () => {
    await as(db, zed, () => db.query(`delete from storage.objects where name = $1`, [mine]));
    eq((await files()).includes(mine), true);
    await as(db, bo, () => db.query(`delete from storage.objects where name = $1`, [mine]));
    eq((await files()).includes(mine), false);
  });

  await test('nobody can replace a picture in place', async () => {
    const other = `${group}/${OTHER}.jpg`;
    await as(db, ann, () => db.query(`update storage.objects set name = $2 where name = $1`, [other, `${group}/44444444-4444-4444-8444-444444444444.jpg`]));
    eq(await files(), [other]);
  });

  await test('running the update twice keeps the pictures and the rules', async () => {
    const id = await addIdea('Tacos');
    await set(ann, id, `picture = $2`, [mine]);
    await db.exec(fs.readFileSync(path.join(REPO, 'supabase/updates', UPDATE), 'utf8'));
    eq(await pictureOf(id), mine);
    eq((await rows(db, `select id from storage.buckets where id = 'idea-pictures'`)).length, 1);
    eq((await rows(db, `select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects' order by 1`)).map((r) => r.policyname), ['idea_pictures_delete', 'idea_pictures_insert', 'idea_pictures_select']);
    await rejects(put(zed, `${group}/55555555-5555-4555-8555-555555555555.jpg`), /row-level security/, 'a stranger, after the second run');
  });
}
