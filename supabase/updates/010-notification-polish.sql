-- SomeDaisy update 010: mute a group, and comment notifications that open the comments
--
-- Before running: run updates 001 and 003 first. Then paste this whole file into the Supabase
-- SQL editor and run it once. It is safe to run again.
--
-- What it adds:
--   * Each person can mute a group. A muted group sends them no notifications at all:
--     no reactions, no comments, no reminders. Their other groups are not affected.
--   * A notification about a comment now says which idea it is about, so tapping it opens that
--     idea's comments. Older copies of the app ignore the extra detail and open the group, as before.

-- ---------- Muting ----------

alter table public.group_members add column if not exists muted boolean not null default false;

-- Mute or unmute one of your own groups.
create or replace function public.set_group_muted(p_group uuid, p_muted boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  update group_members set muted = coalesce(p_muted, false)
   where group_id = p_group and user_id = auth.uid();
  if not found then
    raise exception 'You are not in that group';
  end if;
end;
$$;

revoke all on function public.set_group_muted(uuid, boolean) from public, anon;
grant execute on function public.set_group_muted(uuid, boolean) to authenticated;

-- ---------- Sending ----------

-- The same function as in update 001, with two additions: people who have muted the group are
-- left out, and p_idea (when given) travels with the push so the app can open that idea.
drop function if exists public.push_send(uuid[], uuid, text, text, timestamptz);

create or replace function public.push_send(
  p_users uuid[],
  p_group uuid,
  p_title text,
  p_body text,
  p_at timestamptz default null,
  p_idea uuid default null
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
           'data', jsonb_strip_nulls(jsonb_build_object('url', '/group/' || p_group::text, 'idea', p_idea::text))
         ) order by t.token), '[]'::jsonb)
    into messages
    from push_tokens t
   where t.user_id = any (p_users)
     and not exists (
           select 1 from group_members m
            where m.group_id = p_group and m.user_id = t.user_id and m.muted
         );

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
revoke all on function public.push_send(uuid[], uuid, text, text, timestamptz, uuid) from public, anon, authenticated;

-- ---------- Comments say which idea ----------

-- The same function as in update 003, except that the push carries the idea.
create or replace function public.push_on_comment()
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
  if exists (select 1 from notification_settings where user_id = idea.added_by and not comments) then
    return new;
  end if;
  -- One push per burst: more comments from the same person within ten minutes stay quiet,
  -- unless the person who added the idea has answered in between.
  if exists (
    select 1 from comments earlier
     where earlier.idea_id = new.idea_id
       and earlier.user_id = new.user_id
       and earlier.id <> new.id
       and earlier.created_at > now() - interval '10 minutes'
       and not exists (
             select 1 from comments answer
              where answer.idea_id = new.idea_id
                and answer.user_id = idea.added_by
                and answer.created_at >= earlier.created_at
           )
  ) then
    return new;
  end if;

  perform push_send(
    array[idea.added_by],
    new.group_id,
    (select name from groups where id = new.group_id),
    coalesce((select name from profiles where id = new.user_id), 'Someone')
      || ' commented on ' || idea.title || ': ' || new.body,
    null,
    new.idea_id
  );
  return new;
end;
$$;
