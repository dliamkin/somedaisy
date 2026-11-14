-- SomeDaisy update 002: bring a guest's groups along when signing in
--
-- Paste this whole file into the Supabase SQL editor and run it once. It is safe to run again.
-- It needs nothing turned on first, and does not depend on update 001.
--
-- The problem it solves: someone uses the app as a guest on a new phone, joins a group, and then
-- signs in to the account they already had. Signing in swaps the guest for the account, so the
-- guest's groups would be left behind.
--
-- How it works:
--   1. While still the guest, the app asks for a one-time pass (start_transfer).
--   2. After signing in, the app hands the pass back (claim_transfer). Holding the pass proves the
--      same person was that guest a moment ago, so the guest's groups, ideas and reactions move
--      to the account and the guest is removed.
-- A pass works once, lasts 15 minutes, and only its fingerprint is stored.

create table if not exists public.account_transfers (
  token_hash text primary key,
  from_user uuid not null references public.profiles (id) on delete cascade,
  expires_at timestamptz not null default now() + interval '15 minutes'
);

-- No access rules on purpose: with row level security on and no policy, the app cannot read or
-- write this table at all. Only the two functions below touch it.
alter table public.account_transfers enable row level security;

create or replace function public.transfer_fingerprint(p_token text)
returns text
language sql
immutable
as $$
  select encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
$$;

-- Step 1, called as the guest. Returns the pass.
create or replace function public.start_transfer()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  pass text;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Only a guest can be moved into an account';
  end if;
  if not exists (select 1 from profiles where id = auth.uid()) then
    return null;   -- a guest with no name has no groups to bring
  end if;

  delete from account_transfers where from_user = auth.uid() or expires_at < now();

  pass := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into account_transfers (token_hash, from_user) values (transfer_fingerprint(pass), auth.uid());
  return pass;
end;
$$;

-- Step 2, called as the account. Returns how many groups were added to the account.
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

  -- Ideas the guest added, and groups the guest started, now belong to the account.
  update ideas set added_by = me where added_by = guest;
  update groups set created_by = me where created_by = guest;

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

revoke all on function public.transfer_fingerprint(text) from public, anon, authenticated;
revoke all on function public.start_transfer() from public, anon;
revoke all on function public.claim_transfer(text) from public, anon;
grant execute on function public.start_transfer() to authenticated;
grant execute on function public.claim_transfer(text) to authenticated;
