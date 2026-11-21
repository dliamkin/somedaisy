// Database tests for supabase/updates/018-group-covers.sql. Run with: npm run test:db
import fs from 'node:fs';
import path from 'node:path';

import { as, eq, freshDb, newUser, one, rejects, REPO, test } from './harness.mjs';

const UPDATE = '018-group-covers.sql';

// With and without update 007 (group settings), which also watches what changes on a group.
for (const before of [[], ['001-push-notifications.sql', '002-account-transfer.sql', '003-comments.sql', '004-profile-photo.sql', '005-delete-account.sql', '007-group-settings.sql']]) {
  const db = await freshDb([...before, UPDATE]);
  const ann = await newUser(db, 'Ann');
  const bo = await newUser(db, 'Bo');
  const zed = await newUser(db, 'Zed');
  const group = await as(db, ann, async () => (await one(db, `select create_group('Friends', 'mint', array['Food']) as id`)).id);
  const { invite_code: code } = await one(db, `select invite_code from groups where id = $1`, [group]);
  await as(db, bo, () => db.query(`select join_group($1)`, [code]));
  const theirs = await as(db, zed, async () => (await one(db, `select create_group('Strangers', 'sky', array['Food']) as id`)).id);

  // The database keeps a cover's details in an order of its own, so they are put in one order before comparing.
  const inOrder = (value) =>
    Array.isArray(value) ? value.map(inOrder) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, inOrder(value[key])])) : value;
  const coverOf = async (id = group) => inOrder(await one(db, `select cover, cover_style from groups where id = $1`, [id]));
  const setStyle = (user, style, id = group) => as(db, user, () => db.query(`update groups set cover_style = $2 where id = $1`, [id, style === null ? null : JSON.stringify(style)]));
  const grape = { kind: 'look', background: '#4B2A8C', shape1: '#6D2FC4', shape2: '#B8339A', pattern: true };
  const uploaded = (id = group, version = 1) => ({ kind: 'photo', background: '#CDEFE0', pattern: true, photo: { source: 'upload', path: `${id}/cover.jpg`, version } });
  const searched = { kind: 'photo', background: '#CDEFE0', pattern: false, photo: { source: 'search', url: 'https://images.example.org/photo-1?w=1200&ixid=abc', credit: 'Photo by Ann Example', creditUrl: 'https://example.org/@ann?utm_source=x' } };

  console.log(`\nGroup covers${before.length ? ' (with update 007)' : ''}`);

  await test('every group starts with no details: its classic colour, as before', async () => {
    eq(await coverOf(), inOrder({ cover: 'mint', cover_style: null }));
    eq(await coverOf(theirs), inOrder({ cover: 'sky', cover_style: null }));
  });

  await test('any member can give the group a look', async () => {
    await setStyle(bo, grape);
    eq(await coverOf(), inOrder({ cover: 'mint', cover_style: grape }));
  });

  await test('a classic colour can have its pattern turned off', async () => {
    const plain = { kind: 'classic', background: '#CDEFE0', pattern: false };
    await setStyle(ann, plain);
    eq((await coverOf()).cover_style, inOrder(plain));
  });

  await test('both kinds of photo are accepted', async () => {
    await setStyle(ann, uploaded());
    eq((await coverOf()).cover_style, inOrder(uploaded()));
    await setStyle(bo, uploaded(group, 12));
    eq((await coverOf()).cover_style.photo.version, 12);
    await setStyle(ann, searched);
    eq((await coverOf()).cover_style, inOrder(searched));
  });

  await test('the details can be emptied again', async () => {
    await setStyle(ann, null);
    eq(await coverOf(), inOrder({ cover: 'mint', cover_style: null }));
  });

  await test('anything not shaped the way the app writes it is refused', async () => {
    const bad = {
      'not an object': 'look',
      'a list': [grape],
      'no kind': { background: '#4B2A8C', pattern: true },
      'an unknown kind': { ...grape, kind: 'video' },
      'no background': { kind: 'classic', pattern: true },
      'a colour by name': { kind: 'classic', background: 'purple', pattern: true },
      'a short colour': { kind: 'classic', background: '#fff', pattern: true },
      'a colour with something after it': { kind: 'classic', background: '#4B2A8C; x', pattern: true },
      'no pattern': { kind: 'classic', background: '#4B2A8C' },
      'a pattern in words': { kind: 'classic', background: '#4B2A8C', pattern: 'yes' },
      'a look with one shape': { kind: 'look', background: '#4B2A8C', shape1: '#6D2FC4', pattern: true },
      'a look with a bad shape': { ...grape, shape2: 'pink' },
      'a photo with no photo': { kind: 'photo', background: '#CDEFE0', pattern: true },
      'a photo from nowhere': { kind: 'photo', background: '#CDEFE0', pattern: true, photo: { source: 'camera' } },
      'a file in another group\'s folder': uploaded(theirs),
      'a file with another name': { ...uploaded(), photo: { source: 'upload', path: `${group}/other.jpg`, version: 1 } },
      'a file with no version': { ...uploaded(), photo: { source: 'upload', path: `${group}/cover.jpg` } },
      'version zero': uploaded(group, 0),
      'a version in words': { ...uploaded(), photo: { source: 'upload', path: `${group}/cover.jpg`, version: '3' } },
      'a version with a fraction': uploaded(group, 1.5),
      'a searched photo that is not secure': { ...searched, photo: { ...searched.photo, url: 'http://images.example.org/a' } },
      'a searched photo with a space in it': { ...searched, photo: { ...searched.photo, url: 'https://images.example.org/a b' } },
      'a searched photo with no credit': { ...searched, photo: { ...searched.photo, credit: '  ' } },
      'a searched photo with a script for a credit link': { ...searched, photo: { ...searched.photo, creditUrl: 'javascript:alert(1)' } },
      'a very long one': { ...grape, extra: 'x'.repeat(2000) },
    };
    for (const [label, style] of Object.entries(bad)) await rejects(setStyle(ann, style), /groups_cover_style_check/, label);
    eq((await coverOf()).cover_style, inOrder(null));
  });

  await test('a stranger cannot change a group\'s cover', async () => {
    await setStyle(zed, grape);
    eq((await coverOf()).cover_style, inOrder(null));
  });

  await test('an older copy of the app choosing a colour empties the details', async () => {
    await setStyle(ann, grape);
    // What an older copy sends: the name and the word, and nothing else.
    await as(db, bo, () => db.query(`update groups set name = 'Friends', cover = 'peach' where id = $1`, [group]));
    eq(await coverOf(), inOrder({ cover: 'peach', cover_style: null }));
  });

  await test('an older copy renaming the group, with the same colour, leaves the details', async () => {
    await setStyle(ann, grape);
    await as(db, bo, () => db.query(`update groups set name = 'Best friends', cover = 'peach' where id = $1`, [group]));
    eq(await coverOf(), inOrder({ cover: 'peach', cover_style: grape }));
  });

  await test('the app of today can change the word and the details at once', async () => {
    const plain = { kind: 'classic', background: '#CFE3FF', pattern: false };
    await as(db, ann, () => db.query(`update groups set cover = 'sky', cover_style = $2 where id = $1`, [group, JSON.stringify(plain)]));
    eq(await coverOf(), inOrder({ cover: 'sky', cover_style: plain }));
    await as(db, ann, () => db.query(`update groups set cover = 'yellow', cover_style = null where id = $1`, [group]));
    eq(await coverOf(), inOrder({ cover: 'yellow', cover_style: null }));
  });

  await test('a new group can still be made, and a group can still be looked up by its invite', async () => {
    const made = await as(db, bo, async () => (await one(db, `select create_group('Book club', 'peach', array['Books']) as id`)).id);
    eq(await coverOf(made), inOrder({ cover: 'peach', cover_style: null }));
    eq(await as(db, zed, () => one(db, `select name, cover from group_preview($1)`, [code])), { name: 'Best friends', cover: 'yellow' });
  });

  await test('running the update twice keeps every cover and the rules', async () => {
    await setStyle(ann, grape);
    await db.exec(fs.readFileSync(path.join(REPO, 'supabase/updates', UPDATE), 'utf8'));
    eq(await coverOf(), inOrder({ cover: 'yellow', cover_style: grape }));
    await rejects(setStyle(ann, { kind: 'look' }), /groups_cover_style_check/, 'after the second run');
    await as(db, bo, () => db.query(`update groups set cover = 'mint' where id = $1`, [group]));
    eq(await coverOf(), inOrder({ cover: 'mint', cover_style: null }));
  });
}
