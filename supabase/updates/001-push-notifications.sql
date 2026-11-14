-- SomeDaisy update 001: push notifications
--
-- Before running: in the Supabase dashboard under Database > Extensions, turn on
-- "pg_net" (lets the database call Expo's push service) and "pg_cron" (runs the reminder job).
-- Then paste this whole file into the SQL editor and run it once. It is safe to run again.
--
-- What it adds:
--   * a table of the phones that asked for notifications
--   * a push to the rest of the group when someone adds an idea, picks a date,
--     or gives the thumbs up that makes it "everyone's in"
--   * a reminder to the whole group about two hours before a plan
--
-- Sending never blocks the app: if a push cannot be queued, the idea, date or reaction is still saved.

-- ---------- Devices ----------

create table if not exists public.push_tokens (
  token text primary key check (char_length(token) between 10 and 300),
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null default 'unknown',
  timezone text not null default 'UTC',   -- so dates in a push read in the phone's own time
  updated_at timestamptz not null default now()
);

create index if not exists push_tokens_user_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

-- People can see their own devices. Adding and removing go through the functions below,
-- because a phone's token has to move with it when a different person signs in.
drop policy if exists "push_tokens_select" on public.push_tokens;
create policy "push_tokens_select" on public.push_tokens for select to authenticated
  using (user_id = auth.uid());

-- When the reminder for a plan went out. Empty means it is still to come.
alter table public.ideas add column if not exists reminded_at timestamptz;

-- Register this phone for the signed-in person. A phone belongs to whoever used it last.
create or replace function public.register_push_token(p_token text, p_platform text, p_timezone text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  tz text := 'UTC';
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if not exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'Set your name first';
  end if;
  if exists (select 1 from pg_timezone_names where name = p_timezone) then
    tz := p_timezone;
  end if;

  insert into push_tokens (token, user_id, platform, timezone, updated_at)
  values (p_token, auth.uid(), coalesce(nullif(trim(p_platform), ''), 'unknown'), tz, now())
  on conflict (token) do update
    set user_id = excluded.user_id,
        platform = excluded.platform,
        timezone = excluded.timezone,
        updated_at = now();
end;
$$;

-- Stop notifications to this phone for the signed-in person (used when signing out).
create or replace function public.unregister_push_token(p_token text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from push_tokens where token = p_token and user_id = auth.uid();
$$;

revoke all on function public.register_push_token(text, text, text) from public, anon;
revoke all on function public.unregister_push_token(text) from public, anon;
grant execute on function public.register_push_token(text, text, text) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;

-- ---------- Sending ----------

-- A date as a person would say it, in the given time zone: "Sat 21 Nov, 7:00 PM".
create or replace function public.push_when(p_at timestamptz, p_timezone text)
returns text
language sql
stable
set search_path = public
as $$
  select to_char(p_at at time zone p_timezone, 'Dy FMDD Mon, FMHH12:MI AM');
$$;

-- Just the time: "7:00 PM".
create or replace function public.push_time(p_at timestamptz, p_timezone text)
returns text
language sql
stable
set search_path = public
as $$
  select to_char(p_at at time zone p_timezone, 'FMHH12:MI AM');
$$;

-- Send one push to every phone of every member of a group, except the person who caused it.
-- In p_body, "{when}" becomes the date and "{time}" the time of p_at, in each phone's time zone.
-- Returns how many pushes were queued. Never raises: a failure to send must not undo the change
-- that triggered it.
create or replace function public.push_to_group(
  p_group uuid,
  p_except uuid,
  p_title text,
  p_body text,
  p_at timestamptz default null
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  messages jsonb;
  batch jsonb;
  total int;
  start_at int := 0;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
           'to', t.token,
           'title', left(p_title, 120),
           'body', left(
             replace(
               replace(p_body, '{when}', coalesce(push_when(p_at, t.timezone), '')),
               '{time}', coalesce(push_time(p_at, t.timezone), '')),
             240),
           'sound', 'default',
           'channelId', 'default',
           'data', jsonb_build_object('url', '/group/' || p_group::text)
         ) order by t.token), '[]'::jsonb)
    into messages
    from push_tokens t
    join group_members m on m.user_id = t.user_id
   where m.group_id = p_group
     and (p_except is null or t.user_id <> p_except);

  total := jsonb_array_length(messages);

  -- Expo accepts at most 100 messages in one request.
  while start_at < total loop
    select jsonb_agg(elem order by ord)
      into batch
      from jsonb_array_elements(messages) with ordinality as x (elem, ord)
     where ord > start_at and ord <= start_at + 100;

    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := batch,
      headers := jsonb_build_object('Content-Type', 'application/json', 'Accept', 'application/json')
    );
    start_at := start_at + 100;
  end loop;

  return total;
