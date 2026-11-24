// Clearing out the pictures a group keeps on its ideas, before the group itself is deleted, and
// deleting a group outright.
//
// A group is deleted when its last member leaves or deletes their account, or when its owner
// deletes it (supabase/updates/025-delete-group.sql). The database removes the group and
// everything in it, but it cannot remove a stored file. So the files go first, while this person
// is still a member and so still allowed to remove them (supabase/updates/017-idea-pictures.sql).
// The cover photo is removed the same way.

import { COVER_BUCKET } from './cover-photos';
import { coverPath } from './covers';
import { ownPicture, PICTURE_BUCKET } from './pictures';
import { db } from './supabase';

// How many files are listed and removed at a time, and the most rounds of that. Together, far
// more pictures than a group has, and an end to a loop that would otherwise never finish.
const BATCH = 100;
const MOST_ROUNDS = 100;

// A group's folder is named by its id, and nothing else is ever listed.
const GROUP_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Remove every picture file in a group's folder. Call it only when the group is about to be
 * deleted: the ideas are not touched, so in a group that lived on they would point at nothing.
 *
 * It goes by what is in the folder, not by what the ideas say, so a file that no idea points to
 * any more goes too. It never fails out loud: a file left behind wastes a little room and
 * nothing else, and is no reason to stop someone leaving.
 */
export async function removeGroupPictures(groupId: string): Promise<void> {
  if (!GROUP_ID.test(groupId)) return;
  try {
    const bucket = db().storage.from(PICTURE_BUCKET);
    for (let round = 0; round < MOST_ROUNDS; round += 1) {
      // Each batch is removed before the next is asked for, so the list always starts at the top.
      const { data, error } = await bucket.list(groupId, { limit: BATCH });
      if (error || !data) return;
      // Only files named the way the app names them. Anything else is not the app's to remove.
      const places = data.map((file) => ownPicture(`${groupId}/${file.name}`)).filter((place): place is string => place !== null);
      if (places.length === 0) return;
      const removed = await bucket.remove(places);
      // Nothing went: asking again would only list the same files.
      if (removed.error || !removed.data || removed.data.length === 0) return;
    }
  } catch {
    // Left behind.
  }
}

/**
 * Said when a group cannot be deleted because the database does not have update 025. It names the
 * update on purpose: only whoever looks after the database can put this right.
 */
export const NO_DELETE_GROUP = 'A group cannot be deleted yet. The database is missing update 025 (delete group).';

const some = (count: number, one: string, many: string) => (count === 1 ? `1 ${one}` : `${count} ${many}`);

/**
 * What deleting a group takes away, as a few plain lines, for the question that is asked first.
 * `contents` is what the group holds, as far as it has been counted: a number that is not known
 * yet is said without one. `me` is the person asking, who is not counted among the others.
 */
export function deleteOverview(
  group: { members: { user_id: string; name: string }[] },
  contents: Partial<GroupContents> | null,
  coverPhoto: boolean,
  me: string | null,
): string[] {
  const lines: string[] = [];
  const ideas = contents?.ideas;
  lines.push(ideas === undefined ? 'Every idea, with its votes, comments and plans' : ideas === 0 ? 'Its lists' : `${some(ideas, 'idea', 'ideas')}, with ${ideas === 1 ? 'its' : 'their'} votes, comments and plans`);
  const pictures = contents?.pictures;
  if (pictures === undefined) lines.push(coverPhoto ? 'Every picture your group added, and its cover photo' : 'Every picture your group added');
  else if (pictures > 0) lines.push(`${some(pictures, 'picture', 'pictures')} your group added${coverPhoto ? ', and its cover photo' : ''}`);
  else if (coverPhoto) lines.push('Its cover photo');
  const done = contents?.done;
  if (done === undefined) lines.push('The record of what you did together, with your points and stamps');
  else if (done > 0) lines.push(`The record of the ${some(done, 'thing', 'things')} you did together, with your points and stamps`);
  const others = group.members.filter((m) => m.user_id !== me);
  if (others.length > 0) {
    const names = others.length <= 3 ? others.map((m) => m.name).join(others.length === 2 ? ' and ' : ', ') : `${others.length} other people`;
    lines.push(`${names} ${others.length === 1 ? 'loses' : 'lose'} the group too`);
  }
  return lines;
}

/** What a group holds, as numbers, to say plainly what deleting it takes away. */
export type GroupContents = { ideas: number; done: number; pictures: number };

/** How much a group holds. A number that cannot be counted comes back as null, and is simply not said. */
export async function fetchGroupContents(groupId: string): Promise<{ [K in keyof GroupContents]: number | null }> {
  const ideas = () => db().from('ideas').select('id', { count: 'exact', head: true }).eq('group_id', groupId);
  const [open, done, pictures] = await Promise.all([ideas().is('done_at', null), ideas().not('done_at', 'is', null), ideas().not('picture', 'is', null)]);
  return { ideas: open.error ? null : (open.count ?? 0), done: done.error ? null : (done.count ?? 0), pictures: pictures.error ? null : (pictures.count ?? 0) };
}

/**
 * Delete a group, for everyone in it. Only its owner can, and the database is what says so.
 *
 * It is asked first, without deleting anything, whether this person may. Only then do the stored
 * files go (the pictures on the group's ideas and its cover photo), and last the group itself. In
 * that order, a refusal never leaves a group behind with its pictures gone.
 */
export async function deleteGroup(groupId: string): Promise<void> {
  if (!GROUP_ID.test(groupId)) throw new Error('That is not a group.');
  const ask = async (checkOnly: boolean) => {
    const { error } = await db().rpc('delete_group', { p_group: groupId, p_check_only: checkOnly });
    // PGRST202 is the database saying it has no such function: update 025 has not been run.
    if (error && (error as { code?: string }).code === 'PGRST202') throw new Error(NO_DELETE_GROUP);
    if (error) throw new Error(error.message);
  };
  await ask(true);
  await Promise.all([
    removeGroupPictures(groupId),
    // The cover photo, if the group has one of its own. Like the pictures, it never fails out loud.
    db()
      .storage.from(COVER_BUCKET)
      .remove([coverPath(groupId)])
      .then(
        () => {},
        () => {},
      ),
  ]);
  await ask(false);
}
