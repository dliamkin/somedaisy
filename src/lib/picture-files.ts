// Choosing a picture for an idea, making it small, and keeping it. The rules are in
// src/lib/pictures.ts. This file is the part that needs the phone: its photo chooser
// (expo-image-picker) and its picture tools (expo-image-manipulator).

import * as Crypto from 'expo-crypto';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { base64Size, bytesFromBase64, fitWithin, NO_PICTURES, ownPicture, PICTURE_BUCKET, PICTURE_MAX_BYTES, picturePath, TOO_BIG } from './pictures';
import { db } from './supabase';

/** A picture someone has chosen, already made small. `uri` is for showing it before it is kept. */
export type ChosenPicture = { uri: string; base64: string };

// First as a good-looking JPEG. If that is still too big for the place it is kept, once more, squeezed harder.
const TRIES = [0.72, 0.5];

/**
 * Let the person choose a photo, and make it small: no more than 1280 dots along its longer side,
 * as a JPEG. Null when they back out without choosing. Only photos are offered, and the phone's
 * own chooser is used, so the app never sees any photo but the one chosen.
 */
export async function choosePicture(): Promise<ChosenPicture | null> {
  const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
  const asset = picked.canceled ? null : picked.assets?.[0];
  if (!asset) return null;
  let image = null;
  // The chooser usually says how big the photo is. When it does not, the photo is opened to find out.
  let size = fitWithin(asset.width, asset.height);
  if (!(asset.width > 0 && asset.height > 0)) {
    image = await ImageManipulator.manipulate(asset.uri).renderAsync();
    size = fitWithin(image.width, image.height);
  }
  if (!image || size) {
    const work = ImageManipulator.manipulate(asset.uri);
    image = await (size ? work.resize(size) : work).renderAsync();
  }
  for (const compress of TRIES) {
    const saved = await image.saveAsync({ compress, format: SaveFormat.JPEG, base64: true });
    if (saved.base64 && base64Size(saved.base64) <= PICTURE_MAX_BYTES) return { uri: saved.uri, base64: saved.base64 };
  }
  throw new Error(TOO_BIG);
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
