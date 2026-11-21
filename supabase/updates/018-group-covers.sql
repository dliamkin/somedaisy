-- SomeDaisy update 018: more covers for a group
--
-- Paste this whole file into the Supabase SQL editor and run it once. It is safe to run again.
-- It needs nothing turned on first, and does not depend on the other updates.
--
-- What it is for: until now a group's cover was one of four colours, kept on the group as a
-- word ("sky", "peach", "mint" or "yellow"). With this, a group can also choose a look made of
-- three colours, turn the flower pattern off, or (once update 019 is in) use a photo.
--
-- What it adds:
--   * cover_style on groups: everything about a cover that the word cannot say. It is empty for
--     every group to begin with, and empty means "the classic colour, with the pattern on", which
--     is what every group has today. So nothing changes for anyone until they choose a new cover.
--   * A check that whatever is saved there is shaped the way the app writes it.
--   * A rule for older copies of the app, which only know the word: when one of them changes a
--     group's colour, cover_style is emptied, so every copy of the app shows that colour.
--
-- What it leaves alone: the "cover" column, and everything that reads it. Copies of the app
-- already on people's phones keep working, and show a group's classic colour.
--
-- What cover_style holds, when it is not empty:
--   { "kind": "classic", "background": "#CDEFE0", "pattern": false }
--   { "kind": "look", "background": "#4B2A8C", "shape1": "#6D2FC4", "shape2": "#B8339A", "pattern": true }
--   { "kind": "photo", "background": "#CDEFE0", "pattern": true,
--     "photo": { "source": "upload", "path": "<group id>/cover.jpg", "version": 3 } }
--   { "kind": "photo", "background": "#CDEFE0", "pattern": true,
--     "photo": { "source": "search", "url": "https://...", "credit": "Photo by ...", "creditUrl": "https://..." } }
-- A photo cover keeps a colour too: it is shown while the photo loads, or if it will not load.

-- ---------- The cover's details ----------

alter table public.groups add column if not exists cover_style jsonb;

-- Whether a cover's details are shaped the way the app writes them. Anything else is refused,
-- so a cover the app cannot draw is never saved. An uploaded photo has to be the one file in the
-- group's own folder.
create or replace function public.cover_style_ok(p_group uuid, p_style jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    jsonb_typeof(p_style) = 'object'
    and length(p_style::text) <= 2000
    and (p_style ->> 'background') ~ '^#[0-9A-Fa-f]{6}$'
    and jsonb_typeof(p_style -> 'pattern') = 'boolean'
    and case p_style ->> 'kind'
      when 'classic' then true
      when 'look' then
        (p_style ->> 'shape1') ~ '^#[0-9A-Fa-f]{6}$'
        and (p_style ->> 'shape2') ~ '^#[0-9A-Fa-f]{6}$'
      when 'photo' then
        jsonb_typeof(p_style -> 'photo') = 'object'
        and case p_style -> 'photo' ->> 'source'
          when 'upload' then
            (p_style -> 'photo' ->> 'path') = p_group::text || '/cover.jpg'
            and jsonb_typeof(p_style -> 'photo' -> 'version') = 'number'
            and (p_style -> 'photo' ->> 'version') ~ '^[1-9][0-9]{0,8}$'
          when 'search' then
            (p_style -> 'photo' ->> 'url') ~ '^https://[^[:space:]]+$'
            and length(p_style -> 'photo' ->> 'url') <= 1000
            and length(btrim(p_style -> 'photo' ->> 'credit')) between 1 and 120
            and (p_style -> 'photo' ->> 'creditUrl') ~ '^https://[^[:space:]]+$'
            and length(p_style -> 'photo' ->> 'creditUrl') <= 1000
          else false
        end
      else false
    end,
    false);
$$;

alter table public.groups drop constraint if exists groups_cover_style_check;
alter table public.groups add constraint groups_cover_style_check
  check (cover_style is null or public.cover_style_ok(id, cover_style));

-- ---------- Older copies of the app ----------

-- A copy of the app from before this update changes the word and knows nothing of cover_style.
-- When the word changes and the details do not, the details are emptied, so the colour that was
-- just chosen is the one everybody sees. The app of today changes both at once, or the details
-- alone, and is not affected.
create or replace function public.groups_cover_sync()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.cover is distinct from old.cover and new.cover_style is not distinct from old.cover_style then
    new.cover_style := null;
  end if;
  return new;
end;
$$;

drop trigger if exists groups_cover_sync on public.groups;
create trigger groups_cover_sync
  before update on public.groups
  for each row execute function public.groups_cover_sync();
