-- SomeDaisy update 008: points, stamps and the do-again shelf
--
-- Before running: run updates 001, 002 and 003 first. Then paste this whole file into the
-- Supabase SQL editor and run it once. It is safe to run again.
--
-- What it adds:
--   * completions: a record of each time a group did one of its ideas, with the points it
--     earned. A group's points are the sum of these, and its stamps are drawn from them.
--     The record is written by the database itself whenever an idea is marked as done, so it
--     also works for phones still running an older copy of the app.
--   * do_again_votes: each person's answer to "would you do it again?" for a done idea.
--     When everyone in the group says yes, the idea is on the group's do-again shelf.
--   * Ideas the group had already done before this update each get their record and points.
--   * A guest's answers come along when their groups move into an account (update 002).
--
-- The points for one completion:
--   10  did an idea                  (5 instead when it is a repeat of something done before)
--   +5  everyone was there           (always given for now: the app does not ask who came)
--   +5  the first thing done from that list
--   +10 the idea had waited more than 90 days
-- Points never go down. Nothing the app can do removes or changes a completion, and it stays
-- (with the idea's name) even if the idea itself is later removed.

-- ---------- Completions ----------

create table if not exists public.completions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  idea_id uuid references public.ideas (id) on delete set null,
  list_id uuid references public.lists (id) on delete set null,
  title text not null,                -- the idea's name at the time, kept if the idea is removed
  list_name text,                     -- the list's name at the time: the stamp's category
  marked_by uuid references public.profiles (id) on delete set null,
  done_at timestamptz not null default now(),
  waited_days int not null default 0, -- whole days from adding the idea to doing it
  repeat boolean not null default false,        -- done before: it came back from the do-again shelf
  first_in_list boolean not null default false, -- the first thing the group did from this list
  long_wait boolean not null default false,     -- waited more than 90 days
  points int not null check (points >= 0)
);

create index if not exists completions_group_idx on public.completions (group_id, done_at);
create index if not exists completions_idea_idx on public.completions (idea_id, done_at);

alter table public.completions enable row level security;

-- Members can see their group's completions. There are no rules for adding, changing or
-- removing: the app cannot do any of those. Only the trigger below writes here.
drop policy if exists "completions_select" on public.completions;
create policy "completions_select" on public.completions for select to authenticated
  using (public.is_member(group_id));

