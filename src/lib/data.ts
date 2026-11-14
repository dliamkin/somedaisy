import { db } from './supabase';

export type Profile = { id: string; name: string; color: string };
export type Member = { user_id: string; name: string; color: string };
export type GroupSummary = { id: string; name: string; cover: string; members: Member[] };
export type List = { id: string; name: string; position: number };
export type Idea = {
  id: string;
  list_id: string;
  title: string;
  link: string | null;
  note: string | null;
  added_by: string | null;
  planned_for: string | null;
  created_at: string;
};
export type Reaction = { idea_id: string; user_id: string; emoji: string };
export type GroupData = {
  id: string;
  name: string;
  cover: string;
  invite_code: string;
  members: Member[];
  lists: List[];
  ideas: Idea[];
  reactions: Reaction[];
};

type MemberRow = { user_id: string; profiles: { name: string; color: string } | { name: string; color: string }[] | null };

function toMembers(rows: MemberRow[] | null | undefined): Member[] {
  return (rows ?? []).map((r) => {
    const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    return { user_id: r.user_id, name: p?.name ?? 'Someone', color: p?.color ?? '#FFD9C7' };
  });
}

function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export async function fetchGroups(): Promise<GroupSummary[]> {
  const { data, error } = await db()
    .from('groups')
    .select('id, name, cover, created_at, group_members(user_id, profiles(name, color))')
    .order('created_at', { ascending: true });
  fail(error);
  return (data ?? []).map((g) => ({
    id: g.id as string,
    name: g.name as string,
    cover: g.cover as string,
    members: toMembers(g.group_members as unknown as MemberRow[]),
  }));
}

export async function fetchGroup(id: string): Promise<GroupData | null> {
  const client = db();
  const [g, m, l, i, r] = await Promise.all([
    client.from('groups').select('id, name, cover, invite_code').eq('id', id).maybeSingle(),
    client.from('group_members').select('user_id, profiles(name, color)').eq('group_id', id).order('joined_at'),
    client.from('lists').select('id, name, position').eq('group_id', id).order('position'),
    client
      .from('ideas')
      .select('id, list_id, title, link, note, added_by, planned_for, created_at')
      .eq('group_id', id)
      .is('done_at', null)
      .order('created_at', { ascending: false }),
    client.from('reactions').select('idea_id, user_id, emoji').eq('group_id', id),
  ]);
  fail(g.error ?? m.error ?? l.error ?? i.error ?? r.error);
  if (!g.data) return null;
  return {
    id: g.data.id,
    name: g.data.name,
    cover: g.data.cover,
    invite_code: g.data.invite_code,
    members: toMembers(m.data as unknown as MemberRow[]),
    lists: (l.data ?? []) as List[],
    ideas: (i.data ?? []) as Idea[],
    reactions: (r.data ?? []) as Reaction[],
  };
}

export async function createGroup(name: string, cover: string, lists: string[]): Promise<string> {
  const { data, error } = await db().rpc('create_group', { p_name: name, p_cover: cover, p_lists: lists });
  fail(error);
  return data as string;
}

export async function previewGroup(code: string): Promise<{ name: string; cover: string; member_count: number } | null> {
  const { data, error } = await db().rpc('group_preview', { p_code: code });
  fail(error);
  const rows = (data ?? []) as { name: string; cover: string; member_count: number }[];
  return rows[0] ?? null;
}

export async function joinGroup(code: string): Promise<string> {
  const { data, error } = await db().rpc('join_group', { p_code: code });
  fail(error);
  return data as string;
}

export async function addList(groupId: string, name: string, position: number): Promise<void> {
  const { error } = await db().from('lists').insert({ group_id: groupId, name, position });
  fail(error);
}

export async function addIdea(input: {
  groupId: string;
  listId: string;
  title: string;
  link?: string;
  note?: string;
  userId: string;
  thumbsUp: boolean;
}): Promise<void> {
  const client = db();
  const { data, error } = await client
    .from('ideas')
    .insert({
      group_id: input.groupId,
      list_id: input.listId,
      title: input.title,
      link: input.link || null,
      note: input.note || null,
      added_by: input.userId,
    })
    .select('id')
    .single();
  fail(error);
  if (input.thumbsUp && data) {
    const res = await client
      .from('reactions')
      .insert({ idea_id: data.id, group_id: input.groupId, user_id: input.userId, emoji: '👍' });
    fail(res.error);
  }
}

export async function setReaction(
  groupId: string,
  ideaId: string,
  userId: string,
  emoji: string,
  on: boolean,
): Promise<void> {
  const client = db();
  if (!on) {
    const { error } = await client
      .from('reactions')
      .delete()
      .match({ idea_id: ideaId, user_id: userId, emoji });
    fail(error);
    return;
  }
  // Thumbs up and thumbs down replace each other.
  const opposite = emoji === '👍' ? '👎' : emoji === '👎' ? '👍' : null;
  if (opposite) {
    const { error } = await client
      .from('reactions')
      .delete()
      .match({ idea_id: ideaId, user_id: userId, emoji: opposite });
    fail(error);
  }
  const { error } = await client
    .from('reactions')
    .upsert({ idea_id: ideaId, group_id: groupId, user_id: userId, emoji }, { onConflict: 'idea_id,user_id,emoji' });
  fail(error);
}

/** Give an idea a date, turning it into a plan. Pass null to take the date away again. */
export async function planIdea(ideaId: string, when: Date | null): Promise<void> {
  const { error } = await db()
    .from('ideas')
    .update({ planned_for: when ? when.toISOString() : null })
    .eq('id', ideaId);
  fail(error);
}

/** Mark an idea as done. Done ideas no longer show in the group's lists. */
export async function markDone(ideaId: string): Promise<void> {
  const { error } = await db().from('ideas').update({ done_at: new Date().toISOString() }).eq('id', ideaId);
  fail(error);
}

export type DoneIdea = Idea & { done_at: string };

/** The ideas a group has marked as done, most recently done first. */
export async function fetchDone(groupId: string): Promise<DoneIdea[]> {
  const { data, error } = await db()
    .from('ideas')
    .select('id, list_id, title, link, note, added_by, planned_for, created_at, done_at')
    .eq('group_id', groupId)
    .not('done_at', 'is', null)
    .order('done_at', { ascending: false });
  fail(error);
  return (data ?? []) as DoneIdea[];
}

/** Undo "done": the idea goes back on its list, keeping its reactions and any date it had. */
export async function restoreIdea(ideaId: string): Promise<void> {
  const { error } = await db().from('ideas').update({ done_at: null }).eq('id', ideaId);
  fail(error);
}

/** An idea is "everyone's in" when the group has two or more members and all of them gave a thumbs up. */
export function everyoneIn(ideaId: string, members: Member[], reactions: Reaction[]): boolean {
  if (members.length < 2) return false;
  const ups = new Set(reactions.filter((r) => r.idea_id === ideaId && r.emoji === '👍').map((r) => r.user_id));
  return members.every((m) => ups.has(m.user_id));
}

// A screen that changes a group marks it here, so the group page knows to tell the other members.
const dirty = new Set<string>();
export function markChanged(groupId: string): void {
  dirty.add(groupId);
}
export function takeChanged(groupId: string): boolean {
  return dirty.delete(groupId);
}
