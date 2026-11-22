-- SomeDaisy update 020: a page for the person who runs the app
--
-- Paste this whole file into the Supabase SQL editor and run it once. It is safe to run again.
-- It needs updates 001 to 019 run first, because it counts what they added.
--
-- What it is for: the website gets a page at /admin that shows how SomeDaisy is being used: how
-- many people and groups there are, who they are, and how far people get. It only reads. Changing
-- or removing anything is still done in the Supabase dashboard.
--
-- Who can open it: only the people listed in the new "admins" table. The check is made here, in
-- the database, each time anything is asked for. The page being hard to find is not what keeps
-- it shut. Running this file lets nobody in. To let yourself in, run this one line afterwards,
-- with your own email in it (do not save your email into this file, which is on GitHub):
--
--   insert into public.admins (user_id)
--   select id from auth.users where lower(email) = lower('you@example.com')
--   on conflict do nothing;
--
-- It answers "INSERT 0 1" when it found you. "INSERT 0 0" means no account has that email yet:
-- sign in to SomeDaisy with it once, then run the line again. An account that signs in by emailed
-- code and with Google under the same email is one account, so one line covers both.
--
-- To let someone else in later, run the same line with their email. To shut someone out:
--
--   delete from public.admins
--   where user_id in (select id from auth.users where lower(email) = lower('them@example.com'));
--
-- What the page can see: names, email addresses, when people joined, group and list names, and
-- counts. It cannot see the words of ideas, notes or comments, or anyone's pictures. The privacy
-- policy says so (src/lib/privacy.ts).
--
-- What it adds:
--   * admins: who may open the page. Nobody can read or change it through the app.
--   * is_admin: tells the person asking whether they are on that list. A guest never is.
--   * admin_overview, admin_people, admin_groups, admin_person, admin_group: what the page
--     shows. Each one refuses anybody who is not on the list.
--
-- These count whole tables each time they are asked. That is quick for thousands of groups. If
-- SomeDaisy grows well past that, the overview is the one to look at first.

-- ---------- Who may open the page ----------

create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now(),
  note text
);

-- Row level security with no rules at all: the app can neither read this table nor write to it.
-- Only the SQL editor, and the functions below, can.
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

-- True when the signed-in person is on the list. A guest is never an admin, whatever the list says.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select auth.uid() is not null
    and not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
    and exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- ---------- What counts as doing something ----------

-- Everything that shows a group is in use, one row each: an idea added, a reaction, a comment,
-- something done, someone joining. Used by the functions below. The app cannot call it.
create or replace function public.admin_activity()
returns table (group_id uuid, user_id uuid, at timestamptz)
language sql
stable
set search_path = ''
as $$
  select i.group_id, i.added_by, i.created_at from public.ideas i
  union all
  select r.group_id, r.user_id, r.created_at from public.reactions r
  union all
  select c.group_id, c.user_id, c.created_at from public.comments c
  union all
  select d.group_id, d.marked_by, d.done_at from public.completions d
  union all
  select m.group_id, m.user_id, m.joined_at from public.group_members m;
$$;

revoke all on function public.admin_activity() from public, anon, authenticated;

-- ---------- The overview ----------

