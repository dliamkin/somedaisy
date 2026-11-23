-- SomeDaisy update 024: water an idea to nudge the people who have not voted
--
-- Before running: run updates 001 (push notifications) and 003 (comments) first. Then paste this
-- whole file into the Supabase SQL editor and run it once. It is safe to run again.
--
-- What it is for: in the garden view, an idea that is still waiting on someone has a button,
-- "Water to nudge". It sends a push to the members who have not said "I'm in" or "Eh" yet.
--
-- What it adds:
--   * nudge_idea: sends that push, and answers with who was nudged.
--   * A limit: a person gets at most one nudge about the same idea in 24 hours, whoever waters it.
--     Watering again sooner sends them nothing.
--   * A choice on the Notifications page to not get nudges at all.
--
-- Who is never nudged: the person watering, anyone who has already answered (an "Eh" is an
-- answer), and anyone who has left the group. A muted group stays silent (update 010).

-- ---------- The choice to hear about them ----------

alter table public.notification_settings add column if not exists nudges boolean not null default true;

-- Save the signed-in person's choices. Replaces the three-choice version from update 003;
-- leaving p_comments or p_nudges out keeps whatever was chosen before.
drop function if exists public.set_notification_settings(boolean, boolean, boolean);

create or replace function public.set_notification_settings(
  p_reactions boolean,
  p_reminders boolean,
  p_comments boolean default null,
  p_nudges boolean default null
)
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

  insert into notification_settings (user_id, reactions, reminders, comments, nudges, updated_at)
  values (auth.uid(), coalesce(p_reactions, true), coalesce(p_reminders, true), coalesce(p_comments, true), coalesce(p_nudges, true), now())
  on conflict (user_id) do update
    set reactions = excluded.reactions,
        reminders = excluded.reminders,
        comments = coalesce(p_comments, notification_settings.comments),
        nudges = coalesce(p_nudges, notification_settings.nudges),
        updated_at = now();
end;
$$;

revoke all on function public.set_notification_settings(boolean, boolean, boolean, boolean) from public, anon;
grant execute on function public.set_notification_settings(boolean, boolean, boolean, boolean) to authenticated;

-- ---------- When each person was last nudged about each idea ----------

create table if not exists public.idea_nudges (
  idea_id uuid not null references public.ideas (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,   -- who was nudged
  sent_by uuid references public.profiles (id) on delete set null,           -- who watered
  sent_at timestamptz not null default now(),
  primary key (idea_id, user_id)
);

-- Nobody reads or writes this from the app. Only nudge_idea, below, touches it.
alter table public.idea_nudges enable row level security;

-- ---------- Sending ----------

-- Nudge the members who have not voted on an idea. Returns the people nudged, which is empty
-- when everyone has answered or has already been nudged about it in the last 24 hours.
create or replace function public.nudge_idea(p_idea uuid)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  idea record;
  waiting uuid[];
begin
  if me is null then
    raise exception 'Not signed in';
  end if;

  select i.group_id, i.title, i.done_at into idea from ideas i where i.id = p_idea;
  -- The same answer whether the idea is not there or is in someone else's group.
  if not found or not exists (select 1 from group_members where group_id = idea.group_id and user_id = me) then
    raise exception 'That idea is not in one of your groups';
  end if;
  if idea.done_at is not null then
    return '{}';
  end if;

  select coalesce(array_agg(m.user_id order by m.joined_at, m.user_id), '{}')
    into waiting
    from group_members m
   where m.group_id = idea.group_id
     and m.user_id <> me
     and not exists (
           select 1 from reactions r
            where r.idea_id = p_idea and r.user_id = m.user_id and r.emoji in ('👍', '👎')
         )
     and not exists (
           select 1 from idea_nudges n
            where n.idea_id = p_idea and n.user_id = m.user_id and n.sent_at > now() - interval '24 hours'
         );

  if cardinality(waiting) = 0 then
    return waiting;
  end if;

  insert into idea_nudges (idea_id, user_id, sent_by, sent_at)
  select p_idea, u, me, now() from unnest(waiting) as u
  on conflict (idea_id, user_id) do update set sent_by = excluded.sent_by, sent_at = excluded.sent_at;

  -- Whoever has switched nudges off is left out of the push. They still count as nudged, so
  -- nobody can tell from the answer who has them switched off.
  perform push_send(
    array(
      select u from unnest(waiting) as u
       where not exists (select 1 from notification_settings s where s.user_id = u and not s.nudges)
    ),
    idea.group_id,
    (select name from groups where id = idea.group_id),
    coalesce((select name from profiles where id = me), 'Someone') || ' watered ' || idea.title || '. Are you in?'
  );

  return waiting;
end;
$$;

revoke all on function public.nudge_idea(uuid) from public, anon;
grant execute on function public.nudge_idea(uuid) to authenticated;