-- Work out and record one completion of an idea. Returns nothing when the same idea was
-- recorded in the last 12 hours: marking it done, putting it back and marking it done again
-- is one outing, not two.
create or replace function public.record_completion(p_idea uuid, p_at timestamptz, p_by uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  idea record;
  last_done timestamptz;
  is_repeat boolean;
  is_first boolean;
  waited int;
  is_long boolean;
begin
  select i.id, i.group_id, i.list_id, i.title, i.created_at, l.name as list_name
    into idea
    from ideas i left join lists l on l.id = i.list_id
   where i.id = p_idea;
  if idea.id is null then
    return;
  end if;

  select max(c.done_at) into last_done from completions c where c.idea_id = p_idea;
  if last_done is not null and last_done > p_at - interval '12 hours' then
    return;
  end if;

  is_repeat := last_done is not null;
  waited := greatest(0, floor(extract(epoch from (p_at - idea.created_at)) / 86400)::int);
  is_first := not is_repeat
    and not exists (select 1 from completions c where c.group_id = idea.group_id and c.list_id = idea.list_id);
  is_long := not is_repeat and waited > 90;

  insert into completions (group_id, idea_id, list_id, title, list_name, marked_by, done_at,
                           waited_days, repeat, first_in_list, long_wait, points)
  values (idea.group_id, idea.id, idea.list_id, idea.title, idea.list_name, p_by, p_at,
          waited, is_repeat, is_first, is_long,
          (case when is_repeat then 5 else 10 end)
            + 5
            + (case when is_first then 5 else 0 end)
            + (case when is_long then 10 else 0 end));
end;
$$;

revoke all on function public.record_completion(uuid, timestamptz, uuid) from public, anon, authenticated;

-- An idea being marked as done is what earns the points.
create or replace function public.ideas_on_done()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.done_at is not null and old.done_at is null then
    perform record_completion(new.id, new.done_at, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists ideas_on_done on public.ideas;
create trigger ideas_on_done
  after update of done_at on public.ideas
  for each row execute function public.ideas_on_done();

-- Ideas done before this update get their record too, oldest first so that "the first from
-- a list" goes to the right one. Running the file again adds nothing: they have one by then.
do $$
declare
  idea record;
begin
  for idea in
    select i.id, i.done_at
      from ideas i
     where i.done_at is not null
       and not exists (select 1 from completions c where c.idea_id = i.id)
     order by i.done_at, i.id
  loop
    perform record_completion(idea.id, idea.done_at, null);
  end loop;
end;
$$;

-- ---------- Would you do it again? ----------

create table if not exists public.do_again_votes (
  idea_id uuid not null references public.ideas (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  again boolean not null,
  updated_at timestamptz not null default now(),
  primary key (idea_id, user_id)
);

create index if not exists do_again_votes_group_idx on public.do_again_votes (group_id);

alter table public.do_again_votes enable row level security;

-- Members see everyone's answers in the group; you give, change and take back only your own.
drop policy if exists "do_again_select" on public.do_again_votes;
create policy "do_again_select" on public.do_again_votes for select to authenticated
  using (public.is_member(group_id));

drop policy if exists "do_again_insert" on public.do_again_votes;
create policy "do_again_insert" on public.do_again_votes for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_member(group_id)
    and exists (select 1 from public.ideas i where i.id = idea_id and i.group_id = do_again_votes.group_id)
  );

drop policy if exists "do_again_update" on public.do_again_votes;
create policy "do_again_update" on public.do_again_votes for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and public.is_member(group_id)
    and exists (select 1 from public.ideas i where i.id = idea_id and i.group_id = do_again_votes.group_id)
  );

drop policy if exists "do_again_delete" on public.do_again_votes;
create policy "do_again_delete" on public.do_again_votes for delete to authenticated
  using (user_id = auth.uid());

-- ---------- Moving a guest into an account ----------

-- The same function as in update 003, with one addition: the guest's do-again answers and
-- their name on completions move too.
create or replace function public.claim_transfer(p_token text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  guest uuid;
  moved int := 0;
begin
  if me is null then
    raise exception 'Not signed in';
  end if;
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Sign in to an account first';
  end if;
  if not exists (select 1 from profiles where id = me) then
    raise exception 'Set your name first';
  end if;

  delete from account_transfers
   where token_hash = transfer_fingerprint(p_token) and expires_at > now()
   returning from_user into guest;

  if guest is null then
    raise exception 'That pass is not valid any more';
  end if;
  if guest = me then
    return 0;
  end if;

  -- Groups: join the account to each of the guest's groups it is not already in.
  insert into group_members (group_id, user_id, joined_at)
  select group_id, me, joined_at from group_members where user_id = guest
  on conflict do nothing;
  get diagnostics moved = row_count;

  -- Ideas the guest added, groups the guest started, comments the guest wrote and
  -- completions the guest marked now belong to the account.
  update ideas set added_by = me where added_by = guest;
  update groups set created_by = me where created_by = guest;
  update comments set user_id = me where user_id = guest;
  update completions set marked_by = me where marked_by = guest;

  -- Reactions: hand over the guest's, except where the account has already had its say.
  -- A person has one thumb per idea, so the account's own thumbs up or down wins.
  update reactions r
     set user_id = me
   where r.user_id = guest
     and not exists (
           select 1 from reactions mine
            where mine.idea_id = r.idea_id
              and mine.user_id = me
              and (mine.emoji = r.emoji
                   or (mine.emoji in ('👍', '👎') and r.emoji in ('👍', '👎')))
         );

  -- Do-again answers: the same, the account's own answer wins.
  update do_again_votes v
     set user_id = me
   where v.user_id = guest
     and not exists (select 1 from do_again_votes mine where mine.idea_id = v.idea_id and mine.user_id = me);

  -- Removing the guest's profile clears whatever is left of theirs: memberships,
  -- leftover reactions and answers, and any phones registered for notifications.
  delete from profiles where id = guest;

  return moved;
end;
$$;

revoke all on function public.claim_transfer(text) from public, anon;
grant execute on function public.claim_transfer(text) to authenticated;
