-- SomeDaisy update 006: tidy links, and limits on what an idea can carry
--
-- Paste this whole file into the Supabase SQL editor and run it once. It is safe to run again.
-- It needs nothing turned on first, and does not depend on the other updates.
--
-- What it does:
--   * An idea's link has to be an ordinary web address (http:// or https://), at most 2000
--     characters. The app opens the link on friends' phones, so nothing else is let through.
--   * An idea's note is at most 1000 characters.
--   * Links saved before this are repaired: one typed without "https://" gets it added.
--   * An idea stays in its own group: it cannot be moved to another group, or onto a list that
--     belongs to a different group. (The app never tries to; this stops anything else from doing it.)

-- ---------- Repair what is already saved ----------

update public.ideas set link = null where link is not null and btrim(link) = '';
update public.ideas set link = btrim(link) where link is not null and link <> btrim(link);
update public.ideas set link = null where link is not null and char_length(link) > 1990;
-- Something with another kind of address (tel:, mailto: and so on) cannot be repaired.
update public.ideas set link = null
 where link is not null and link !~* '^https?://' and link ~* '^[a-z][a-z0-9+.-]*:';
update public.ideas set link = 'https://' || link where link is not null and link !~* '^https?://';
update public.ideas set note = left(note, 1000) where note is not null and char_length(note) > 1000;

-- ---------- The limits ----------

alter table public.ideas drop constraint if exists ideas_link_check;
alter table public.ideas add constraint ideas_link_check check (
  link is null or (char_length(link) <= 2000 and link ~* '^https?://[^[:space:]]+$')
);

alter table public.ideas drop constraint if exists ideas_note_check;
alter table public.ideas add constraint ideas_note_check check (
  note is null or char_length(note) <= 1000
);

-- ---------- An idea stays in its group ----------

create or replace function public.ideas_keep_in_group()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.group_id is distinct from old.group_id then
    raise exception 'An idea cannot be moved to another group';
  end if;
  if not exists (select 1 from lists l where l.id = new.list_id and l.group_id = new.group_id) then
    raise exception 'That list is not in this group';
  end if;
  return new;
end;
$$;

drop trigger if exists ideas_keep_in_group on public.ideas;
create trigger ideas_keep_in_group
  before insert or update of group_id, list_id on public.ideas
  for each row execute function public.ideas_keep_in_group();