exception when others then
  raise warning 'SomeDaisy push not sent: %', sqlerrm;
  return 0;
end;
$$;

-- Only the database itself sends pushes; the app cannot call this.
revoke all on function public.push_to_group(uuid, uuid, text, text, timestamptz) from public, anon, authenticated;

-- The name to show for whoever made the change.
create or replace function public.push_actor_name()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select name from profiles where id = auth.uid()), 'Someone');
$$;

revoke all on function public.push_actor_name() from public, anon, authenticated;

-- ---------- What triggers a push ----------

-- A new idea.
create or replace function public.push_on_idea_added()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform push_to_group(
    new.group_id,
    auth.uid(),
    (select name from groups where id = new.group_id),
    push_actor_name() || ' added an idea: ' || new.title
  );
  return new;
end;
$$;

drop trigger if exists push_idea_added on public.ideas;
create trigger push_idea_added
  after insert on public.ideas
  for each row execute function public.push_on_idea_added();

-- A date being set or changed keeps the reminder in step with it.
create or replace function public.ideas_reset_reminder()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.planned_for is distinct from old.planned_for then
    -- A plan less than two hours away needs no reminder: the group has just been told about it.
    if new.planned_for is not null and new.planned_for <= now() + interval '2 hours' then
      new.reminded_at := now();
    else
      new.reminded_at := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists ideas_reset_reminder on public.ideas;
create trigger ideas_reset_reminder
  before update on public.ideas
  for each row execute function public.ideas_reset_reminder();

-- A date in the future picked or changed for an idea that is not done.
create or replace function public.push_on_idea_planned()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.planned_for is not null
     and new.planned_for > now()
     and new.planned_for is distinct from old.planned_for
     and new.done_at is null then
    perform push_to_group(
      new.group_id,
      auth.uid(),
      (select name from groups where id = new.group_id),
      push_actor_name() || ' picked a date for ' || new.title || ': {when}',
      new.planned_for
    );
  end if;
  return new;
end;
$$;

drop trigger if exists push_idea_planned on public.ideas;
create trigger push_idea_planned
  after update on public.ideas
  for each row execute function public.push_on_idea_planned();

-- The thumbs up that makes an idea "everyone's in": two or more members, all thumbs up.
create or replace function public.push_on_everyone_in()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  members int;
  ups int;
  idea record;
begin
  if new.emoji <> '👍' then
    return new;
  end if;

  select count(*) into members from group_members where group_id = new.group_id;
  if members < 2 then
    return new;
  end if;

  select count(*) into ups
    from reactions r
    join group_members m on m.group_id = r.group_id and m.user_id = r.user_id
   where r.idea_id = new.idea_id and r.emoji = '👍';
  if ups < members then
    return new;
  end if;

  select title, planned_for, done_at into idea from ideas where id = new.idea_id;
  if idea.done_at is not null then
    return new;
  end if;

  perform push_to_group(
    new.group_id,
    auth.uid(),
    (select name from groups where id = new.group_id),
    case when members = 2 then 'You are both in for ' else 'Everyone''s in for ' end
      || idea.title
      || case when idea.planned_for is null then '. Pick a date!' else '!' end
  );
  return new;
end;
$$;

drop trigger if exists push_everyone_in on public.reactions;
create trigger push_everyone_in
  after insert on public.reactions
  for each row execute function public.push_on_everyone_in();

-- ---------- Reminders ----------

-- Remind every member of plans starting within the next two hours. Each plan is reminded once.
-- Returns how many plans were reminded.
create or replace function public.send_plan_reminders()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  plan record;
  sent int := 0;
begin
  for plan in
    select i.id, i.group_id, i.title, i.planned_for, g.name as group_name
      from ideas i
      join groups g on g.id = i.group_id
     where i.done_at is null
       and i.reminded_at is null
       and i.planned_for > now()
       and i.planned_for <= now() + interval '2 hours'
     order by i.planned_for
     for update of i skip locked
  loop
    perform push_to_group(plan.group_id, null, plan.group_name, plan.title || ' is coming up at {time}', plan.planned_for);
    update ideas set reminded_at = now() where id = plan.id;
    sent := sent + 1;
  end loop;
  return sent;
end;
$$;

revoke all on function public.send_plan_reminders() from public, anon, authenticated;

-- Check for reminders every ten minutes. Skipped, with a notice, when pg_cron is not turned on.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('somedaisy-plan-reminders', '*/10 * * * *', 'select public.send_plan_reminders()');
  else
    raise notice 'pg_cron is not turned on, so plan reminders are not scheduled. Turn it on and run this file again.';
  end if;
end;
$$;
