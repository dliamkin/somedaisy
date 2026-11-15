-- SomeDaisy update 009: clear out guests who never did anything
--
-- Before running: "pg_cron" should be turned on under Database > Extensions (update 001 already
-- asked for it). Then paste this whole file into the Supabase SQL editor and run it once.
-- It is safe to run again. It does not depend on the other updates.
--
-- Background: older copies of the app signed every visitor in as a guest the moment a page
-- opened, so the project collects guests who looked once and never picked a name. The app now
-- waits until someone picks a name or opens an invite, and this update removes the leftovers.
--
-- What it adds:
--   * remove_stale_guests: removes guests who have no name and were created more than 30 days
--     ago. A guest with no name has no groups, ideas, reactions or comments, so nothing anyone
--     made is lost. Guests with a name, and every account with an email, are never touched.
--   * A daily job that runs it.

create or replace function public.remove_stale_guests(p_days int default 30)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  removed int;
begin
  delete from auth.users u
   where u.is_anonymous
     and u.created_at < now() - make_interval(days => greatest(coalesce(p_days, 30), 7))
     and not exists (select 1 from profiles p where p.id = u.id);
  get diagnostics removed = row_count;
  return removed;
end;
$$;

-- Only the database itself runs this; the app cannot call it.
revoke all on function public.remove_stale_guests(int) from public, anon, authenticated;

-- Once a day, in the small hours. Skipped, with a notice, when pg_cron is not turned on.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('somedaisy-remove-stale-guests', '17 3 * * *', 'select public.remove_stale_guests()');
  else
    raise notice 'pg_cron is not turned on, so old guests are not cleared out automatically. Turn it on and run this file again.';
  end if;
end;
$$;
