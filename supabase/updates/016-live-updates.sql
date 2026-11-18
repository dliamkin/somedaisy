-- SomeDaisy update 016: live updates sent by the database
--
-- Paste this whole file into the Supabase SQL editor and run it once. It is safe to run again.
-- It needs nothing turned on first. It covers the tables that exist when it is run, so if one of
-- the earlier updates (comments, "you did it") is run after this one, run this one again.
--
-- What it is for: when one person changes something in a group, the other people looking at
-- that group should see it without refreshing. Until now the phone that made the change told
-- the others itself, after saving. That is lost whenever that phone closes the app, loses its
-- connection or leaves the screen at the wrong moment. With this update the database tells
-- everyone, as part of saving the change, whoever made it and from wherever.
--
-- What it adds:
--   * A short "something changed" signal, sent to everyone with the group open, each time a
--     row of that group is added, changed or removed: the group itself, its members, lists,
--     ideas, reactions, comments, completions and do-again answers.
--   * The same signal to people reading an idea's comments, when a comment there changes.
--
-- The signal carries no data at all: no names, no titles, nothing from the row. The app answers
-- it by loading the group again in the usual way, so the usual rules about who may read what
-- still decide what anyone sees. It goes to the same channel the app already listens on, so
-- phones with the build already installed get it too.
--
-- It can never get in the way of a save. If the signal cannot be sent (Supabase's Realtime is
-- turned off, or having a bad moment), the change is saved all the same and the app's own
-- 20-second refresh picks it up.

create or replace function public.tell_group()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed jsonb;
  target text;
  told text;
begin
  if tg_op = 'DELETE' then
    changed := to_jsonb(old);
  else
    changed := to_jsonb(new);
  end if;
  -- Every table carries its group's id, except the groups table, where it is the row's own id.
  target := case when tg_table_name = 'groups' then changed ->> 'id' else changed ->> 'group_id' end;
  if target is null then
    return null;
  end if;

  -- One signal per group for each save, however many rows it touches. Removing a group, for
  -- example, removes every idea in it, and that should not send a hundred signals.
  told := coalesce(current_setting('somedaisy.told', true), '');
  if position('group:' || target in told) = 0 then
    perform set_config('somedaisy.told', told || ' group:' || target, true);
    begin
      -- Nothing to do where Realtime is not installed.
      if to_regprocedure('realtime.send(jsonb, text, text, boolean)') is not null then
        perform realtime.send(payload => '{}'::jsonb, event => 'changed', topic => 'group:' || target, private => false);
      end if;
    exception when others then
      -- A signal that cannot be sent must not undo the change it was about.
      null;
    end;
  end if;

  -- People reading an idea's comments listen on a channel of their own.
  if tg_table_name = 'comments' and changed ->> 'idea_id' is not null then
    told := coalesce(current_setting('somedaisy.told', true), '');
    if position('idea:' || (changed ->> 'idea_id') in told) = 0 then
      perform set_config('somedaisy.told', told || ' idea:' || (changed ->> 'idea_id'), true);
      begin
        if to_regprocedure('realtime.send(jsonb, text, text, boolean)') is not null then
          perform realtime.send(payload => '{}'::jsonb, event => 'changed', topic => 'idea:' || (changed ->> 'idea_id'), private => false);
        end if;
      exception when others then
        null;
      end;
    end if;
  end if;

  return null;
end;
$$;

-- Only the database calls this, from the triggers below.
revoke all on function public.tell_group() from public, anon, authenticated;

do $$
declare
  watched text;
begin
  foreach watched in array array['groups', 'group_members', 'lists', 'ideas', 'reactions', 'comments', 'completions', 'do_again_votes']
  loop
    -- A table from an update that has not been run yet is skipped.
    if to_regclass('public.' || watched) is not null then
      execute format('drop trigger if exists tell_group on public.%I', watched);
      execute format('create trigger tell_group after insert or update or delete on public.%I for each row execute function public.tell_group()', watched);
    end if;
  end loop;
end;
$$;
