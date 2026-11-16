-- SomeDaisy update 013: undo a mistaken "We did it"
--
-- Before running: run update 008 first. Then paste this whole file into the Supabase SQL
-- editor and run it once. It is safe to run again.
--
-- What it adds:
--   * undo_done: for 10 minutes after an idea is marked as done, anyone in the group can take
--     that back. The idea returns to its list, and the points and the stamp it has just earned
--     are removed. A tap on the wrong card should not leave a stamp for something nobody did.
--
-- This is the one exception to "points never go down" (update 008). After the 10 minutes a
-- completion stays for good, exactly as before, and the app still has no other way to remove
-- or change one. The 10 minutes are counted on the database's own clock.

create or replace function public.undo_done(p_idea uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  idea record;
  removed int;
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

  delete from completions c
   where c.idea_id = p_idea
     and c.done_at > now() - interval '10 minutes';
  get diagnostics removed = row_count;

  -- Nothing recent to take back: either the 10 minutes have passed, or marking it earned
  -- nothing this time (the same outing marked twice, see update 008). The second case can
  -- still go back on its list while the mark itself is fresh. Too late otherwise.
  if removed = 0 and idea.done_at <= now() - interval '10 minutes' then
    return false;
  end if;

  update ideas set done_at = null where id = p_idea;

  -- If that was the only time the idea was done, "would you do it again?" was never a real
  -- question, so any answers already given go too. Answers from an earlier time stay.
  if not exists (select 1 from completions c where c.idea_id = p_idea) then
    delete from do_again_votes v where v.idea_id = p_idea;
  end if;

  return true;
end;
$$;

revoke all on function public.undo_done(uuid) from public, anon;
grant execute on function public.undo_done(uuid) to authenticated;
