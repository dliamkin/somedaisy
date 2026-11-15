-- SomeDaisy update 005: delete your own account
--
-- Paste this whole file into the Supabase SQL editor and run it once. It is safe to run again.
-- It needs nothing turned on first, and does not depend on the other updates.
--
-- What it adds: delete_account(), which the app calls when someone chooses "Delete my account"
-- (or "Delete my data", for a guest). It removes the person calling it and nobody else:
--
--   * Their sign-in, name, colour, picture and email are removed.
--   * Their memberships, reactions, comments, phones registered for notifications and
--     notification choices go with them. The tables already say so (on delete cascade).
--   * Ideas they added stay in the group for their friends, with no name on them, and a group
--     they started stays for its other members. The tables already say that too (on delete set null).
--   * A group where they are the only member is deleted with everything in it. Left behind, it
--     would be a group nobody is in, which anyone still holding its invite link could walk into.
--
-- It cannot be undone.

create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Not signed in';
  end if;

  -- Groups that would be left with nobody in them.
  delete from groups g
   where exists (select 1 from group_members m where m.group_id = g.id and m.user_id = me)
     and not exists (select 1 from group_members m where m.group_id = g.id and m.user_id <> me);

  -- The profile first, so that everything hanging from it is gone even if the sign-in itself
  -- could not be removed; then the sign-in.
  delete from profiles where id = me;
  delete from auth.users where id = me;
end;
$$;

-- Only someone signed in (guests included) can call it, and only for themselves: it takes no
-- argument saying whose account to delete.
revoke all on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;
