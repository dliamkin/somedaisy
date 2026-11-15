-- SomeDaisy update 011: a preview picture for ideas with a link
--
-- Paste this whole file into the Supabase SQL editor and run it once. It is safe to run again.
-- It needs nothing turned on first, and does not depend on the other updates.
--
-- What it adds:
--   * image_url on ideas: the web address of the preview picture of the page an idea links to.
--     Only the address is kept, never the picture itself. The app fills it in after asking the
--     "link-preview" server-side helper (see "Link previews" in README.md), and shows the
--     picture on the idea's card.
--   * The address has to be a secure web address (https://) of at most 2000 characters.
--   * Changing or removing an idea's link clears the picture, so a card never shows the old
--     page's picture. This also covers older copies of the app, which know nothing about pictures.

alter table public.ideas add column if not exists image_url text;

alter table public.ideas drop constraint if exists ideas_image_url_check;
alter table public.ideas add constraint ideas_image_url_check check (
  image_url is null or (char_length(image_url) <= 2000 and image_url ~* '^https://[^[:space:]]+$')
);

create or replace function public.ideas_clear_image()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Only when this change did not itself bring a new picture.
  if new.link is distinct from old.link and new.image_url is not distinct from old.image_url then
    new.image_url := null;
  end if;
  if new.link is null then
    new.image_url := null;
  end if;
  return new;
end;
$$;

-- Named to run after ideas_tidy (update 006), which may change the link first.
drop trigger if exists ideas_zz_clear_image on public.ideas;
create trigger ideas_zz_clear_image
  before update of link, image_url on public.ideas
  for each row execute function public.ideas_clear_image();
