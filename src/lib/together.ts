// Reading and saving what a group has done together: completions (which carry the points),
// and each person's answer to "would you do it again?".
// Needs supabase/updates/008-you-did-it.sql. Until that has been run, the readers here answer
// null ("not available") instead of failing, so the rest of the app carries on as before.
// Any other failure, such as a dropped connection, is still a failure: it must not be mistaken
// for "not set up", or the app would fall back to how things worked before the update.

import type { Completion, DoAgainVote } from './points';
import { db } from './supabase';

const COMPLETION = 'id, idea_id, title, list_id, list_name, done_at, waited_days, repeat, first_in_list, long_wait, points';

type Failure = { message: string; code?: string };

/** True when the database is saying it has no such table or column: the update has not been run. */
export function notSetUp(error: Failure | null): boolean {
  return Boolean(error && ['PGRST205', 'PGRST204', '42P01', '42703'].includes(error.code ?? ''));
}

/** Everything a group has done, newest first. Null when points are not set up in the database yet. */
export async function fetchCompletions(groupId: string): Promise<Completion[] | null> {
  const { data, error } = await db().from('completions').select(COMPLETION).eq('group_id', groupId).order('done_at', { ascending: false });
  if (notSetUp(error)) return null;
  if (error) throw new Error(error.message);
  return (data ?? []) as Completion[];
}

/** The points of every group this person is in, by group id. Null when points are not set up yet. */
export async function fetchPointsByGroup(): Promise<Record<string, number> | null> {
  const { data, error } = await db().from('completions').select('group_id, points');
  if (error) return null;
  const totals: Record<string, number> = {};
  for (const row of (data ?? []) as { group_id: string; points: number }[]) totals[row.group_id] = (totals[row.group_id] ?? 0) + row.points;
  return totals;
}

/**
 * The completion the database has just recorded for an idea, to celebrate it. Null when there is
 * none from the last few minutes: points are not set up, or this was the same outing marked twice.
 */
export async function fetchFreshCompletion(ideaId: string, now: Date = new Date()): Promise<Completion | null> {
  const { data, error } = await db().from('completions').select(COMPLETION).eq('idea_id', ideaId).order('done_at', { ascending: false }).limit(1);
  const latest = error ? null : (((data ?? []) as Completion[])[0] ?? null);
  if (!latest) return null;
  return Math.abs(now.getTime() - new Date(latest.done_at).getTime()) < 5 * 60 * 1000 ? latest : null;
}

/** Everyone's do-again answers in a group. Null when they are not set up in the database yet. */
export async function fetchDoAgainVotes(groupId: string): Promise<DoAgainVote[] | null> {
  const { data, error } = await db().from('do_again_votes').select('idea_id, user_id, again').eq('group_id', groupId);
  if (notSetUp(error)) return null;
  if (error) throw new Error(error.message);
  return (data ?? []) as DoAgainVote[];
}

/** Save this person's answer to "would you do it again?". Answering again replaces the earlier answer. */
export async function setDoAgain(groupId: string, ideaId: string, userId: string, again: boolean): Promise<void> {
  const { error } = await db()
    .from('do_again_votes')
    .upsert({ idea_id: ideaId, group_id: groupId, user_id: userId, again, updated_at: new Date().toISOString() }, { onConflict: 'idea_id,user_id' });
  if (error) throw new Error(error.message);
}

/**
 * Take something off the do-again shelf to do it once more: it goes back on its list with no
 * date, keeping its reactions, comments and everyone's do-again answers.
 */
export async function doItAgain(ideaId: string): Promise<void> {
  const { error } = await db().from('ideas').update({ done_at: null, planned_for: null }).eq('id', ideaId);
  if (error) throw new Error(error.message);
}

/** A done idea this person has not yet said whether they would do again. */
export type AgainPrompt = { id: string; title: string };

/**
 * The things the group did in the last 30 days that this person has not answered for, most
 * recent first. Empty when there are none, or when do-again answers are not set up yet.
 */
export async function fetchAgainPrompts(groupId: string, userId: string, now: Date = new Date()): Promise<AgainPrompt[]> {
  const client = db();
  const since = new Date(now.getTime() - 30 * 86400000).toISOString();
  const [done, votes] = await Promise.all([
    client.from('ideas').select('id, title, done_at').eq('group_id', groupId).gte('done_at', since).order('done_at', { ascending: false }).limit(10),
    client.from('do_again_votes').select('idea_id').eq('group_id', groupId).eq('user_id', userId),
  ]);
  if (done.error || votes.error) return [];
  const answered = new Set(((votes.data ?? []) as { idea_id: string }[]).map((v) => v.idea_id));
  return ((done.data ?? []) as AgainPrompt[]).filter((i) => !answered.has(i.id)).map((i) => ({ id: i.id, title: i.title }));
}

/** How long after "We did it" the mark can still be undone, points and stamp included. */
export const UNDO_MINUTES = 10;

/** True while something marked as done at that time can still be undone. */
export function canUndoDone(doneAt: string | null | undefined, now: Date = new Date()): boolean {
  if (!doneAt) return false;
  const age = now.getTime() - new Date(doneAt).getTime();
  // A phone's clock can run a little ahead of the database's, hence the minute of leeway.
  return age > -60 * 1000 && age < UNDO_MINUTES * 60 * 1000;
}

/**
 * Take back a mistaken "We did it": the idea returns to its list and the points and stamp it has
 * just earned are removed. False when it is too late and nothing was changed.
 * Needs supabase/updates/013-undo-done.sql.
 */
export async function undoDone(ideaId: string): Promise<boolean> {
  const { data, error } = await db().rpc('undo_done', { p_idea: ideaId });
  if (error?.code === 'PGRST202') throw new Error('Undo is not set up yet. Try again later.');
  if (error) throw new Error(error.message);
  return data === true;
}
