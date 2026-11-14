-- SomeDaisy update 001: push notifications
--
-- Before running: in the Supabase dashboard under Database > Extensions, turn on
-- "pg_net" (lets the database call Expo's push service) and "pg_cron" (runs the reminder job).
-- Then paste this whole file into the SQL editor and run it once. It is safe to run again.
--
-- What it adds:
--   * a table of the phones that asked for notifications
--   * each person's choice of which notifications they want
--   * a push to the person who added an idea when someone else reacts to it
--   * a reminder to the group about two hours before a plan
--
-- Nothing else sends a push. Sending never blocks the app: if a push cannot be queued,
-- the reaction is still saved.

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

-- ---------- Each person's choices ----------

-- Which notifications a person wants. No row means the defaults: everything on.
create table if not exists public.notification_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  reactions boolean not null default true,   -- someone reacted to an idea I added
  reminders boolean not null default true,   -- a plan is about two hours away
  updated_at timestamptz not null default now()
);

alter table public.notification_settings enable row level security;

drop policy if exists "notification_settings_select" on public.notification_settings;
create policy "notification_settings_select" on public.notification_settings for select to authenticated
  using (user_id = auth.uid());

-- Save the signed-in person's choices.
create or replace function public.set_notification_settings(p_reactions boolean, p_reminders boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if not exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'Set your name first';
  end if;

  insert into notification_settings (user_id, reactions, reminders, updated_at)
  values (auth.uid(), coalesce(p_reactions, true), coalesce(p_reminders, true), now())
  on conflict (user_id) do update
    set reactions = excluded.reactions,
        reminders = excluded.reminders,
        updated_at = now();
end;
$$;

revoke all on function public.set_notification_settings(boolean, boolean) from public, anon;
grant execute on function public.set_notification_settings(boolean, boolean) to authenticated;

-- ---------- Sending ----------

-- A time as a person would say it, in the given time zone: "7:00 PM".
create or replace function public.push_time(p_at timestamptz, p_timezone text)
returns text
language sql
stable
set search_path = public
as $$
  select to_char(p_at at time zone p_timezone, 'FMHH12:MI AM');
$$;

-- Send one push to every phone of the given people. Tapping it opens p_group.
-- In p_body, "{time}" becomes the time of p_at in each phone's time zone.
-- Returns how many pushes were queued. Never raises: a failure to send must not undo the change
-- that triggered it.
create or replace function public.push_send(
  p_users uuid[],
  p_group uuid,
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
             replace(p_body, '{time}', coalesce(push_time(p_at, t.timezone), '')),
             240),
           'sound', 'default',
           'channelId', 'default',
           'data', jsonb_build_object('url', '/group/' || p_group::text)
         ) order by t.token), '[]'::jsonb)
    into messages
    from push_tokens t
   where t.user_id = any (p_users);

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
revoke all on function public.push_send(uuid[], uuid, text, text, timestamptz) from public, anon, authenticated;

-- ---------- What triggers a push ----------

-- Someone reacted to an idea. Only the person who added the idea hears about it, and only if
-- they are still in the group, want these, and it was not their own reaction.
create or replace function public.push_on_reaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  idea record;
begin
  select i.title, i.added_by into idea from ideas i where i.id = new.idea_id;

  if idea.added_by is null or idea.added_by = new.user_id then
    return new;
  end if;
  if not exists (select 1 from group_members where group_id = new.group_id and user_id = idea.added_by) then
    return new;
  end if;
  if exists (select 1 from notification_settings where user_id = idea.added_by and not reactions) then
    return new;
  end if;
  -- One push per burst: a second emoji on the same idea within ten minutes stays quiet.
  if exists (
    select 1 from reactions
     where idea_id = new.idea_id
       and user_id = new.user_id
       and emoji <> new.emoji
       and created_at > now() - interval '10 minutes'
  ) then
    return new;
  end if;

  perform push_send(
    array[idea.added_by],
    new.group_id,
    (select name from groups where id = new.group_id),
    coalesce((select name from profiles where id = new.user_id), 'Someone')
      || ' reacted ' || new.emoji || ' to your idea: ' || idea.title
  );
  return new;
end;
$$;

drop trigger if exists push_reaction on public.reactions;
create trigger push_reaction
  after insert on public.reactions
  for each row execute function public.push_on_reaction();

-- ---------- Reminders ----------

-- A date being set or changed arms the reminder again.
create or replace function public.ideas_reset_reminder()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.planned_for is distinct from old.planned_for then
    new.reminded_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists ideas_reset_reminder on public.ideas;
create trigger ideas_reset_reminder
  before update on public.ideas
  for each row execute function public.ideas_reset_reminder();

-- Remind the members who want reminders of plans starting within the next two hours.
-- Each plan is reminded once. Returns how many plans were reminded.
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
    perform push_send(
      array(
        select m.user_id
          from group_members m
         where m.group_id = plan.group_id
           and not exists (select 1 from notification_settings s where s.user_id = m.user_id and not s.reminders)
      ),
      plan.group_id,
      plan.group_name,
      plan.title || ' is coming up at {time}',
      plan.planned_for
    );
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
