-- SomeDaisy update 019: a photo as a group's cover
--
-- Paste this whole file into the Supabase SQL editor and run it once. It is safe to run again.
-- It needs nothing turned on first. A photo cover is saved on the group in cover_style, which
-- comes from update 018, so run that one too if it has not been run.
--
-- What it is for: a group can use a photo of its own as its cover. The app makes the photo small
-- on the device first (at most 1200 dots wide, as a JPEG, aiming for under 200 KB), then keeps it
-- here. Each group has room for one photo. A new one takes the place of the old one.
--
-- What it adds:
--   * A place for the photos in Supabase Storage, called "group-covers". A file there can be at
--     most 512 KB and has to be a JPEG, whatever the app that sends it says.
--   * Rules for that place: a group's photo is the one file "<group id>/cover.jpg", and only
--     members of that group can add it, see it, replace it or remove it.
--
-- Who can see a photo: only members of the group, and only while signed in. This place is
-- private, unlike the one for pictures on ideas (update 017), because a cover can be a photo of
-- people. The app asks for a web address that works for one day each time it needs to show the
-- photo. That address works for anyone who has it until the day is up, and the app gives it to
-- nobody but the member it was made for.
--
-- Removing: the app removes the file when the group goes back to colours, and when its last
-- member leaves. Do not remove photos by deleting rows from storage.objects by hand: Supabase
-- refuses that, and it would leave the file behind. Use the Storage page of the dashboard.

-- ---------- The place the photos are kept ----------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('group-covers', 'group-covers', false, 524288, array['image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- The group a cover photo belongs to, read from its name ("<group id>/cover.jpg"). Null for any
-- other name, so an odd name is simply refused instead of raising an error, and a group can
-- never hold a second file.
create or replace function public.cover_group(name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/cover[.]jpg$'
    then left(name, 36)::uuid
  end;
$$;

-- ---------- Who may add, see, replace and remove ----------

drop policy if exists "group_covers_insert" on storage.objects;
create policy "group_covers_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'group-covers' and public.is_member(public.cover_group(name)));

-- Needed to show the photo (the app asks for an address as the member), and to replace or remove it.
drop policy if exists "group_covers_select" on storage.objects;
create policy "group_covers_select" on storage.objects for select to authenticated
  using (bucket_id = 'group-covers' and public.is_member(public.cover_group(name)));

-- Replacing the photo in place. The file stays the group's own one file: it cannot be renamed
-- into another group's folder, or to any other name.
drop policy if exists "group_covers_update" on storage.objects;
create policy "group_covers_update" on storage.objects for update to authenticated
  using (bucket_id = 'group-covers' and public.is_member(public.cover_group(name)))
  with check (bucket_id = 'group-covers' and public.is_member(public.cover_group(name)));

drop policy if exists "group_covers_delete" on storage.objects;
create policy "group_covers_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'group-covers' and public.is_member(public.cover_group(name)));
