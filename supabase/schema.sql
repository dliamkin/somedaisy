-- SomeDaisy database setup (Phase 1)
-- Run this once in the Supabase SQL editor on a new project.
-- Also turn on Anonymous sign-ins under Authentication > Sign In / Providers.

-- ---------- Tables ----------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  color text not null default '#FFD9C7',
  created_at timestamptz not null default now()
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  cover text not null default 'sky',
  invite_code text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 10),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table public.lists (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table public.ideas (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  list_id uuid not null references public.lists (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  link text,
  note text,
  added_by uuid references public.profiles (id) on delete set null,
  planned_for timestamptz,   -- set when the idea becomes a plan
  done_at timestamptz,       -- set when the group has done it; done ideas leave the lists
  created_at timestamptz not null default now()
);

create table public.reactions (
  idea_id uuid not null references public.ideas (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (idea_id, user_id, emoji)
);

create index ideas_group_idx on public.ideas (group_id);
create index reactions_group_idx on public.reactions (group_id);
create index lists_group_idx on public.lists (group_id);
create index members_user_idx on public.group_members (user_id);

-- ---------- Helper functions ----------

-- True when the signed-in user belongs to the group.
create or replace function public.is_member(g uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from group_members where group_id = g and user_id = auth.uid()
  );
$$;

-- True when the signed-in user shares at least one group with the other user.
create or replace function public.shares_group(other uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from group_members mine
    join group_members theirs on theirs.group_id = mine.group_id
    where mine.user_id = auth.uid() and theirs.user_id = other
  );
$$;

-- Create a group, add the creator as a member, and add its starter lists.
create or replace function public.create_group(p_name text, p_cover text, p_lists text[])
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  g uuid;
  i int;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if not exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'Set your name first';
  end if;
  if coalesce(array_length(p_lists, 1), 0) > 12 then
    raise exception 'Too many lists';
  end if;

  insert into groups (name, cover, created_by)
  values (trim(p_name), coalesce(p_cover, 'sky'), auth.uid())
  returning id into g;

  insert into group_members (group_id, user_id) values (g, auth.uid());

  if p_lists is not null then
    for i in 1 .. coalesce(array_length(p_lists, 1), 0) loop
      insert into lists (group_id, name, position) values (g, trim(p_lists[i]), i);
    end loop;
  end if;

  return g;
end;
$$;

-- Show a group's name and size to someone holding its invite code.
create or replace function public.group_preview(p_code text)
returns table (name text, cover text, member_count int)
language sql
security definer
stable
set search_path = public
as $$
  select g.name, g.cover, (select count(*)::int from group_members m where m.group_id = g.id)
  from groups g
  where g.invite_code = p_code;
$$;

-- Join a group with its invite code. Returns the group id.
create or replace function public.join_group(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  g uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if not exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'Set your name first';
  end if;

  select id into g from groups where invite_code = p_code;
  if g is null then
    raise exception 'That invite link is not valid';
  end if;

  insert into group_members (group_id, user_id)
  values (g, auth.uid())
  on conflict do nothing;

  return g;
end;
$$;

revoke all on function public.create_group(text, text, text[]) from public, anon;
revoke all on function public.join_group(text) from public, anon;
revoke all on function public.group_preview(text) from public, anon;
grant execute on function public.create_group(text, text, text[]) to authenticated;
grant execute on function public.join_group(text) to authenticated;
grant execute on function public.group_preview(text) to authenticated;

-- ---------- Access rules ----------
-- Guests (anonymous sign-ins) count as "authenticated" in Supabase,
-- so these rules apply to them too.

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.lists enable row level security;
alter table public.ideas enable row level security;
alter table public.reactions enable row level security;

-- Profiles: see yourself and people in your groups; edit only yourself.
create policy "profiles_select" on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_group(id));
create policy "profiles_insert" on public.profiles for insert to authenticated
  with check (id = auth.uid());
create policy "profiles_update" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Groups: members can see and rename. Creating and joining go through the functions above.
create policy "groups_select" on public.groups for select to authenticated
  using (public.is_member(id));
create policy "groups_update" on public.groups for update to authenticated
  using (public.is_member(id)) with check (public.is_member(id));

-- Members: see who is in your groups; you can remove yourself (leave).
create policy "members_select" on public.group_members for select to authenticated
  using (public.is_member(group_id));
create policy "members_delete_self" on public.group_members for delete to authenticated
  using (user_id = auth.uid());

-- Lists: any member can manage a group's lists.
create policy "lists_all" on public.lists for all to authenticated
  using (public.is_member(group_id)) with check (public.is_member(group_id));

-- Ideas: any member can see, add, edit and remove ideas in the group.
create policy "ideas_select" on public.ideas for select to authenticated
  using (public.is_member(group_id));
create policy "ideas_insert" on public.ideas for insert to authenticated
  with check (public.is_member(group_id) and added_by = auth.uid());
create policy "ideas_update" on public.ideas for update to authenticated
  using (public.is_member(group_id)) with check (public.is_member(group_id));
create policy "ideas_delete" on public.ideas for delete to authenticated
  using (public.is_member(group_id));

-- Reactions: members see all reactions in the group; you add and remove only your own.
create policy "reactions_select" on public.reactions for select to authenticated
  using (public.is_member(group_id));
create policy "reactions_insert" on public.reactions for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_member(group_id)
    and exists (select 1 from public.ideas i where i.id = idea_id and i.group_id = reactions.group_id)
  );
create policy "reactions_delete" on public.reactions for delete to authenticated
  using (user_id = auth.uid());
