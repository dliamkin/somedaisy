-- SomeDaisy update 022: a found photo as an idea's picture
--
-- Paste this whole file into the Supabase SQL editor and run it once. It is safe to run again.
-- It needs nothing turned on first, and does not depend on the other updates.
--
-- What it is for: an idea can already have a picture of its own, added from a phone or computer
-- (update 017), or the preview picture of the page it links to (update 011). With this, a person
-- can also search free photos for an idea, the same search a group's cover uses, and tap one.
--
-- Nothing is copied. A found photo is never stored as a file: the idea keeps only the photo's
-- web address and who took it, and the photo is always loaded from Unsplash's own servers. That
-- is the same as for a group's cover found by search (update 018).
--
-- What it adds:
--   * photo on ideas: the found photo, or nothing. It looks like this:
--       { "url": "https://...", "credit": "Photo by ... on Unsplash", "creditUrl": "https://..." }
--     It is separate from picture (the idea's own uploaded picture) and from image_url (the
--     link's preview picture), and both are left alone. When an idea has more than one, the app
--     shows its own picture first, then the found photo, then the link's picture.
--   * A rule that the photo is shaped that way, so one the app cannot show is never saved.
--
-- Who may save one: whoever may change the idea, which is any member of its group. Nothing
-- about that changes here.

alter table public.ideas add column if not exists photo jsonb;

-- Whether a found photo is shaped the way the app writes it: two secure web addresses, and a
-- credit of a sensible length. The app decides which sites a photo may be shown from.
create or replace function public.idea_photo_ok(p_photo jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    jsonb_typeof(p_photo) = 'object'
    and length(p_photo::text) <= 2500
    and jsonb_typeof(p_photo -> 'url') = 'string'
    and (p_photo ->> 'url') ~ '^https://[^[:space:]]+$'
    and length(p_photo ->> 'url') <= 1000
    and jsonb_typeof(p_photo -> 'credit') = 'string'
    and length(btrim(p_photo ->> 'credit')) between 1 and 120
    and jsonb_typeof(p_photo -> 'creditUrl') = 'string'
    and (p_photo ->> 'creditUrl') ~ '^https://[^[:space:]]+$'
    and length(p_photo ->> 'creditUrl') <= 1000,
    false);
$$;

alter table public.ideas drop constraint if exists ideas_photo_check;
alter table public.ideas add constraint ideas_photo_check check (photo is null or public.idea_photo_ok(photo));
