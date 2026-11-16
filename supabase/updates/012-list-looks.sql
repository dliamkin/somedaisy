-- SomeDaisy update 012: an icon and a colour for each list
--
-- Paste this whole file into the Supabase SQL editor and run it once. It is safe to run again.
-- It needs nothing turned on first, and does not depend on the other updates.
--
-- What it adds:
--   * icon on lists: the name of one of the app's drawn icons (for example "movie" or "daisy").
--   * color on lists: a colour as # followed by six letters or numbers (for example "#7B3FE4").
--   Both are optional. A list without them, which is every list made so far, gets an icon guessed
--   from its name and a colour by its place among the group's lists, worked out in the app.
--   Any member of the group can set them, the same as renaming a list.

alter table public.lists add column if not exists icon text;
alter table public.lists add column if not exists color text;

alter table public.lists drop constraint if exists lists_icon_check;
alter table public.lists add constraint lists_icon_check check (
  icon is null or icon ~ '^[a-z][a-z0-9-]{0,29}$'
);

alter table public.lists drop constraint if exists lists_color_check;
alter table public.lists add constraint lists_color_check check (
  color is null or color ~ '^#[0-9A-Fa-f]{6}$'
);
