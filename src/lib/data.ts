import { countByIdea, latestByIdea, type Comment } from './comments';
import { ALL_ON, sameOptions, type ListOptions } from './list-options';
import { db } from './supabase';
import { DEFAULT_AVATAR } from './theme';

/** `photo_url` and `photo_hidden` need supabase/updates/004-profile-photo.sql; without it they are simply absent. */
export type Profile = { id: string; name: string; color: string; photo_url?: string | null; photo_hidden?: boolean };
/** `photo` is the person's Google picture, when they have one and show it. */
export type Member = { user_id: string; name: string; color: string; photo: string | null };
export type GroupSummary = { id: string; name: string; cover: string; members: Member[] };
/**
 * `icon` and `color` need supabase/updates/012-list-looks.sql, and `dates`, `links` and `notes`
 * need 015-list-options.sql; without those updates they are simply absent. See `optionsOf` in
 * `src/lib/list-options.ts` for what an absent choice means.
 */
export type List = {
  id: string;
  name: string;
  position: number;
  icon?: string | null;
  color?: string | null;
  dates?: boolean | null;
  links?: boolean | null;
  notes?: boolean | null;
};
export type Idea = {
  id: string;
  list_id: string;
  title: string;
  link: string | null;
  note: string | null;
  added_by: string | null;
  planned_for: string | null;
  created_at: string;
  /** The preview picture of the page the link goes to. Absent until update 011 has been run. */
  image_url?: string | null;
  /** How long it takes: "short", "medium" or "long". Absent until update 014 has been run. */
  takes?: string | null;
  /** "in" for staying in, "out" for going out. Absent until update 014 has been run. */
  setting?: string | null;
};

/** The two optional tags "Pick for us" goes by (see `src/lib/pick.ts`). Null means not said. */
export type IdeaTags = { takes: string | null; setting: string | null };
export type Reaction = { idea_id: string; user_id: string; emoji: string };
export type GroupData = {
  id: string;
  name: string;
  cover: string;
  invite_code: string;
  /** The member who can remove people and replace the invite link. See `ownerOf`. */
  owner: string | null;
  members: Member[];
  lists: List[];
  ideas: Idea[];
  reactions: Reaction[];
  /** How many comments each idea has, by idea id. Ideas with none are left out. */
  commentCounts: Record<string, number>;
  /** The newest two comments on each idea, older one first, to show on its card. */
  latestComments: Record<string, Comment[]>;
  /** The points the group has earned by doing things. Null when points are not set up in the database yet (update 008). */
  points: number | null;
};

type MemberProfile = { name: string; color: string; photo_url?: string | null };
type MemberRow = { user_id: string; profiles: MemberProfile | MemberProfile[] | null };

function toMembers(rows: MemberRow[] | null | undefined): Member[] {
  return (rows ?? []).map((r) => {
    const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    return { user_id: r.user_id, name: p?.name ?? 'Someone', color: p?.color ?? DEFAULT_AVATAR, photo: p?.photo_url ?? null };
  });
}

