// Choosing a picture, making it small, and keeping it: for a picture on an idea, and for a photo
// as a group's cover. The rules are in src/lib/pictures.ts and src/lib/cover-photos.ts. This file
// is the part that needs the phone: its photo chooser (expo-image-picker) and its picture tools
// (expo-image-manipulator).

import * as Crypto from 'expo-crypto';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { COVER_BUCKET, COVER_ENOUGH, COVER_MAX_BYTES, COVER_TRIES, COVER_WIDTH, NO_COVER_PHOTOS, PHOTO_NOT_SAVED } from './cover-photos';
import { coverPath } from './covers';
import { keptSize, type CropRect } from './picture-crop';
import { base64Size, bytesFromBase64, fitWithin, NO_PICTURES, ownPicture, PICTURE_BUCKET, PICTURE_MAX_BYTES, picturePath, TOO_BIG } from './pictures';
import { db } from './supabase';

/** A picture someone has chosen, already made small. `uri` is for showing it before it is kept. */
export type ChosenPicture = { uri: string; base64: string };

/** How a chosen picture is made small. */
type Shrink = {
  /** How strongly it is squeezed as a JPEG, one try after another, gentlest first. */
  tries: number[];
  /** A try no bigger than this is kept, without going on to the next. */
  enough: number;
  /** The last try has to be no bigger than this, or the picture is refused. */
  most: number;
};

// A picture on an idea: first as a good-looking JPEG. If that is still too big for the place it is kept, once more, squeezed harder.
const FOR_IDEA: Shrink = { tries: [0.72, 0.5], enough: PICTURE_MAX_BYTES, most: PICTURE_MAX_BYTES };

// A cover photo is kept smaller, since every member loads it on Home.
const FOR_COVER: Shrink = { tries: COVER_TRIES, enough: COVER_ENOUGH, most: COVER_MAX_BYTES };

/** A picture as the picture tools hold it once it is drawn. */
type Drawn = Awaited<ReturnType<ReturnType<typeof ImageManipulator.manipulate>['renderAsync']>>;

/** Save a drawn picture as a JPEG small enough to keep, squeezing harder if the first try is too big. */
async function squeeze(image: Drawn, how: Shrink): Promise<ChosenPicture> {
  for (const [i, compress] of how.tries.entries()) {
    // Saving it afresh as a JPEG also leaves out where and with what the photo was taken.
    const saved = await image.saveAsync({ compress, format: SaveFormat.JPEG, base64: true });
    const limit = i === how.tries.length - 1 ? how.most : how.enough;
    if (saved.base64 && base64Size(saved.base64) <= limit) return { uri: saved.uri, base64: saved.base64 };
  }
  throw new Error(TOO_BIG);
}

/**
 * A photo someone has chosen, for an idea or as a group's cover, before they have said which part
 * of it to show. `uri` is a working copy the right way up, and the sizes are that copy's.
 */
export type PickedPhoto = { uri: string; width: number; height: number };

/** The longest a working copy's longer side can be: enough to cut a sharp picture from, and light to move about. */
const WORKING_SIDE = 2400;

/**
 * Let the person choose a photo, for an idea or as a group's cover. Null when they back out
 * without choosing. Only photos are offered, and the phone's own chooser is used, so the app
 * never sees any photo but the one chosen.
 *
 * What comes back is a working copy, not the picture to keep: the person still chooses which part
 * of it shows (src/components/picture-crop.tsx), and `cropPicture` or `cropCover` then cuts that
 * part out. The copy is drawn afresh, so it is the right way up whichever way the phone was held,
 * and its size is the size the cut is measured in.
 */
export async function pickPhoto(): Promise<PickedPhoto | null> {
  const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
  const asset = picked.canceled ? null : picked.assets?.[0];
  if (!asset) return null;
  let image = await ImageManipulator.manipulate(asset.uri).renderAsync();
  const size = fitWithin(image.width, image.height, WORKING_SIDE);
  if (size) image = await ImageManipulator.manipulate(asset.uri).resize(size).renderAsync();
  const saved = await image.saveAsync({ compress: 0.92, format: SaveFormat.JPEG });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}

