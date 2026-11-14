// Shared test harness: an in-memory Postgres set up to look enough like Supabase
// (auth.uid(), the anon/authenticated roles, a recording stand-in for pg_net) to run the project's SQL.
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The repository root, two folders up from this file.
export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const SUPABASE_STUBS = `
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;

-- Stand-in for pg_net: records every request instead of sending it.
create schema net;
create table net.calls (id bigserial primary key, url text, body jsonb, headers jsonb);
create function net.http_post(url text, body jsonb default '{}'::jsonb, params jsonb default '{}'::jsonb,
                              headers jsonb default '{}'::jsonb, timeout_milliseconds int default 5000)
returns bigint language plpgsql security definer as $$
declare new_id bigint;
begin
  if current_setting('test.net_broken', true) = 'on' then raise exception 'pg_net is down'; end if;
  insert into net.calls (url, body, headers) values (url, body, headers) returning id into new_id;
  return new_id;
end; $$;
grant usage on schema net to anon, authenticated;
`;

// Supabase grants table access to these roles by default and leaves the gatekeeping to row level security.
const SUPABASE_GRANTS = `
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;
`;

export async function freshDb(updates = []) {
  const db = new PGlite();
  await db.exec(SUPABASE_STUBS);
  await db.exec(fs.readFileSync(path.join(REPO, 'supabase/schema.sql'), 'utf8'));
  for (const file of updates) await db.exec(fs.readFileSync(path.join(REPO, 'supabase/updates', file), 'utf8'));
  await db.exec(SUPABASE_GRANTS);
  return db;
}

export const rows = async (db, sql, params = []) => (await db.query(sql, params)).rows;
export const one = async (db, sql, params = []) => (await rows(db, sql, params))[0];

/** Run fn as a signed-in user, with row level security applying as it would for the app. */
export async function as(db, userId, fn) {
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [userId ?? '']);
  await db.exec('set role authenticated');
  try {
    return await fn();
  } finally {
    await db.exec('reset role');
    await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
  }
}

export async function newUser(db, name) {
  const { id } = await one(db, `insert into auth.users default values returning id`);
  if (name) await db.query(`insert into public.profiles (id, name) values ($1, $2)`, [id, name]);
  return id;
}

let passed = 0;
let failed = 0;
export async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ok    ${name}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL  ${name}\n        ${String(e.message).split('\n').join('\n        ')}`);
  }
}
export function eq(actual, expected, label = '') {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${label ? label + ': ' : ''}expected ${b}\n        but got  ${a}`);
}
export async function rejects(promise, pattern, label = '') {
  try {
    await promise;
  } catch (e) {
    if (pattern && !pattern.test(String(e.message))) throw new Error(`${label}: failed, but with "${e.message}"`);
    return;
  }
  throw new Error(`${label || 'statement'}: expected it to be refused, but it succeeded`);
}
export function summary() {
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exitCode = failed ? 1 : 0;
}
