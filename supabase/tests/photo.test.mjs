// Database tests for supabase/updates/004-profile-photo.sql. Run with: npm run test:db
import fs from 'node:fs';
import path from 'node:path';

import { as, eq, freshDb, newUser, one, REPO, rejects, rows, test } from './harness.mjs';

const UPDATE = '004-profile-photo.sql';
const db = await freshDb([UPDATE]);

const PHOTO = 'https://lh3.googleusercontent.com/a/ACg8ocJ-abc_DEF123=s96-c';

// Ann and Bo share "Friends". Zed is a stranger.
const ann = await newUser(db, 'Ann');
const bo = await newUser(db, 'Bo');
const zed = await newUser(db, 'Zed');
const group = await as(db, ann, async () => (await one(db, `select create_group('Friends', 'sky', array['Food']) as id`)).id);
const { invite_code: code } = await one(db, `select invite_code from groups where id = $1`, [group]);
await as(db, bo, () => db.query(`select join_group($1)`, [code]));

const setPhoto = (user, url, whose = user) => as(db, user, () => db.query(`update profiles set photo_url = $1 where id = $2`, [url, whose]));
const photoOf = async (user) => (await one(db, `select photo_url from profiles where id = $1`, [user])).photo_url;

console.log('\nProfile photos');

await test('profiles start with no photo, and not hidden', async () => {
  eq(await rows(db, `select photo_url, photo_hidden from profiles where id = $1`, [ann]), [{ photo_url: null, photo_hidden: false }]);
});

await test('you can set your own photo to a picture served by Google', async () => {
  await setPhoto(ann, PHOTO);
  eq(await photoOf(ann), PHOTO);
});

await test('running the update a second time keeps the photo and does not fail', async () => {
  await db.exec(fs.readFileSync(path.join(REPO, 'supabase/updates', UPDATE), 'utf8'));
  eq(await photoOf(ann), PHOTO);
});

await test('people in your group see your photo, and strangers do not', async () => {
  const seenBy = (user) => as(db, user, async () => (await rows(db, `select photo_url from profiles where id = $1`, [ann])).map((r) => r.photo_url));
  eq(await seenBy(bo), [PHOTO], 'group member');
  eq(await seenBy(zed), [], 'stranger');
});

await test('nobody can set someone else\'s photo', async () => {
  await setPhoto(bo, 'https://lh3.googleusercontent.com/a/someone-else', ann);
  eq(await photoOf(ann), PHOTO);
});

await test('an address that is not a Google picture is refused', async () => {
  for (const url of [
    'https://example.com/me.png',
    'http://lh3.googleusercontent.com/a/abc',
    'https://lh3.googleusercontent.com.example.com/a/abc',
    'https://lh3.googleusercontent.com/a/abc?next=https://example.com',
    'javascript:alert(1)',
    '',
    `https://lh3.googleusercontent.com/a/${'x'.repeat(500)}`,
  ]) {
    await rejects(setPhoto(bo, url), /check constraint/, url.slice(0, 40));
  }
});

await test('choosing to hide your photo means none is stored', async () => {
  await rejects(as(db, ann, () => db.query(`update profiles set photo_hidden = true where id = $1`, [ann])), /check constraint/, 'hidden with a photo');
  await as(db, ann, () => db.query(`update profiles set photo_hidden = true, photo_url = null where id = $1`, [ann]));
  eq(await rows(db, `select photo_url, photo_hidden from profiles where id = $1`, [ann]), [{ photo_url: null, photo_hidden: true }]);
});

await test('changing your name keeps your photo', async () => {
  await setPhoto(bo, PHOTO);
  await as(db, bo, () => db.query(`insert into profiles (id, name, color) values ($1, 'Bobby', '#CDEFE0') on conflict (id) do update set name = excluded.name, color = excluded.color`, [bo]));
  eq(await rows(db, `select name, photo_url from profiles where id = $1`, [bo]), [{ name: 'Bobby', photo_url: PHOTO }]);
});
