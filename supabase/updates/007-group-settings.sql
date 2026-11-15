-- SomeDaisy update 007: group settings
--
-- Paste this whole file into the Supabase SQL editor and run it once. It is safe to run again.
-- It needs nothing turned on first, and does not depend on the other updates.
--
-- What it adds:
--   * leave_group: leave a group. Your reactions in it go with you; ideas and comments you added
--     stay for your friends. A group whose last member leaves is deleted, because an empty group
--     could still be walked into by anyone holding its invite link.
--   * remove_member: the group's owner can take someone out of the group.
--   * reset_invite_code: the group's owner can replace the invite link. The old link stops working.
--   * A group's invite code and who started it can no longer be changed directly by the app,
--     only through the functions here.
--
-- The owner is the person who started the group. If they have left or deleted their account,
-- it is whoever has been in the group longest.

-- ---------- Who the owner is ----------

create or replace function public.group_owner(g uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select gr.created_by
       from groups gr
       join group_members m on m.group_id = gr.id and m.user_id = gr.created_by
      where gr.id = g),
    (select m.user_id from group_members m where m.group_id = g order by m.joined_at, m.user_id limit 1)
  );
$$;

-- Only the database uses this; the app works the owner out from what it can already see.
revoke all on function public.group_owner(uuid) from public, anon, authenticated;

-- ---------- Leaving ----------

create or replace function public.leave_group(p_group uuid)
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
  if not exists (select 1 from group_members where group_id = p_group and user_id = me) then
    raise exception 'You are not in that group';
  end if;

  delete from reactions where group_id = p_group and user_id = me;
  delete from group_members where group_id = p_group and user_id = me;

  if not exists (select 1 from group_members where group_id = p_group) then
    delete from groups where id = p_group;
  end if;
end;
$$;

-- ---------- Removing someone ----------

create or replace function public.remove_member(p_group uuid, p_user uuid)
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
  if not exists (select 1 from group_members where group_id = p_group and user_id = me)
     or group_owner(p_group) is distinct from me then
    raise exception 'Only the group''s owner can remove someone';
  end if;
  if p_user = me then
    raise exception 'To take yourself out, leave the group instead';
  end if;

  delete from reactions where group_id = p_group and user_id = p_user;
  delete from group_members where group_id = p_group and user_id = p_user;
end;
$$;

-- ---------- A new invite link ----------

create or replace function public.reset_invite_code(p_group uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  code text;
begin
  if me is null then
    raise exception 'Not signed in';
  end if;
  if not exists (select 1 from group_members where group_id = p_group and user_id = me)
     or group_owner(p_group) is distinct from me then
    raise exception 'Only the group''s owner can change the invite link';
  end if;

  code := substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
  update groups set invite_code = code where id = p_group;
  return code;
end;
$$;

revoke all on function public.leave_group(uuid) from public, anon;
revoke all on function public.remove_member(uuid, uuid) from public, anon;
revoke all on function public.reset_invite_code(uuid) from public, anon;
grant execute on function public.leave_group(uuid) to authenticated;
grant execute on function public.remove_member(uuid, uuid) to authenticated;
grant execute on function public.reset_invite_code(uuid) to authenticated;

-- ---------- What the app may change on a group directly ----------

-- Members can rename a group and change its cover. The invite code and the record of who
-- started it change only through the database's own functions, which run as the owner of the
-- tables rather than as the person using the app.
create or replace function public.groups_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon')
     and (new.invite_code is distinct from old.invite_code
          or new.created_by is distinct from old.created_by
          or new.id is distinct from old.id) then
    raise exception 'That part of a group cannot be changed directly';
  end if;
  return new;
end;
$$;

drop trigger if exists groups_guard on public.groups;
create trigger groups_guard
  before update on public.groups
  for each row execute function public.groups_guard();
