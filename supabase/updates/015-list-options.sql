-- SomeDaisy update 015: what each list asks for
--
-- Paste this whole file into the Supabase SQL editor and run it once. It is safe to run again.
-- It needs nothing turned on first, and does not depend on the other updates.
--
-- What it adds, on lists:
--   * dates: whether the ideas on this list can be given a date. Movies, Places and Food can.
--     A list such as "Song titles" has nothing to schedule, so it can be turned off there.
--   * links: whether the form for a new idea on this list shows the link box.
--   * notes: whether the form for a new idea on this list shows the note box.
--   All three start turned on, so every list made so far works exactly as before. An idea's
--   name is the only thing every list asks for. Any member of the group can change these, the
--   same as renaming a list.
--
-- Turning one off only changes what the app offers. Nothing is removed: an idea that already
-- has a date, a link or a note keeps it.

alter table public.lists add column if not exists dates boolean not null default true;
alter table public.lists add column if not exists links boolean not null default true;
alter table public.lists add column if not exists notes boolean not null default true;
