-- SomeDaisy update 028: change the words of your own comment
--
-- Before running: run update 003 (comments) first. Then paste this whole file into the Supabase
-- SQL editor and run it once. It is safe to run again.
--
-- What it is for: on an idea's page, a small pencil hangs off the foot of each of your own
-- comments, beside the face for reacting. It opens the comment, where its words can be changed or
-- the comment deleted. A comment whose words have been changed says "edited" under them, for
-- everyone who reads it.
--
-- What it adds:
--   * comments.edited_at: when a comment's words were last changed. Empty for a comment that has
--     never been changed.
--   * edit_comment: changes the words of one of your own comments, and notes when. It is the only
--     way to change a comment: there is still no rule that lets anyone update the comments table,
--     so nothing else about a comment (whose it is, which idea it is on, when it was written) can
--     be changed by anyone.
--
-- What does not change: a comment is still removed only by whoever wrote it. Its reactions stay
-- on it when its words change. Nobody is sent a notification about a changed comment. People
-- reading the comments see the new words as they are saved, by the signal update 016 (live
-- updates) already sends when a comment changes.

do $$
begin
  if to_regclass('public.comments') is null then
    raise exception 'Run update 003 (comments) first';
  end if;
end;
$$;

alter table public.comments add column if not exists edited_at timestamptz;

-- Change the words of one of your own comments. True when they were changed, false when the new
-- words are the ones it already has, which changes nothing and does not mark it as edited.
create or replace function public.edit_comment(p_comment uuid, p_body text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  words text := btrim(coalesce(p_body, ''), E' \t\n\r');
  mine record;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select c.id, c.group_id, c.body into mine from comments c where c.id = p_comment and c.user_id = auth.uid();
  -- The same answer for a comment that does not exist, somebody else's, and one in a group the
  -- person has since left.
  if mine.id is null or not is_member(mine.group_id) then
    raise exception 'That is not your comment';
  end if;
  if char_length(words) = 0 then
    raise exception 'A comment needs some words';
  end if;
  if char_length(words) > 500 then
    raise exception 'A comment can be 500 characters at most';
  end if;
  if words = mine.body then
    return false;
  end if;

  update comments set body = words, edited_at = now() where id = p_comment;
  return true;
end;
$$;

revoke all on function public.edit_comment(uuid, text) from public, anon;
grant execute on function public.edit_comment(uuid, text) to authenticated;