function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export async function fetchGroups(): Promise<GroupSummary[]> {
  const { data, error } = await db()
    .from('groups')
    .select('id, name, cover, created_at, group_members(user_id, profiles(*))')
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
  const [g, m, l, i, r, c, p] = await Promise.all([
    client.from('groups').select('id, name, cover, invite_code, created_by').eq('id', id).maybeSingle(),
    client.from('group_members').select('user_id, profiles(*)').eq('group_id', id).order('joined_at'),
    // "*" takes whatever a list has, so this works before and after update 012 (icons and colours).
    client.from('lists').select('*').eq('group_id', id).order('position'),
    client
      .from('ideas')
      // "*" takes whatever an idea has, so this works before and after update 011 (preview pictures).
      .select('*')
      .eq('group_id', id)
      .is('done_at', null)
      .order('created_at', { ascending: false }),
    client.from('reactions').select('idea_id, user_id, emoji').eq('group_id', id),
    client.from('comments').select('id, idea_id, user_id, body, created_at').eq('group_id', id),
    client.from('completions').select('points').eq('group_id', id),
  ]);
  fail(g.error ?? m.error ?? l.error ?? i.error ?? r.error);
  if (!g.data) return null;
  const members = toMembers(m.data as unknown as MemberRow[]);
  return {
    id: g.data.id,
    name: g.data.name,
    cover: g.data.cover,
    invite_code: g.data.invite_code,
    owner: ownerOf(g.data.created_by as string | null | undefined, members),
    members,
    lists: (l.data ?? []) as List[],
    ideas: (i.data ?? []) as Idea[],
    reactions: (r.data ?? []) as Reaction[],
    // A failure here (comments not set up in the database yet) must not hide the whole group.
    commentCounts: c.error ? {} : countByIdea(c.data as { idea_id: string }[] | null),
    latestComments: c.error ? {} : latestByIdea(c.data as Comment[] | null),
    // The same goes for points: without them the group still shows, just with no bar.
    points: p.error ? null : ((p.data ?? []) as { points: number }[]).reduce((sum, row) => sum + row.points, 0),
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

/**
 * A group's owner: the person who started it, or, once they have gone, whoever has been in it
 * longest. `members` must be in the order they joined. The database decides the same way
 * (supabase/updates/007-group-settings.sql) and has the final say.
 */
export function ownerOf(startedBy: string | null | undefined, members: Member[]): string | null {
  if (startedBy && members.some((m) => m.user_id === startedBy)) return startedBy;
  return members[0]?.user_id ?? null;
}

/** Rename a group or change its cover. Any member can. */
export async function updateGroup(groupId: string, change: { name: string; cover: string }): Promise<void> {
  const { error } = await db().from('groups').update({ name: change.name, cover: change.cover }).eq('id', groupId);
  fail(error);
}

/** A group's lists in their usual order, with whatever icon and colour each has. */
export async function fetchLists(groupId: string): Promise<List[]> {
  const { data, error } = await db().from('lists').select('*').eq('group_id', groupId).order('position');
  fail(error);
  return (data ?? []) as List[];
}

export async function renameList(listId: string, name: string): Promise<void> {
  const { error } = await db().from('lists').update({ name }).eq('id', listId);
  fail(error);
}

/**
 * Remove a list that has nothing on it. A list with ideas, including ones already done, is
 * refused: removing it would take those ideas with it.
 */
export async function removeList(listId: string): Promise<void> {
  const client = db();
  const { data, error } = await client.from('ideas').select('id').eq('list_id', listId).limit(1);
  fail(error);
  if ((data ?? []).length > 0) throw new Error('That list still has ideas on it, or ideas you have done. Move or remove them first.');
  const res = await client.from('lists').delete().eq('id', listId);
  fail(res.error);
}

/** Group settings that go through the database's own functions (update 007). */
async function settingsCall<T>(name: string, args: Record<string, string>): Promise<T> {
  const { data, error } = await db().rpc(name, args);
  // PGRST202 is the database saying it has no such function: update 007 has not been run.
  if (error && (error as { code?: string }).code === 'PGRST202') throw new Error('This is not available yet. Try again later.');
  fail(error);
  return data as T;
}

/**
 * Whether this person has muted the group's notifications. Null when muting is not set up in
 * the database yet (update 010), so the screen can leave the switch out.
 */
export async function fetchMuted(groupId: string, userId: string): Promise<boolean | null> {
  const { data, error } = await db().from('group_members').select('muted').eq('group_id', groupId).eq('user_id', userId).maybeSingle();
  if (error || !data) return null;
  return typeof (data as { muted?: unknown }).muted === 'boolean' ? (data as { muted: boolean }).muted : null;
}

/** Mute or unmute a group for this person only. A muted group sends them no notifications. */
export async function setGroupMuted(groupId: string, muted: boolean): Promise<void> {
  const { error } = await db().rpc('set_group_muted', { p_group: groupId, p_muted: muted });
  fail(error);
}

/** Leave a group. A group whose last member leaves is deleted. */
export async function leaveGroup(groupId: string): Promise<void> {
  await settingsCall('leave_group', { p_group: groupId });
}

/** Take someone out of a group. Only its owner can. */
export async function removeMember(groupId: string, userId: string): Promise<void> {
  await settingsCall('remove_member', { p_group: groupId, p_user: userId });
}

/** Replace a group's invite link, so the old one stops working. Only its owner can. Returns the new code. */
export async function resetInviteCode(groupId: string): Promise<string> {
  return settingsCall<string>('reset_invite_code', { p_group: groupId });
}

/** The database saying it has no such column: the update that adds it has not been run. */
const noSuchColumn = (error: unknown) => ['PGRST204', '42703'].includes((error as { code?: string } | null)?.code ?? '');

/** What someone chose for a list's icon and colour. Null leaves the choice to the app. */
export type ListLookChoice = { icon: string | null; color: string | null };

export async function addList(groupId: string, name: string, position: number, look?: ListLookChoice, options?: ListOptions): Promise<void> {
  const row = { group_id: groupId, name, position };
  const chosen = look && (look.icon || look.color) ? { icon: look.icon, color: look.color } : null;
  // Only said when something is turned off: a list starts with everything on anyway.
  const asked = options && !sameOptions(options, ALL_ON) ? options : null;
  // Before update 012 a list cannot keep an icon or colour, and before 015 it cannot keep what
  // it asks for. The list itself still gets made, with as much as the database can hold.
  const tries = [{ ...row, ...chosen, ...asked }, ...(asked ? [{ ...row, ...chosen }] : []), ...(chosen ? [row] : [])];
  for (const [i, attempt] of tries.entries()) {
    const { error } = await db().from('lists').insert(attempt);
    if (noSuchColumn(error) && i < tries.length - 1) continue;
    fail(error);
    return;
  }
}

/** Change what a list asks for (update 015). */
export async function setListOptions(listId: string, options: ListOptions): Promise<void> {
  const { error } = await db().from('lists').update({ dates: options.dates, links: options.links, notes: options.notes }).eq('id', listId);
  if (noSuchColumn(error)) throw new Error('This is not available yet. Try again later.');
  fail(error);
}

/** Change a list's icon and colour (update 012). Null hands the choice back to the app. */
export async function setListLook(listId: string, look: ListLookChoice): Promise<void> {
  const { error } = await db().from('lists').update({ icon: look.icon, color: look.color }).eq('id', listId);
  if (noSuchColumn(error)) throw new Error('This is not available yet. Try again later.');
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
  tags?: IdeaTags;
}): Promise<string> {
  const client = db();
  const row = {
    group_id: input.groupId,
    list_id: input.listId,
    title: input.title,
    link: input.link || null,
    note: input.note || null,
    added_by: input.userId,
  };
  const tags = input.tags && (input.tags.takes || input.tags.setting) ? input.tags : null;
  let { data, error } = await client.from('ideas').insert(tags ? { ...row, ...tags } : row).select('id').single();
  // Before update 014 an idea cannot keep tags. The idea itself still gets added.
  if (tags && noSuchColumn(error)) ({ data, error } = await client.from('ideas').insert(row).select('id').single());
  fail(error);
  if (input.thumbsUp && data) {
    const res = await client
      .from('reactions')
      .insert({ idea_id: data.id, group_id: input.groupId, user_id: input.userId, emoji: '👍' });
    fail(res.error);
  }
  return (data as { id: string }).id;
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
    // If the reaction is already there (a double tap, or added from another device), leave it be.
    // Asking the database to overwrite it instead would be refused: reactions cannot be edited.
    .upsert({ idea_id: ideaId, group_id: groupId, user_id: userId, emoji }, { onConflict: 'idea_id,user_id,emoji', ignoreDuplicates: true });
  fail(error);
}

/** Change an idea's words or move it to another list. Its reactions, comments and date stay. */
export async function updateIdea(
  ideaId: string,
  change: { title: string; link: string | null; note: string | null; listId: string; tags?: IdeaTags },
): Promise<void> {
  const row = { title: change.title, link: change.link || null, note: change.note || null, list_id: change.listId };
  let { error } = await db().from('ideas').update(change.tags ? { ...row, ...change.tags } : row).eq('id', ideaId);
  // Before update 014 an idea cannot keep tags. The rest of the change is still saved.
  if (change.tags && noSuchColumn(error)) ({ error } = await db().from('ideas').update(row).eq('id', ideaId));
  fail(error);
}

/** One idea as the share screen needs it: with its group, and when it was done if it has been. */
export type SharedIdea = Idea & { group_id: string; done_at: string | null };

/** One idea by its id, done or not. Null when it is gone, or is not in one of this person's groups. */
export async function fetchIdea(ideaId: string): Promise<SharedIdea | null> {
  const { data, error } = await db().from('ideas').select('*').eq('id', ideaId).maybeSingle();
  fail(error);
  return (data as SharedIdea | null) ?? null;
}

/** Remove an idea for everyone in the group, along with its reactions and comments. */
export async function deleteIdea(ideaId: string): Promise<void> {
  const { error } = await db().from('ideas').delete().eq('id', ideaId);
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

/**
 * The idea that has just become "everyone's in": one that is now, and was still waiting on
 * someone at the last look (`waiting` holds the ids of the ideas that were). Null when there is
 * none, or when this is the first look and there is nothing to compare with. An idea not seen
 * at the last look is never the answer, even if everyone is in on it.
 */
export function newlyAllIn(group: Pick<GroupData, 'ideas' | 'members' | 'reactions'>, waiting: ReadonlySet<string> | null): Idea | null {
  if (!waiting) return null;
  return group.ideas.find((i) => waiting.has(i.id) && everyoneIn(i.id, group.members, group.reactions)) ?? null;
}

// A screen that changes a group marks it here, so the group page knows to tell the other members.
const dirty = new Set<string>();
export function markChanged(groupId: string): void {
  dirty.add(groupId);
}
export function takeChanged(groupId: string): boolean {
  return dirty.delete(groupId);
}

// For a change that lands a moment after its screen has closed (a preview picture being found):
// the group page listens here while it is open, and shows the change at once instead of waiting
// for its next routine reload.
const watchers = new Map<string, Set<() => void>>();
export function onLateChange(groupId: string, listener: () => void): () => void {
  const set = watchers.get(groupId) ?? new Set();
  watchers.set(groupId, set);
  set.add(listener);
  return () => {
    set.delete(listener);
    if (set.size === 0) watchers.delete(groupId);
  };
}
export function lateChange(groupId: string): void {
  const set = watchers.get(groupId);
  // Nobody is looking at the group right now: leave a mark for when its page next opens.
  if (!set || set.size === 0) dirty.add(groupId);
  else for (const listener of [...set]) listener();
}
