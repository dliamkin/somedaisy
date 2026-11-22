// Database tests for supabase/updates/022-idea-photos.sql. Run with: npm run test:db
import fs from 'node:fs';
import path from 'node:path';

import { as, eq, freshDb, newUser, one, REPO, rejects, test } from './harness.mjs';

const UPDATE = '022-idea-photos.sql';
const sql = fs.readFileSync(path.join(REPO, 'supabase/updates', UPDATE), 'utf8');

const PHOTO = {
  url: 'https://images.unsplash.com/photo-1?ixid=abc123&w=1080&q=80&fit=max',
  credit: 'Photo by Ann Example on Unsplash',
  creditUrl: 'https://unsplash.com/@ann?utm_source=somedaisy&utm_medium=referral',
};

// Ann and Bo share "Friends", which has a Food list with one idea on it. Zed is a stranger.
async function world(updates = [UPDATE]) {
  const db = await freshDb(updates);
  const ann = await newUser(db, 'Ann');
  const bo = await newUser(db, 'Bo');
  const zed = await newUser(db, 'Zed');
  const friends = await as(db, ann, async () => (await one(db, `select create_group('Friends', 'sky', array['Food']) as id`)).id);
  const { invite_code: code } = await one(db, `select invite_code from groups where id = $1`, [friends]);
  await as(db, bo, () => db.query(`select join_group($1)`, [code]));
  const { id: food } = await one(db, `select id from lists where group_id = $1`, [friends]);
  const add = (user, title, photo) => as(db, user, async () =>
    (await one(db, `insert into ideas (group_id, list_id, title, added_by, photo) values ($1, $2, $3, $4, $5) returning id`, [friends, food, title, user, photo === undefined ? null : JSON.stringify(photo)])).id);
  const picnic = await add(ann, 'Picnic');
  const setPhoto = (user, idea, photo) => as(db, user, () => db.query(`update ideas set photo = $2 where id = $1`, [idea, photo === null ? null : JSON.stringify(photo)]));
  const photoOf = async (idea) => (await one(db, `select photo from ideas where id = $1`, [idea])).photo;
  return { db, ann, bo, zed, friends, food, picnic, add, setPhoto, photoOf };
}

console.log('\nA found photo as an idea\'s picture');

await test('an idea starts with no found photo', async () => {
  const w = await world();
  eq(await w.photoOf(w.picnic), null);
});

await test('anyone in the group can give an idea a found photo, and take it off again', async () => {
  const w = await world();
  await w.setPhoto(w.bo, w.picnic, PHOTO);
  eq(await w.photoOf(w.picnic), PHOTO);
  await w.setPhoto(w.ann, w.picnic, null);
  eq(await w.photoOf(w.picnic), null);
});

await test('an idea can be added with its photo already chosen', async () => {
  const w = await world();
  const beach = await w.add(w.bo, 'Beach day', PHOTO);
  eq(await w.photoOf(beach), PHOTO);
});

await test('someone outside the group cannot change it', async () => {
  const w = await world();
  await w.setPhoto(w.zed, w.picnic, PHOTO);
  eq(await w.photoOf(w.picnic), null);
});

await test('a photo that is not shaped the way the app writes it is refused', async () => {
  const w = await world();
  const bad = [
    'just words',
    [],
    {},
    { ...PHOTO, url: 'http://images.unsplash.com/photo-1' },
    { ...PHOTO, url: 'https://images.unsplash.com/photo 1' },
    { ...PHOTO, url: `https://images.unsplash.com/${'a'.repeat(1000)}` },
    { ...PHOTO, url: 5 },
    { url: PHOTO.url, creditUrl: PHOTO.creditUrl },
    { ...PHOTO, credit: '   ' },
    { ...PHOTO, credit: 'a'.repeat(121) },
    { ...PHOTO, credit: 12 },
    { url: PHOTO.url, credit: PHOTO.credit },
    { ...PHOTO, creditUrl: 'javascript:alert(1)' },
    { ...PHOTO, creditUrl: 'ftp://unsplash.com/@ann' },
    { ...PHOTO, extra: 'x'.repeat(2500) },
  ];
  for (const photo of bad) {
    await rejects(w.setPhoto(w.ann, w.picnic, photo), /ideas_photo_check/, JSON.stringify(photo).slice(0, 60));
  }
  eq(await w.photoOf(w.picnic), null);
});

await test('a credit of exactly 120 letters, and addresses of exactly 1,000, are kept', async () => {
  const w = await world();
  const long = { url: `https://images.unsplash.com/${'a'.repeat(1000 - 28)}`, credit: 'a'.repeat(120), creditUrl: `https://unsplash.com/${'b'.repeat(1000 - 21)}` };
  eq([long.url.length, long.creditUrl.length], [1000, 1000]);
  await w.setPhoto(w.ann, w.picnic, long);
  eq(await w.photoOf(w.picnic), long);
});

await test("it leaves an idea's own picture and its link's picture alone", async () => {
  const w = await world(['011-link-previews.sql', '017-idea-pictures.sql', UPDATE]);
  const own = `${w.friends}/11111111-2222-4333-8444-555555555555.jpg`;
  await w.db.query(`update ideas set picture = $2, image_url = 'https://example.com/a.jpg', link = 'https://example.com' where id = $1`, [w.picnic, own]);
  await w.setPhoto(w.ann, w.picnic, PHOTO);
  const idea = await one(w.db, `select picture, image_url, photo from ideas where id = $1`, [w.picnic]);
  eq(idea, { picture: own, image_url: 'https://example.com/a.jpg', photo: PHOTO });
});

await test('running the update twice changes nothing, and keeps the photos already saved', async () => {
  const w = await world();
  await w.setPhoto(w.ann, w.picnic, PHOTO);
  await w.db.exec(sql);
  eq(await w.photoOf(w.picnic), PHOTO);
  await rejects(w.setPhoto(w.ann, w.picnic, {}), /ideas_photo_check/);
});
