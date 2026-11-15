// Database tests for supabase/updates/011-link-previews.sql. Run with: npm run test:db
import fs from 'node:fs';
import path from 'node:path';

import { as, eq, freshDb, newUser, one, REPO, rejects, test } from './harness.mjs';

const UPDATE = '011-link-previews.sql';
const PIC = 'https://cdn.example.org/a.jpg';

// With and without update 006 (which tidies links), since 011 does not depend on it.
for (const before of [[], ['006-idea-links.sql']]) {
  const db = await freshDb([...before, UPDATE]);
  const ann = await newUser(db, 'Ann');
  const zed = await newUser(db, 'Zed');
  const group = await as(db, ann, async () => (await one(db, `select create_group('Friends', 'sky', array['Food']) as id`)).id);
  const { id: list } = await one(db, `select id from lists where group_id = $1`, [group]);
  const addIdea = (title, link = 'https://example.org/page') => as(db, ann, async () =>
    (await one(db, `insert into ideas (group_id, list_id, title, link, added_by) values ($1, $2, $3, $4, $5) returning id`, [group, list, title, link, ann])).id);
  const set = (user, id, change, params = []) => as(db, user, () => db.query(`update ideas set ${change} where id = $1`, [id, ...params]));
  const picOf = async (id) => (await one(db, `select image_url from ideas where id = $1`, [id])).image_url;

  console.log(`\nPreview pictures${before.length ? ' (with update 006)' : ''}`);

  await test('a member can put a picture on an idea that has a link', async () => {
    const id = await addIdea('Tacos');
    await set(ann, id, `image_url = $2`, [PIC]);
    eq(await picOf(id), PIC);
  });

  await test('only a secure web address of a sensible length is accepted', async () => {
    const id = await addIdea('Tacos');
    for (const bad of ['http://cdn.example.org/a.jpg', 'javascript:alert(1)', 'data:image/png;base64,AAAA', 'cdn.example.org/a.jpg', 'https://cdn.example.org/a b.jpg', `https://cdn.example.org/${'a'.repeat(2000)}`]) {
      await rejects(set(ann, id, `image_url = $2`, [bad]), /ideas_image_url_check/, bad.slice(0, 40));
    }
    eq(await picOf(id), null);
  });

  await test('changing the link clears the old page\'s picture', async () => {
    const id = await addIdea('Tacos');
    await set(ann, id, `image_url = $2`, [PIC]);
    await set(ann, id, `link = 'https://example.org/other'`);
    eq(await picOf(id), null);
  });

  await test('removing the link clears the picture', async () => {
    const id = await addIdea('Tacos');
    await set(ann, id, `image_url = $2`, [PIC]);
    await set(ann, id, `link = null`);
    eq(await picOf(id), null);
  });

  await test('an idea with no link cannot be given a picture', async () => {
    const id = await addIdea('No link', null);
    await set(ann, id, `image_url = $2`, [PIC]);
    eq(await picOf(id), null);
  });

  await test('a new link and its picture can be saved together', async () => {
    const id = await addIdea('Tacos');
    await set(ann, id, `link = 'https://example.org/new', image_url = $2`, ['https://cdn.example.org/new.jpg']);
    eq(await picOf(id), 'https://cdn.example.org/new.jpg');
  });

  await test('saving the same link again, or changing anything else, keeps the picture', async () => {
    const id = await addIdea('Tacos');
    await set(ann, id, `image_url = $2`, [PIC]);
    await set(ann, id, `link = 'https://example.org/page', title = 'Better tacos', note = 'Yum'`);
    await set(ann, id, `planned_for = now() + interval '1 day'`);
    await set(ann, id, `done_at = now()`);
    eq(await picOf(id), PIC);
  });

  await test('a stranger cannot put a picture on a group\'s idea', async () => {
    const id = await addIdea('Tacos');
    await set(zed, id, `image_url = $2`, [PIC]);
    eq(await picOf(id), null);
  });

  await test('running the update twice keeps the pictures', async () => {
    const id = await addIdea('Tacos');
    await set(ann, id, `image_url = $2`, [PIC]);
    await db.exec(fs.readFileSync(path.join(REPO, 'supabase/updates', UPDATE), 'utf8'));
    eq(await picOf(id), PIC);
  });
}
