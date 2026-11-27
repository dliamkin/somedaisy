// Comments on an idea. Any member of the group can read and add them; people change and remove only their own.
// Needs supabase/updates/003-comments.sql, and 028-edit-comment.sql for changing one.

import { COUNTED, everyRow } from './every-row';
import { db } from './supabase';

/** `edited_at` is when its words were last changed (update 028). Empty, or not there at all, for one that never was. */
export type Comment = { id: string; idea_id: string; user_id: string; body: string; created_at: string; edited_at?: string | null };

export const COMMENT_MAX = 500;

/** What will be saved: trimmed, and null when there is nothing to say. */
export function cleanComment(text: string): string | null {
  const body = text.trim().slice(0, COMMENT_MAX);
  return body ? body : null;
}

/** An idea's comments, oldest first, so they read like a conversation. */
export async function fetchComments(ideaId: string): Promise<Comment[]> {
  const { data, error } = await everyRow<Comment>(
    (from, to) =>
      db()
        .from('comments')
        // Every column, so that this still reads the comments before update 028 has added one.
        .select('*', COUNTED)
        .eq('idea_id', ideaId)
        .order('created_at', { ascending: true })
        .order('id')
        .range(from, to),
    (comment) => comment.id,
  );
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function addComment(input: { groupId: string; ideaId: string; userId: string; text: string }): Promise<void> {
  const body = cleanComment(input.text);
  if (!body) return;
  const { error } = await db()
    .from('comments')
    .insert({ group_id: input.groupId, idea_id: input.ideaId, user_id: input.userId, body });
  if (error) throw new Error(error.message);
}

export async function removeComment(commentId: string): Promise<void> {
  const { error } = await db().from('comments').delete().eq('id', commentId);
  if (error) throw new Error(error.message);
}

/**
 * Change the words of one of your own comments (update 028). True when they were changed, which
 * marks the comment as edited. False when there was nothing to save: the words are the ones it
 * already has, or there are none.
 */
export async function editComment(commentId: string, text: string): Promise<boolean> {
  const body = cleanComment(text);
  if (!body) return false;
  const { data, error } = await db().rpc('edit_comment', { p_comment: commentId, p_body: body });
  // The database has no such function until update 028 is run.
  if (error?.code === 'PGRST202') throw new Error('Changing a comment is not set up yet. Try again later.');
  if (error) throw new Error(error.message);
  return data === true;
}

/** Whether a comment's words have been changed since it was written. */
export function wasEdited(comment: Pick<Comment, 'edited_at'>): boolean {
  return Boolean(comment.edited_at);
}

/** How many comments each idea has, from the rows of a group's comments. */
export function countByIdea(rows: { idea_id: string }[] | null | undefined): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows ?? []) counts[row.idea_id] = (counts[row.idea_id] ?? 0) + 1;
  return counts;
}

/**
 * The newest few comments on each idea, oldest of them first so they read like a conversation.
 * The rows can come in any order. Ideas with no comments are left out.
 */
export function latestByIdea(rows: Comment[] | null | undefined, keep = 2): Record<string, Comment[]> {
  const latest: Record<string, Comment[]> = {};
  const inOrder = [...(rows ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at));
  for (const row of inOrder) {
    const list = (latest[row.idea_id] ??= []);
    list.push(row);
    if (list.length > keep) list.shift();
  }
  return latest;
}

/** When a comment was written, said briefly: "just now", "5 min ago", "3 hr ago", then the date. */
export function timeAgo(iso: string, now: Date): string {
  const then = new Date(iso);
  const minutes = Math.floor((now.getTime() - then.getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return then.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
