-- SomeDaisy update 026: reactions on comments
--
-- Before running: run update 003 (comments) first. Then paste this whole file into the Supabase
-- SQL editor and run it once. It is safe to run again.
--
-- What it is for: reacting to a comment with an emoji. On an idea's page, pressing and holding a
-- comment, or tapping the small face at the foot of it, offers a few emoji. A comment's reactions
-- are shown gathered together at its corner.
--
-- What it adds:
--   * comment_reactions: one row for each person's reaction to a comment. A person has one
--     reaction to a comment at a time: choosing another emoji changes it.
--   * Who may do what: anyone in the group can see the reactions on its comments and add their
--     own. A person changes and removes only their own.
--   * A signal to whoever has that idea's comments open, so a reaction shows without a reload.
--     It is the same signal update 016 (live updates) sends for a comment, and is skipped where
--     Supabase's Realtime is not there.
--
-- A reaction goes when its comment does, when its idea or group does, and when the person who
-- left it deletes their account. A guest who moves to an account (update 002) keeps their
-- comments but not their reactions to other people's.
--
-- Nobody is sent a notification about a reaction to a comment.

do $$
begin
  if to_regclass('public.comments') is null then
    raise exception 'Run update 003 (comments) first';
  end if;
end;
$$;

create table if not exists public.comment_reactions (
  comment_id uuid not null references public.comments (id) on delete cascade,
  -- The comment's idea and group, kept here as well: the group says who may see the reaction,
  -- and the idea is what the app asks by. The rules below check both against the comment.
  idea_id uuid not null references public.ideas (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create index if not exists comment_reactions_idea_idx on public.comment_reactions (idea_id);
create index if not exists comment_reactions_group_idx on public.comment_reactions (group_id);

alter table public.comment_reactions enable row level security;

drop policy if exists "comment_reactions_select" on public.comment_reactions;
create policy "comment_reactions_select" on public.comment_reactions for select to authenticated
  using (public.is_member(group_id));

drop policy if exists "comment_reactions_insert" on public.comment_reactions;
create policy "comment_reactions_insert" on public.comment_reactions for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_member(group_id)
    and exists (
          select 1 from public.comments c
           where c.id = comment_id
             and c.idea_id = comment_reactions.idea_id
             and c.group_id = comment_reactions.group_id
        )
  );

-- Changing a reaction is changing its emoji. It stays the same person's, on the same comment.
drop policy if exists "comment_reactions_update" on public.comment_reactions;
create policy "comment_reactions_update" on public.comment_reactions for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and public.is_member(group_id)
    and exists (
          select 1 from public.comments c
           where c.id = comment_id
             and c.idea_id = comment_reactions.idea_id
             and c.group_id = comment_reactions.group_id
        )
  );

drop policy if exists "comment_reactions_delete" on public.comment_reactions;
create policy "comment_reactions_delete" on public.comment_reactions for delete to authenticated
  using (user_id = auth.uid());

-- ---------- Telling whoever has the comments open ----------

-- One signal for each idea in a save, however many reactions it touches: removing a comment
-- removes every reaction to it. The note of who has been told is shared with update 016, so a
-- save that has already told an idea's readers does not tell them twice.
create or replace function public.tell_idea_of_reaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  idea text;
  told text;
begin
  if tg_op = 'DELETE' then
    idea := old.idea_id::text;
  else
    idea := new.idea_id::text;
  end if;
  told := coalesce(current_setting('somedaisy.told', true), '');
  if position('idea:' || idea in told) = 0 then
    perform set_config('somedaisy.told', told || ' idea:' || idea, true);
    begin
      -- Nothing to do where Realtime is not installed.
      if to_regprocedure('realtime.send(jsonb, text, text, boolean)') is not null then
        perform realtime.send(payload => '{}'::jsonb, event => 'changed', topic => 'idea:' || idea, private => false);
      end if;
    exception when others then
      -- A signal that cannot be sent must not undo the reaction it was about.
      null;
    end;
  end if;
  return null;
end;
$$;

revoke all on function public.tell_idea_of_reaction() from public, anon, authenticated;

drop trigger if exists tell_idea on public.comment_reactions;
create trigger tell_idea
  after insert or update or delete on public.comment_reactions
  for each row execute function public.tell_idea_of_reaction();
