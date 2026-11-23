-- SomeDaisy update 023: how a group's garden looks
--
-- Paste this whole file into the Supabase SQL editor and run it once. It is safe to run again.
-- It needs nothing turned on first, and does not depend on the other updates.
--
-- What it is for: in the garden view, a group can paint its house (roof, walls and door), choose
-- how the lawn is kept, and switch the things it has earned for the yard on and off. Everyone in
-- the group sees the same garden, so those choices are kept on the group.
--
-- What it adds:
--   * garden on groups: the group's choices. It is empty for every group to begin with, and empty
--     means the garden as it first was: a purple roof, white walls, a purple door, a soft lawn,
--     and every earned thing switched on.
--   * A check that whatever is saved there is shaped the way the app writes it.
--
-- Any member can change it, the same as a group's name and cover. What a group has earned is not
-- kept here: the app works that out from how many things the group has done.
--
-- What garden holds, when it is not empty:
--   { "roof": "#8A4BE6", "walls": "#FFFFFF", "door": "#6D2FC4", "lawn": "soft",
--     "bench": true, "bath": true, "lights": true }

alter table public.groups add column if not exists garden jsonb;

-- Whether a garden's choices are shaped the way the app writes them. Anything else is refused.
create or replace function public.garden_look_ok(p_look jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    jsonb_typeof(p_look) = 'object'
    and length(p_look::text) <= 400
    and (p_look ->> 'roof') ~ '^#[0-9A-Fa-f]{6}$'
    and (p_look ->> 'walls') ~ '^#[0-9A-Fa-f]{6}$'
    and (p_look ->> 'door') ~ '^#[0-9A-Fa-f]{6}$'
    and (p_look ->> 'lawn') in ('soft', 'mown', 'meadow')
    and jsonb_typeof(p_look -> 'bench') = 'boolean'
    and jsonb_typeof(p_look -> 'bath') = 'boolean'
    and jsonb_typeof(p_look -> 'lights') = 'boolean',
    false);
$$;

alter table public.groups drop constraint if exists groups_garden_check;
alter table public.groups add constraint groups_garden_check
  check (garden is null or public.garden_look_ok(garden));