create or replace function public.admin_overview()
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  week_ago timestamptz := now() - interval '7 days';
  -- Weeks start on Monday, by the clock the database keeps (UTC).
  this_week timestamptz := date_trunc('week', now());
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'totals', jsonb_build_object(
      'people', (select count(*) from public.profiles),
      'accounts', (select count(*) from public.profiles p join auth.users u on u.id = p.id where not coalesce(u.is_anonymous, false)),
      'guests', (select count(*) from public.profiles p join auth.users u on u.id = p.id where coalesce(u.is_anonymous, false)),
      'groups', (select count(*) from public.groups),
      'shared_groups', (select count(*) from (select 1 from public.group_members m group by m.group_id having count(*) > 1) shared),
      'ideas', (select count(*) from public.ideas),
      'plans', (select count(*) from public.ideas i where i.planned_for is not null and i.done_at is null),
      'done', (select count(*) from public.completions),
      'reactions', (select count(*) from public.reactions),
      'comments', (select count(*) from public.comments),
      'phones', (select count(distinct t.user_id) from public.push_tokens t)
    ),
    'week', jsonb_build_object(
      'new_people', (select count(*) from public.profiles p where p.created_at >= week_ago),
      'new_groups', (select count(*) from public.groups g where g.created_at >= week_ago),
      'active_people', (select count(distinct a.user_id) from public.admin_activity() a where a.at >= week_ago and a.user_id is not null),
      'active_groups', (select count(distinct a.group_id) from public.admin_activity() a where a.at >= week_ago),
      'ideas', (select count(*) from public.ideas i where i.created_at >= week_ago),
      'done', (select count(*) from public.completions d where d.done_at >= week_ago)
    ),
    -- The last eight weeks, oldest first, this week included.
    'weeks', (
      select jsonb_agg(jsonb_build_object(
        'start', to_char(w.first_day, 'YYYY-MM-DD'),
        'people', (select count(*) from public.profiles p where p.created_at >= w.first_day and p.created_at < w.first_day + interval '7 days'),
        'groups', (select count(*) from public.groups g where g.created_at >= w.first_day and g.created_at < w.first_day + interval '7 days')
      ) order by w.first_day)
      from generate_series(this_week - interval '49 days', this_week, interval '7 days') as w(first_day)
    ),
    -- How far people get. Each step counts people, out of everyone who has picked a name.
    'funnel', jsonb_build_object(
      'named', (select count(*) from public.profiles),
      'in_group', (select count(distinct m.user_id) from public.group_members m),
      'added_idea', (select count(distinct i.added_by) from public.ideas i join public.group_members m on m.group_id = i.group_id and m.user_id = i.added_by),
      'did_one', (select count(distinct m.user_id) from public.group_members m where exists (select 1 from public.completions d where d.group_id = m.group_id))
    ),
    -- People in a group they did not start, which they can only have got into with an invite.
    'invited', (select count(*) from public.group_members m join public.groups g on g.id = m.group_id where m.user_id is distinct from g.created_by),
    -- Of the groups made at least four weeks ago, how many were still being used four weeks on.
    'lasting', jsonb_build_object(
      'old_groups', (select count(*) from public.groups g where g.created_at <= now() - interval '28 days'),
      'still_used', (
        select count(*) from public.groups g
        where g.created_at <= now() - interval '28 days'
          and exists (select 1 from public.admin_activity() a where a.group_id = g.id and a.at >= g.created_at + interval '28 days')
      )
    ),
    'covers', jsonb_build_object(
      'classic', (select count(*) from public.groups g where coalesce(g.cover_style ->> 'kind', 'classic') = 'classic'),
      'look', (select count(*) from public.groups g where g.cover_style ->> 'kind' = 'look'),
      'uploaded', (select count(*) from public.groups g where g.cover_style ->> 'kind' = 'photo' and g.cover_style -> 'photo' ->> 'source' = 'upload'),
      'searched', (select count(*) from public.groups g where g.cover_style ->> 'kind' = 'photo' and g.cover_style -> 'photo' ->> 'source' = 'search')
    ),
    'idea_pictures', (select count(*) from public.ideas i where i.picture is not null)
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_overview() from public, anon;
grant execute on function public.admin_overview() to authenticated;

-- ---------- People ----------

-- People, newest first. `p_search` looks in names and email addresses. `total` is how many match
-- in all, so the page knows whether there are more to show.
create or replace function public.admin_people(p_search text default null, p_limit int default 50, p_offset int default 0)
returns table (
  id uuid,
  name text,
  color text,
  email text,
  guest boolean,
  google boolean,
  joined timestamptz,
  last_active timestamptz,
  groups int,
  ideas int,
  total bigint
)
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  find text := nullif(lower(btrim(coalesce(p_search, ''))), '');
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  return query
  select
    p.id,
    p.name,
    p.color,
    u.email::text,
    coalesce(u.is_anonymous, false),
    coalesce(u.raw_app_meta_data -> 'providers' ? 'google', false),
    p.created_at,
    (select max(a.at) from public.admin_activity() a where a.user_id = p.id),
    (select count(*)::int from public.group_members m where m.user_id = p.id),
    (select count(*)::int from public.ideas i where i.added_by = p.id),
    count(*) over ()
  from public.profiles p
  join auth.users u on u.id = p.id
  where find is null
     or position(find in lower(p.name)) > 0
     or position(find in lower(coalesce(u.email::text, ''))) > 0
  order by p.created_at desc, p.id
  limit least(greatest(coalesce(p_limit, 50), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

revoke all on function public.admin_people(text, int, int) from public, anon;
grant execute on function public.admin_people(text, int, int) to authenticated;

-- One person: who they are and the groups they are in. Null when there is no such person.
create or replace function public.admin_person(p_user uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'id', p.id,
    'name', p.name,
    'color', p.color,
    'email', u.email,
    'guest', coalesce(u.is_anonymous, false),
    'google', coalesce(u.raw_app_meta_data -> 'providers' ? 'google', false),
    'joined', p.created_at,
    'last_sign_in', u.last_sign_in_at,
    'last_active', (select max(a.at) from public.admin_activity() a where a.user_id = p.id),
    'ideas', (select count(*) from public.ideas i where i.added_by = p.id),
    'reactions', (select count(*) from public.reactions r where r.user_id = p.id),
    'comments', (select count(*) from public.comments c where c.user_id = p.id),
    'phones', (select count(*) from public.push_tokens t where t.user_id = p.id),
    'groups', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id,
        'name', g.name,
        'joined', m.joined_at,
        'started', g.created_by is not distinct from p.id,
        'members', (select count(*) from public.group_members others where others.group_id = g.id)
      ) order by m.joined_at desc)
      from public.group_members m
      join public.groups g on g.id = m.group_id
      where m.user_id = p.id
    ), '[]'::jsonb)
  )
  into result
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.id = p_user;

  return result;
