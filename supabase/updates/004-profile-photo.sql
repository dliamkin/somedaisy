-- SomeDaisy update 004: Google profile photos
--
-- Paste this whole file into the Supabase SQL editor and run it once. It is safe to run again.
-- It does not depend on the other updates.
--
-- What it adds:
--   * photo_url on profiles: the picture from someone's Google account, shown in place of the
--     coloured circle with their initial. The app fills it in when they sign in with Google.
--   * photo_hidden on profiles: their choice not to show it. The app then keeps photo_url empty.
--
-- Who can see and change these follows the rules profiles already have: you and the people in
-- your groups can see your profile, and only you can change it.

alter table public.profiles add column if not exists photo_url text;
alter table public.profiles add column if not exists photo_hidden boolean not null default false;

-- A profile is filled in by the app on its owner's phone, so the address could be anything.
-- Friends' phones load it, so only pictures served by Google are allowed.
alter table public.profiles drop constraint if exists profiles_photo_url_check;
alter table public.profiles add constraint profiles_photo_url_check check (
  photo_url is null
  or (char_length(photo_url) <= 500 and photo_url ~ '^https://lh[0-9]\.googleusercontent\.com/[A-Za-z0-9_=./-]+$')
);

-- Someone who has chosen not to show their photo has none stored.
alter table public.profiles drop constraint if exists profiles_photo_hidden_check;
alter table public.profiles add constraint profiles_photo_hidden_check check (
  not photo_hidden or photo_url is null
);
