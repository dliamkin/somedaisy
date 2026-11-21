// Database tests for supabase/updates/019-cover-photos.sql. Run with: npm run test:db
import fs from 'node:fs';
import path from 'node:path';

import { as, eq, freshDb, newUser, one, rejects, REPO, rows, test } from './harness.mjs';

const UPDATE = '019-cover-photos.sql';
const BUCKET = 'group-covers';

// On its own, and beside the pictures on ideas (update 017), whose rules sit on the same table.
for (const before of [[], ['017-idea-pictures.sql', '018-group-covers.sql']]) {
  const db = await freshDb([...before, UPDATE]);
  const ann = await newUser(db, 'Ann');
  const bo = await newUser(db, 'Bo');
  const zed = await newUser(db, 'Zed');
  const group = await as(db, ann, async () => (await one(db, `select create_group('Friends', 'sky', array['Food']) as id`)).id);
  const { invite_code: code } = await one(db, `select invite_code from groups where id = $1`, [group]);
  await as(db, bo, () => db.query(`select join_group($1)`, [code]));
  const theirs = await as(db, zed, async () => (await one(db, `select create_group('Strangers', 'sky', array['Food']) as id`)).id);

  const mine = `${group}/cover.jpg`;
  const put = (user, name, bucket = BUCKET) => as(db, user, () => db.query(`insert into storage.objects (bucket_id, name) values ($1, $2)`, [bucket, name]));
  const files = async () => (await rows(db, `select name from storage.objects where bucket_id = $1 order by name`, [BUCKET])).map((r) => r.name);
  const seenBy = (user) => as(db, user, async () => (await rows(db, `select name from storage.objects where bucket_id = $1`, [BUCKET])).length);

  console.log(`\nCover photos${before.length ? ' (beside updates 017 and 018)' : ''}`);

  await test('the place for cover photos is private, takes JPEGs only, and nothing over 512 KB', async () => {
    eq(await one(db, `select public, file_size_limit, allowed_mime_types from storage.buckets where id = $1`, [BUCKET]), { public: false, file_size_limit: 524288, allowed_mime_types: ['image/jpeg'] });
  });

  await test('a member can add their group\'s cover photo', async () => {
    await put(bo, mine);
    eq(await files(), [mine]);
  });

  await test('nobody can add a photo for a group they are not in', async () => {
    await rejects(put(zed, mine), /row-level security|duplicate/, 'a stranger, same name');
    await rejects(put(ann, `${theirs}/cover.jpg`), /row-level security/, 'into another group');
    await rejects(as(db, null, () => db.query(`insert into storage.objects (bucket_id, name) values ($1, $2)`, [BUCKET, `${theirs}/cover.jpg`])), /row-level security/, 'signed out');
  });

  await test('a group has room for the one file and no other', async () => {
    for (const bad of [
      `${group}/cover.png`,
      `${group}/cover2.jpg`,
      `${group}/photo.jpg`,
      `${group}/0f0e0d0c-0b0a-4908-8706-050403020100.jpg`,
      `${group}/sub/cover.jpg`,
      `${group}/cover.jpg/x`,
      `${group.toUpperCase()}/cover.jpg`,
      `cover.jpg`,
      `not-a-group/cover.jpg`,
      '',
    ]) {
      await rejects(put(ann, bad), /row-level security/, bad.slice(-30) || 'empty');
    }
    eq(await files(), [mine]);
  });

  await test('the rules cover this place only: they open no other', async () => {
    await rejects(put(ann, mine, 'something-else'), /row-level security/, 'another bucket');
  });

  await test('members can see their group\'s photo, and nobody else can', async () => {
    eq(await seenBy(ann), 1);
    eq(await seenBy(bo), 1);
    eq(await seenBy(zed), 0);
    eq(await as(db, null, async () => (await rows(db, `select name from storage.objects where bucket_id = $1`, [BUCKET])).length), 0);
  });

  await test('a member can replace the photo in place, and a stranger cannot', async () => {
    // Replacing a file keeps its name and changes what is recorded about it.
    await as(db, zed, () => db.query(`update storage.objects set owner_id = 'zed' where name = $1`, [mine]));
    eq((await one(db, `select owner_id from storage.objects where name = $1`, [mine])).owner_id, null);
    await as(db, ann, () => db.query(`update storage.objects set owner_id = 'ann' where name = $1`, [mine]));
    eq((await one(db, `select owner_id from storage.objects where name = $1`, [mine])).owner_id, 'ann');
  });

  await test('the photo cannot be moved to another group, or given another name', async () => {
    await rejects(as(db, ann, () => db.query(`update storage.objects set name = $2 where name = $1`, [mine, `${theirs}/cover.jpg`])), /row-level security/, 'into another group');
    await rejects(as(db, ann, () => db.query(`update storage.objects set name = $2 where name = $1`, [mine, `${group}/other.jpg`])), /row-level security/, 'another name');
    await rejects(as(db, ann, () => db.query(`update storage.objects set bucket_id = 'something-else' where name = $1`, [mine])), /row-level security/, 'another place');
    eq(await files(), [mine]);
  });

  await test('a stranger cannot remove a group\'s photo, and a member can', async () => {
    await as(db, zed, () => db.query(`delete from storage.objects where name = $1`, [mine]));
    eq(await files(), [mine]);
    await as(db, bo, () => db.query(`delete from storage.objects where name = $1`, [mine]));
    eq(await files(), []);
  });

  await test('someone who has left the group can no longer see or replace its photo', async () => {
    await put(ann, mine);
    await db.query(`delete from group_members where group_id = $1 and user_id = $2`, [group, bo]);
    eq(await seenBy(bo), 0);
    await as(db, bo, () => db.query(`update storage.objects set owner_id = 'bo' where name = $1`, [mine]));
    eq((await one(db, `select owner_id from storage.objects where name = $1`, [mine])).owner_id, null);
    await as(db, bo, () => db.query(`delete from storage.objects where name = $1`, [mine]));
    eq(await files(), [mine]);
  });

  await test('running the update twice keeps the photos and the rules', async () => {
    await db.exec(fs.readFileSync(path.join(REPO, 'supabase/updates', UPDATE), 'utf8'));
    eq(await files(), [mine]);
    eq((await rows(db, `select id from storage.buckets where id = $1`, [BUCKET])).length, 1);
    eq(
      (await rows(db, `select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'group_covers%' order by 1`)).map((r) => r.policyname),
      ['group_covers_delete', 'group_covers_insert', 'group_covers_select', 'group_covers_update'],
    );
    await rejects(put(zed, `${group}/cover.jpg`), /row-level security|duplicate/, 'a stranger, after the second run');
    eq(await seenBy(zed), 0);
  });
}
