-- SomeDaisy update 021: a limit on photo search for each person
--
-- Before running: "pg_cron" should be turned on under Database > Extensions (update 001 already
-- asked for it). Then paste this whole file into the Supabase SQL editor and run it once.
-- It is safe to run again. It does not depend on the other updates.
--
-- After running it, deploy the new copy of the photo-search helper
-- (supabase/functions/photo-search/index.ts, see "Photo search for covers" in README.md). The
-- order does not matter: the old helper never asks about the limit, and the new helper carries
-- on without one until this file has been run.
--
-- What it is for: Unsplash allows the app a set number of requests an hour, across everyone
-- (50 until it approves the app for production, then 1,000). Until now one person could use up
-- the whole hour and leave photo search "busy" for everybody else. With this, each person gets a
-- share: so many searches an hour, and so many found photos saved as a cover.
--
-- What it adds:
--   * photo_search_uses: one row each time someone searches for photos or saves a found one.
--     It holds who and when, never the words searched for. Nobody can read or change it through
--     the app. Rows are removed once they are over an hour old.
--   * take_photo_search: the helper asks this before it calls Unsplash. It answers true and
--     notes the request, or answers false when that person has had their share for the hour.
--   * A job that clears out old rows once a day, for when nobody has searched in a while.
--
-- The numbers: 12 searches and 6 saved photos an hour for each person. They are the two numbers
-- in take_photo_search below. Once Unsplash approves the app for production there is room for
-- more: change them there and run this file again.

-- ---------- What has been asked for lately ----------

create table if not exists public.photo_search_uses (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- 'search' for a search, 'chosen' for telling Unsplash that a found photo was put to use.
  kind text not null check (kind in ('search', 'chosen')),
  at timestamptz not null default now()
);

create index if not exists photo_search_uses_user_at on public.photo_search_uses (user_id, at);
create index if not exists photo_search_uses_at on public.photo_search_uses (at);

-- Row level security with no rules at all: the app can neither read this table nor write to it.
-- Only the function below can.
alter table public.photo_search_uses enable row level security;
revoke all on public.photo_search_uses from anon, authenticated;

-- ---------- May this person ask once more? ----------

-- True, and the request is noted, when the signed-in person is still within their share for the
-- last hour. False when they have used it up, and then nothing is noted. `p_kind` is 'search' or
-- 'chosen'; anything else is taken as a search. Calling it yourself only uses up your own share.
create or replace function public.take_photo_search(p_kind text default 'search')
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  v_kind text := case when p_kind = 'chosen' then 'chosen' else 'search' end;
  -- How many of each one person may make in an hour.
  v_most int := case when v_kind = 'chosen' then 6 else 12 end;
  v_used int;
begin
  if me is null then
    return false;
  end if;

  -- One at a time for each person, so two requests sent together cannot both take the last place.
  perform pg_advisory_xact_lock(hashtextextended('photo-search:' || me::text, 0));

  -- Anything over an hour old no longer counts, whoever it belongs to.
  delete from public.photo_search_uses u where u.at < now() - interval '1 hour';

  select count(*) into v_used
  from public.photo_search_uses u
  where u.user_id = me and u.kind = v_kind;

  if v_used >= v_most then
    return false;
  end if;

  insert into public.photo_search_uses (user_id, kind) values (me, v_kind);
  return true;
end;
$$;

revoke all on function public.take_photo_search(text) from public, anon;
grant execute on function public.take_photo_search(text) to authenticated;

-- ---------- Clearing out ----------

-- Removes every row over an hour old. The function above does the same each time it is asked;
-- this is for the days when nobody searches. Only the database itself runs it.
create or replace function public.clear_photo_search_uses()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed int;
begin
  delete from public.photo_search_uses u where u.at < now() - interval '1 hour';
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.clear_photo_search_uses() from public, anon, authenticated;

-- Once a day, in the small hours. Skipped, with a notice, when pg_cron is not turned on.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('somedaisy-clear-photo-search-uses', '47 3 * * *', 'select public.clear_photo_search_uses()');
  else
    raise notice 'pg_cron is not turned on, so old photo search counts are only cleared when someone next searches. Turn it on and run this file again.';
  end if;
end;
$$;
