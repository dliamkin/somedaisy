-- SomeDaisy update 027: delete something the group did
--
-- Before running: run updates 003 (comments) and 008 (points and stamps) first. Then paste this
-- whole file into the Supabase SQL editor and run it once. It is safe to run again.
--
-- What it is for: a group can delete one of the things it did, for example one it would rather
-- not be reminded of. It goes from "Things we did", from the calendar and from the wall in the
-- garden's house, for everyone in the group.
--
-- What it adds:
--   * completions.forgotten: true for the record of something that has since been deleted. The
--     record stays, because a group's points are the sum of its records and points never go down
--     (update 008). Its name is wiped, and the app shows no stamp for it.
--   * delete_done: deletes a finished idea. Anyone in the group can, as anyone in the group can
--     remove an idea that is still on a list. Its comments, votes and do-again answers go with
--     it. Its records are kept as forgotten ones, so the group keeps the points, its rank, and
--     what its garden has earned.
--
-- What does not change: nothing else can change or remove a record (the one exception is still
-- update 013, undoing a mistaken "We did it" within 10 minutes). An idea that is not done is
-- removed from its own page as before, and this function leaves it alone.
--
-- A forgotten record still counts as something done from its list. So if the first thing a group
-- did from a list is deleted, the next one from that list is not a "first" again: those 5 points
-- were given once and the group still has them.
--
-- The idea's own picture is a file in storage, which a function here cannot remove. The app
-- removes it straight after, as it does when an idea is removed.

do $$
begin
  if to_regclass('public.comments') is null then
    raise exception 'Run update 003 (comments) first';
  end if;
  if to_regclass('public.completions') is null then
    raise exception 'Run update 008 (points and stamps) first';
  end if;
end;
$$;

alter table public.completions add column if not exists forgotten boolean not null default false;

-- Delete a finished idea. True when it was deleted, false when the idea is not done, which
-- changes nothing.
create or replace function public.delete_done(p_idea uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  idea record;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select i.id, i.group_id, i.done_at into idea from ideas i where i.id = p_idea;
  -- The same answer for an idea that does not exist and one in somebody else's group.
  if idea.id is null or not is_member(idea.group_id) then
    raise exception 'You are not in that group';
  end if;
  if idea.done_at is null then
    return false;
  end if;

  -- Every time it was done, should it have been done more than once. The points stay on the
  -- record. The name does not: nothing is left that says what it was.
  update completions set forgotten = true, title = '' where idea_id = p_idea;

  -- Its reactions, comments, their reactions and the do-again answers go with it. The records
  -- above let go of it and stay.
  delete from ideas where id = p_idea;

  return true;
end;
$$;

revoke all on function public.delete_done(uuid) from public, anon;
grant execute on function public.delete_done(uuid) to authenticated;
