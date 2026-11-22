// Clearing out the pictures a group keeps on its ideas, before the group itself is deleted.
//
// A group is deleted when its last member leaves or deletes their account. The database removes
// the group and everything in it, but it cannot remove a stored file. So the files go first,
// while this person is still a member and so still allowed to remove them
// (supabase/updates/017-idea-pictures.sql). The cover photo is removed the same way, by
// `removeCover` in src/lib/picture-files.ts.

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