/**
 * Cut the chosen part out of a photo and make it small enough to keep: no more than 1280 dots
 * wide, as a JPEG. `part` is in the dots of the working copy `pickPhoto` gave. `most` is for a
 * part that is taller than it is wide, to keep its height within the same bound.
 */
export function cropPicture(photo: PickedPhoto, part: CropRect, most?: number): Promise<ChosenPicture> {
  return cutOut(photo, part, most, FOR_IDEA);
}

/**
 * The same, for a group's cover: no more than 1200 dots wide, as a JPEG of a few hundred
 * kilobytes at most.
 */
export function cropCover(photo: PickedPhoto, part: CropRect): Promise<ChosenPicture> {
  return cutOut(photo, part, COVER_WIDTH, FOR_COVER);
}

async function cutOut(photo: PickedPhoto, part: CropRect, most: number | undefined, how: Shrink): Promise<ChosenPicture> {
  const cut = ImageManipulator.manipulate(photo.uri).crop(part);
  const size = keptSize(part, most);
  const image = await (size ? cut.resize(size) : cut).renderAsync();
  return squeeze(image, how);
}

/**
 * Keep a chosen picture in the group's folder, under a new name nobody could guess. Gives back
 * where it was put, to save on the idea. A picture is never replaced in place.
 */
export async function uploadPicture(groupId: string, picture: ChosenPicture): Promise<string> {
  const bytes = bytesFromBase64(picture.base64);
  if (bytes.length === 0 || bytes.length > PICTURE_MAX_BYTES) throw new Error(TOO_BIG);
  const path = picturePath(groupId, Crypto.randomUUID());
  // Its name is never used again, so browsers and phones can keep their copy for a year.
  const { error } = await db().storage.from(PICTURE_BUCKET).upload(path, bytes.buffer as ArrayBuffer, { contentType: 'image/jpeg', cacheControl: '31536000' });
  if (error) throw new Error(/bucket not found/i.test(error.message) ? NO_PICTURES : `Could not keep the picture. ${error.message}`);
  return path;
}

/**
 * Remove a kept picture's file, once nothing shows it any more. It never fails out loud: a file
 * left behind wastes a little room and nothing else.
 */
export async function removePicture(path: unknown): Promise<void> {
  const place = ownPicture(path);
  if (!place) return;
  try {
    await db().storage.from(PICTURE_BUCKET).remove([place]);
  } catch {
    // Left behind.
  }
}

/**
 * Keep a chosen photo as the group's cover photo. A group has the one file, so a new photo takes
 * the place of the old one. The cover on the group's row is saved separately, with a new version,
 * which is what tells every phone that the photo has changed.
 */
export async function uploadCover(groupId: string, photo: ChosenPicture): Promise<void> {
  const bytes = bytesFromBase64(photo.base64);
  if (bytes.length === 0 || bytes.length > COVER_MAX_BYTES) throw new Error(TOO_BIG);
  const { error } = await db()
    .storage.from(COVER_BUCKET)
    // The name is used again for the next photo, so nothing is told to keep its copy for long.
    .upload(coverPath(groupId), bytes.buffer as ArrayBuffer, { contentType: 'image/jpeg', upsert: true, cacheControl: '3600' });
  if (error) throw new Error(/bucket not found/i.test(error.message) ? NO_COVER_PHOTOS : PHOTO_NOT_SAVED);
}

/**
 * Remove a group's cover photo, once the group no longer uses it or is about to be deleted. Like
 * `removePicture`, it never fails out loud.
 */
export async function removeCover(groupId: string): Promise<void> {
  try {
    await db().storage.from(COVER_BUCKET).remove([coverPath(groupId)]);
  } catch {
    // Left behind.
  }
}
