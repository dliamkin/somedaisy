-- SomeDaisy update 003: comments on ideas
--
-- Before running: run updates 001 and 002 first. Then paste this whole file into the Supabase SQL
-- editor and run it once. It is safe to run again.
--
-- What it adds:
--   * comments: any member of a group can comment on an idea, and remove their own comments
--   * a push to the person who added an idea when someone else comments on it
--   * a third choice in each person's notification settings, for those pushes
--   * comments come along when a guest's groups move into an account (update 002)

-- ---------- Comments ----------

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists comments_idea_idx on public.comments (idea_id, created_at);
create index if not exists comments_group_idx on public.comments (group_id);

alter table public.comments enable row level security;

-- Members see every comment in the group; you add and remove only your own. Comments are not edited.
drop policy if exists "comments_select" on public.comments;
create policy "comments_select" on public.comments for select to authenticated
  using (public.is_member(group_id));

drop policy if exists "comments_insert" on public.comments;
create policy "comments_insert" on public.comments for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_member(group_id)
    and exists (select 1 from public.ideas i where i.id = idea_id and i.group_id = comments.group_id)
  );

drop policy if exists "comments_delete" on public.comments;
create policy "comments_delete" on public.comments for delete to authenticated
  using (user_id = auth.uid());

-- ---------- The choice to hear about them ----------

alter table public.notification_settings add column if not exists comments boolean not null default true;

-- Save the signed-in person's choices. Replaces the two-choice version from update 001;
-- leaving p_comments out keeps whatever was chosen before.
drop function if exists public.set_notification_settings(boolean, boolean);

create or replace function public.set_notification_settings(
  p_reactions boolean,
  p_reminders boolean,
  p_comments boolean default null
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

  insert into notification_settings (user_id, reactions, reminders, comments, updated_at)
  values (auth.uid(), coalesce(p_reactions, true), coalesce(p_reminders, true), coalesce(p_comments, true), now())
  on conflict (user_id) do update
    set reactions = excluded.reactions,
        reminders = excluded.reminders,
        comments = coalesce(p_comments, notification_settings.comments),
        updated_at = now();
end;
$$;

revoke all on function public.set_notification_settings(boolean, boolean, boolean) from public, anon;
grant execute on function public.set_notification_settings(boolean, boolean, boolean) to authenticated;

-- ---------- The push ----------

-- Someone commented on an idea. Only the person who added the idea hears about it, and only if
-- they are still in the group, want these, and it was not their own comment.
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
      || ' commented on ' || idea.title || ': ' || new.body
  );
  return new;
end;
$$;

drop trigger if exists push_comment on public.comments;
create trigger push_comment
  after insert on public.comments
  for each row execute function public.push_on_comment();

-- ---------- Moving a guest into an account ----------

-- The same function as in update 002, with one addition: the guest's comments move too.
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

  -- Ideas the guest added, groups the guest started, and comments the guest wrote
  -- now belong to the account.
  update ideas set added_by = me where added_by = guest;
  update groups set created_by = me where created_by = guest;
  update comments set user_id = me where user_id = guest;

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

  -- Removing the guest's profile clears whatever is left of theirs: memberships,
  -- leftover reactions, and any phones registered for notifications.
  delete from profiles where id = guest;

  return moved;
end;
$$;

revoke all on function public.claim_transfer(text) from public, anon;
grant execute on function public.claim_transfer(text) to authenticated;
