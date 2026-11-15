-- SomeDaisy update 006: tidy links, and limits on what an idea can carry
--
-- Paste this whole file into the Supabase SQL editor and run it once. It is safe to run again.
-- It needs nothing turned on first, and does not depend on the other updates.
--
-- What it does:
--   * An idea's link is always an ordinary web address (http:// or https://), at most 2000
--     characters. The app opens the link on friends' phones, so nothing else is let through.
--   * The database tidies what it is given, the same way the app does: spaces around a link are
--     trimmed, a link typed without "https://" gets it added, and anything that still is not a
--     web address is dropped, leaving the idea with no link. An idea is never refused because of
--     its link, so older copies of the app, which send links as typed, keep working.
--   * An idea's note is at most 1000 characters; a longer one is cut to fit.
--   * Links and notes saved before this are tidied in the same way.
--   * An idea stays in its own group: it cannot be moved to another group, or onto a list that
--     belongs to a different group. (The app never tries to; this stops anything else from doing it.)

-- ---------- Tidying ----------

create or replace function public.ideas_tidy()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.link is not null then
    new.link := btrim(new.link, E' \t\r\n');
    if new.link = '' then
      new.link := null;
    elsif new.link !~* '^https?://' then
      if new.link ~* '^[a-z][a-z0-9+-]*:' then
        -- Another kind of address (tel:, mailto: and so on) is not something to open for friends.
        new.link := null;
      else
        new.link := 'https://' || new.link;
      end if;
    end if;
    if new.link is not null and (char_length(new.link) > 2000 or new.link !~* '^https?://[^[:space:]]+$') then
      new.link := null;
    end if;
  end if;
  if new.note is not null and char_length(new.note) > 1000 then
    new.note := left(new.note, 1000);
  end if;
  return new;
end;
$$;

drop trigger if exists ideas_tidy on public.ideas;
create trigger ideas_tidy
  before insert or update of link, note on public.ideas
  for each row execute function public.ideas_tidy();

-- Tidy what is already saved, by passing every link and note through the same trigger.
update public.ideas set link = link, note = note where link is not null or note is not null;

-- ---------- The limits ----------

-- A backstop: the trigger above already makes sure of both.
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