end;
$$;

revoke all on function public.admin_person(uuid) from public, anon;
grant execute on function public.admin_person(uuid) to authenticated;

-- ---------- Groups ----------

-- Groups. `p_sort` is 'busy' (the most done in the last four weeks first), 'new' (newest first)
-- or 'big' (the most people first). `p_search` looks in group names.
create or replace function public.admin_groups(p_sort text default 'busy', p_search text default null, p_limit int default 50, p_offset int default 0)
returns table (
  id uuid,
  name text,
  created_at timestamptz,
  members int,
  ideas int,
  done int,
  points int,
  recent int,
  last_active timestamptz,
  total bigint
)
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  find text := nullif(lower(btrim(coalesce(p_search, ''))), '');
  sort text := case when p_sort in ('new', 'big') then p_sort else 'busy' end;
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  return query
  with counted as (
    select
      g.id,
      g.name,
      g.created_at,
      (select count(*)::int from public.group_members m where m.group_id = g.id) as members,
      (select count(*)::int from public.ideas i where i.group_id = g.id) as ideas,
      (select count(*)::int from public.completions d where d.group_id = g.id) as done,
      (select coalesce(sum(d.points), 0)::int from public.completions d where d.group_id = g.id) as points,
      (select count(*)::int from public.admin_activity() a where a.group_id = g.id and a.at >= now() - interval '28 days') as recent,
      (select max(a.at) from public.admin_activity() a where a.group_id = g.id) as last_active
    from public.groups g
    where find is null or position(find in lower(g.name)) > 0
  )
  select c.id, c.name, c.created_at, c.members, c.ideas, c.done, c.points, c.recent, c.last_active, count(*) over ()
  from counted c
  order by
    case when sort = 'busy' then c.recent end desc nulls last,
    case when sort = 'big' then c.members end desc nulls last,
    case when sort = 'new' then c.created_at end desc nulls last,
    c.last_active desc nulls last,
    c.created_at desc,
    c.id
  limit least(greatest(coalesce(p_limit, 50), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

revoke all on function public.admin_groups(text, text, int, int) from public, anon;
grant execute on function public.admin_groups(text, text, int, int) to authenticated;

-- One group: its people, its lists and its counts. Null when there is no such group.
create or replace function public.admin_group(p_group uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'id', g.id,
    'name', g.name,
    'created_at', g.created_at,
    'cover', case
      when g.cover_style ->> 'kind' = 'photo' then coalesce(g.cover_style -> 'photo' ->> 'source', 'photo')
      else coalesce(g.cover_style ->> 'kind', 'classic')
    end,
    'ideas', (select count(*) from public.ideas i where i.group_id = g.id),
    'plans', (select count(*) from public.ideas i where i.group_id = g.id and i.planned_for is not null and i.done_at is null),
    'done', (select count(*) from public.completions d where d.group_id = g.id),
    'points', (select coalesce(sum(d.points), 0) from public.completions d where d.group_id = g.id),
    'reactions', (select count(*) from public.reactions r where r.group_id = g.id),
    'comments', (select count(*) from public.comments c where c.group_id = g.id),
    'last_active', (select max(a.at) from public.admin_activity() a where a.group_id = g.id),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'color', p.color,
        'guest', coalesce(u.is_anonymous, false),
        'joined', m.joined_at,
        'started', g.created_by is not distinct from p.id
      ) order by m.joined_at, p.id)
      from public.group_members m
      join public.profiles p on p.id = m.user_id
      join auth.users u on u.id = p.id
      where m.group_id = g.id
    ), '[]'::jsonb),
    'lists', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id,
        'name', l.name,
        'ideas', (select count(*) from public.ideas i where i.list_id = l.id)
      ) order by l.position, l.name)
      from public.lists l
      where l.group_id = g.id
    ), '[]'::jsonb)
  )
  into result
  from public.groups g
  where g.id = p_group;

  return result;
end;
$$;

revoke all on function public.admin_group(uuid) from public, anon;
grant execute on function public.admin_group(uuid) to authenticated;
