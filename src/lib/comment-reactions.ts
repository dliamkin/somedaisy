// Reactions to a comment: an emoji a member of the group leaves on something someone said.
//
// A person has one reaction to a comment at a time. Choosing another emoji changes it, and
// choosing the same one again takes it away. On the page, a comment's reactions are gathered at
// its corner: the emoji used most, overlapping, and how many people reacted. Tapping a comment
// twice, quickly, with a finger leaves a heart.
//
// Needs supabase/updates/026-comment-reactions.sql. Before that update the comments still open,
// with no reactions on them, and trying to react says which update is missing.
//
// This is separate from the reactions on an idea itself ("I'm in", "Eh" and the emoji on its
// card), which are in src/lib/data.ts.

import { COUNTED, everyRow } from './every-row';
import { db } from './supabase';

export type CommentReaction = { comment_id: string; user_id: string; emoji: string; created_at: string };

/**
 * Said when a reaction cannot be saved because the database does not have update 026. It names
 * the update on purpose: only whoever looks after the database can put this right.
 */
export const NO_COMMENT_REACTIONS = 'Reactions on comments cannot be saved yet. The database is missing update 026 (comment reactions).';

/** How many different emoji a comment's gathered reactions show before the number. */
export const SHOWN = 3;

// The database saying it has no such table: PGRST205 from Supabase, 42P01 from Postgres itself.
const noSuchTable = (error: unknown) => ['PGRST205', '42P01'].includes((error as { code?: string } | null)?.code ?? '');

/**
 * Every reaction on an idea's comments, oldest first. Empty when the database does not have
 * update 026 yet, so the comments themselves still open.
 */
export async function fetchCommentReactions(ideaId: string): Promise<CommentReaction[]> {
  const { data, error } = await everyRow<CommentReaction>(
    (from, to) =>
      db()
        .from('comment_reactions')
        .select('comment_id, user_id, emoji, created_at', COUNTED)
        .eq('idea_id', ideaId)
        .order('created_at', { ascending: true })
        .order('comment_id')
        .order('user_id')
        .range(from, to),
    (reaction) => `${reaction.comment_id} ${reaction.user_id}`,
  );
  if (noSuchTable(error)) return [];
  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * Leave a reaction on a comment, change the one already there, or with `emoji` null take it away.
 * It is always the signed-in person's own.
 */
export async function setCommentReaction(input: { groupId: string; ideaId: string; commentId: string; userId: string; emoji: string | null }): Promise<void> {
  const table = db().from('comment_reactions');
  const { error } =
    input.emoji === null
      ? await table.delete().match({ comment_id: input.commentId, user_id: input.userId })
      : await table.upsert({ comment_id: input.commentId, idea_id: input.ideaId, group_id: input.groupId, user_id: input.userId, emoji: input.emoji }, { onConflict: 'comment_id,user_id' });
  if (noSuchTable(error)) throw new Error(NO_COMMENT_REACTIONS);
  if (error) throw new Error(error.message);
}

/** The emoji that tapping a comment twice, quickly, leaves on it. */
export const DOUBLE_TAP_EMOJI = '❤️';
/** How close together two taps on a comment have to be to count as one double tap, in milliseconds. */
export const DOUBLE_TAP_MS = 300;

/** A tap on a comment: which one, and when, in milliseconds. */
export type Tap = { commentId: string; at: number };

/** A tap on a comment that has just happened. */
export function tapOn(commentId: string): Tap {
  return { commentId, at: Date.now() };
}

/** Whether a tap, coming after the one before it, makes a double tap: the same comment, soon enough. */
export function isDoubleTap(before: Tap | null, tap: Tap, within = DOUBLE_TAP_MS): boolean {
  if (!before || before.commentId !== tap.commentId) return false;
  const gap = tap.at - before.at;
  return gap >= 0 && gap <= within;
}

/** What tapping an emoji does: it becomes the person's reaction, unless it already is, and then theirs is taken away. */
export function nextReaction(mine: string | null, picked: string): string | null {
  return picked === mine ? null : picked;
}

/**
 * The reactions as they will be once a change is saved, so the page can show it at once.
 * A changed reaction keeps its place among the others.
 */
export function withReaction(rows: CommentReaction[], commentId: string, userId: string, emoji: string | null, now: Date): CommentReaction[] {
  const mine = (r: CommentReaction) => r.comment_id === commentId && r.user_id === userId;
  if (emoji === null) return rows.filter((r) => !mine(r));
  if (rows.some(mine)) return rows.map((r) => (mine(r) ? { ...r, emoji } : r));
  return [...rows, { comment_id: commentId, user_id: userId, emoji, created_at: now.toISOString() }];
}

/** A comment's reactions, gathered. */
export type ReactionSummary = {
  /** How many people reacted. */
  total: number;
  /** The emoji used, most used first, and among equals the one used first. No more than `SHOWN`. */
  top: string[];
  /** The reaction of the person looking, if they left one. */
  mine: string | null;
  /** Everyone who reacted and with what, in the order they did. */
  people: { userId: string; emoji: string }[];
};

/**
 * Each comment's reactions, gathered, by the comment's id. A comment nobody has reacted to is
 * left out. The rows can come in any order.
 */
export function summarize(rows: CommentReaction[] | null | undefined, userId: string | null, shown = SHOWN): Record<string, ReactionSummary> {
  const inOrder = [...(rows ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.user_id.localeCompare(b.user_id));
  const byComment: Record<string, CommentReaction[]> = {};
  for (const row of inOrder) (byComment[row.comment_id] ??= []).push(row);
  const summaries: Record<string, ReactionSummary> = {};
  for (const [commentId, list] of Object.entries(byComment)) {
    // How often each emoji was used, in the order each was first used.
    const counts = new Map<string, number>();
    for (const row of list) counts.set(row.emoji, (counts.get(row.emoji) ?? 0) + 1);
    const used = [...counts.keys()];
    summaries[commentId] = {
      total: list.length,
      top: [...used].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0) || used.indexOf(a) - used.indexOf(b)).slice(0, shown),
      mine: list.find((row) => row.user_id === userId)?.emoji ?? null,
      people: list.map((row) => ({ userId: row.user_id, emoji: row.emoji })),
    };
  }
  return summaries;
}

/** "1 reaction", "3 reactions". */
export function reactionCount(total: number): string {
  return total === 1 ? '1 reaction' : `${total} reactions`;
}

/** What a screen reader says for a comment's gathered reactions: "3 reactions: 😂 ❤️. See who reacted". */
export function summaryWords(summary: Pick<ReactionSummary, 'total' | 'top'>): string {
  return `${reactionCount(summary.total)}: ${summary.top.join(' ')}. See who reacted`;
}
