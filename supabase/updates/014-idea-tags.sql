-- SomeDaisy update 014: two optional tags on ideas, for "Pick for us"
--
-- Paste this whole file into the Supabase SQL editor and run it once. It is safe to run again.
-- It needs nothing turned on first, and does not depend on the other updates.
--
-- What it adds:
--   * takes on ideas: how long the idea takes. One of "short" (an hour or so), "medium"
--     (a few hours) or "long" (most of a day).
--   * setting on ideas: "in" for staying in, "out" for going out.
--   Both are optional. An idea without them, which is every idea made so far, is simply never
--   left out when the app picks something for the group. Any member of the group can set them,
--   the same as editing the idea's name.

alter table public.ideas add column if not exists takes text;
alter table public.ideas add column if not exists setting text;

alter table public.ideas drop constraint if exists ideas_takes_check;
alter table public.ideas add constraint ideas_takes_check check (
  takes is null or takes in ('short', 'medium', 'long')
);

alter table public.ideas drop constraint if exists ideas_setting_check;
alter table public.ideas add constraint ideas_setting_check check (
  setting is null or setting in ('in', 'out')
);
