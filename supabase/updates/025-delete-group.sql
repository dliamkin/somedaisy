-- SomeDaisy update 025: delete a group
--
-- Paste this whole file into the Supabase SQL editor and run it once. It is safe to run again.
-- It needs nothing turned on first, and does not depend on the other updates.
--
-- What it is for: until now a group only went when its last member left. With this, the group's
-- owner can delete it outright, from the menu on the group's card on Home.
--
-- What it adds:
--   * delete_group: removes a group and everything in it (lists, ideas, reactions, comments,
--     plans, what it has done, points and stamps) for every member. Only the owner can.
--
-- The owner is the person who started the group. If they have left or deleted their account, it
-- is whoever has been in the group longest. That is the same rule as update 007 (group settings),
-- written out again here so this file does not depend on that one.
--
-- What it cannot do: remove stored files. The pictures on the group's ideas and its cover photo
-- are removed by the app first, while the owner is still a member and so still allowed to. To
-- let the app check that the delete will go through before it removes any file, the function
-- can be asked to only check.

-- Delete a group, or with p_check_only only say whether the signed-in person may.
create or replace function public.delete_group(p_group uuid, p_check_only boolean default false)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  owner uuid;
begin
  if me is null then
    raise exception 'Not signed in';
  end if;
  if not exists (select 1 from group_members where group_id = p_group and user_id = me) then
    raise exception 'You are not in that group';
  end if;

  select coalesce(
    (select gr.created_by
       from groups gr
       join group_members m on m.group_id = gr.id and m.user_id = gr.created_by
      where gr.id = p_group),
    (select m.user_id from group_members m where m.group_id = p_group order by m.joined_at, m.user_id limit 1)
  ) into owner;

  if owner is distinct from me then
    raise exception 'Only the group''s owner can delete it';
  end if;

  if coalesce(p_check_only, false) then
    return;
  end if;

  delete from groups where id = p_group;
end;
$$;

revoke all on function public.delete_group(uuid, boolean) from public, anon;
grant execute on function public.delete_group(uuid, boolean) to authenticated;
