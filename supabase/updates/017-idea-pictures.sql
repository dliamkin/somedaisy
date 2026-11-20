-- SomeDaisy update 017: a picture of your own on an idea
--
-- Paste this whole file into the Supabase SQL editor and run it once. It is safe to run again.
-- It needs nothing turned on first, and does not depend on the other updates.
--
-- What it is for: until now an idea's only picture was the preview picture of the page it links
-- to (update 011), and an idea with no link had none. With this, anyone in the group can add a
-- picture from their phone or computer to any idea. The app makes the picture small first
-- (about 1280 dots along its longer side, as a JPEG), so a file is a few hundred kilobytes.
--
-- What it adds:
--   * picture on ideas: where the idea's own picture is kept, as "<group id>/<file id>.jpg".
--     It has to be in the idea's own group's folder. It is separate from image_url, the link's
--     preview picture, which is left alone. When an idea has both, the app shows its own picture.
--   * A place for the pictures in Supabase Storage, called "idea-pictures". A file there can be
--     at most 1 MB and has to be a JPEG, whatever the app that sends it says.
--   * Rules for that place: only members of a group can add a picture to the group's folder,
--     list what is in it, or remove one. Nobody can replace a picture in place: a new picture is
--     a new file.
--
-- Who can see a picture: the place is "public", which in Supabase means that anyone who has a
-- picture's full web address can open it, signed in or not. That is what lets the picture show
-- on the card like any other picture on the web. The address has two long random ids in it and
-- is only ever given to the group, and nobody outside the group can list the folder to find it.
--
-- Removing: the app removes a picture's file when the picture is taken off or replaced, or the
-- idea is removed. Do not remove pictures by deleting rows from storage.objects by hand: that
-- leaves the files behind. Use the Storage page of the dashboard instead.

-- ---------- The idea's own picture ----------

alter table public.ideas add column if not exists picture text;

alter table public.ideas drop constraint if exists ideas_picture_check;
alter table public.ideas add constraint ideas_picture_check check (
  picture is null or (
    picture ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.]jpg$'
    and left(picture, 36) = group_id::text
  )
);

-- ---------- The place the pictures are kept ----------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('idea-pictures', 'idea-pictures', true, 1048576, array['image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- The group a file belongs to, read from its name ("<group id>/<file id>.jpg"). Null for any
-- name that is not shaped like that, so an odd name is simply refused instead of raising an error.
create or replace function public.picture_group(name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.]jpg$'
    then left(name, 36)::uuid
  end;
$$;

-- ---------- Who may add, list and remove ----------

drop policy if exists "idea_pictures_insert" on storage.objects;
create policy "idea_pictures_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'idea-pictures' and public.is_member(public.picture_group(name)));

-- Needed to remove a picture, and to see what a group's folder holds. Opening a picture by its
-- web address does not go through this.
drop policy if exists "idea_pictures_select" on storage.objects;
create policy "idea_pictures_select" on storage.objects for select to authenticated
  using (bucket_id = 'idea-pictures' and public.is_member(public.picture_group(name)));

drop policy if exists "idea_pictures_delete" on storage.objects;
create policy "idea_pictures_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'idea-pictures' and public.is_member(public.picture_group(name)));
