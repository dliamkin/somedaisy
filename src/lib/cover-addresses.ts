// Where a cover's photo is loaded from.
//
// A photo found by search has a web address of its own. An uploaded photo is kept privately, so
// the app asks storage, as the signed-in member, for an address that works for a day. Addresses
// are asked for in one request however many groups there are, and held for the rest of the
// session so the same one is used again: that is what lets a photo be fetched once and kept.

import { useEffect, useState } from 'react';

import { ADDRESS_LASTS, COVER_BUCKET, fromPhotoKey, photoKey, uploadedPhoto, versioned } from './cover-photos';
import type { Cover } from './covers';
import { supabase } from './supabase';

/** What the cover component needs to show a photo: where it is, and what to keep it under on the device. */
export type CoverPhotoSource = { uri: string; key: string };

// The addresses in hand, by the photo's key, and when each stops being handed out. That is an hour
// before it stops working, so a photo that has started to load can finish.
const held = new Map<string, { uri: string; until: number }>();
const MARGIN = 60 * 60 * 1000;

function inHand(key: string, now = Date.now()): string | null {
  const got = held.get(key);
  return got && got.until > now ? got.uri : null;
}

/**
 * Ask storage for addresses for these photos, in one request. A photo that is not there, or that
 * this person may not see, simply gets none, and the cover shows its colour instead.
 */
async function ask(photos: { path: string; version: number }[]): Promise<void> {
  if (!supabase || photos.length === 0) return;
  const { data, error } = await supabase.storage.from(COVER_BUCKET).createSignedUrls(
    photos.map((photo) => photo.path),
    ADDRESS_LASTS,
  );
  if (error || !data) return;
  const until = Date.now() + ADDRESS_LASTS * 1000 - MARGIN;
  for (const item of data) {
    const photo = photos.find((wanted) => wanted.path === item.path);
    if (photo && item.signedUrl && !item.error) held.set(photoKey(photo), { uri: versioned(item.signedUrl, photo.version), until });
  }
}

/**
 * Where each of these covers' photos loads from. Gives a function to ask per cover, which answers
 * null for a cover with no photo and, for an uploaded one, until its address has arrived. The
 * cover shows its colour and pattern in the meantime.
 */
export function useCoverPhotos(covers: Cover[]): (cover: Cover) => CoverPhotoSource | null {
  // The photos that need an address, as one line of text, so asking again only happens when they change.
  const wanted = covers
    .map(uploadedPhoto)
    .filter((photo): photo is { path: string; version: number } => photo !== null)
    .map(photoKey)
    .join('|');
  // Counts the answers that have arrived, to draw again when one does.
  const [, setArrived] = useState(0);
  // Whether any of them has no address in hand, or one that has run out since it was asked for.
  const lacking = wanted.split('|').some((key) => key && !inHand(key));

  useEffect(() => {
    const missing = wanted
      .split('|')
      .filter((key) => key && !inHand(key))
      .map(fromPhotoKey)
      .filter((photo): photo is { path: string; version: number } => photo !== null);
    if (missing.length === 0) return;
    let alive = true;
    ask(missing).then(
      () => alive && setArrived((count) => count + 1),
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [wanted, lacking]);

  return (cover) => {
    if (cover.kind !== 'photo') return null;
    if (cover.photo.source === 'search') return { uri: cover.photo.url, key: cover.photo.url };
    const key = photoKey(cover.photo);
    const uri = inHand(key);
    return uri ? { uri, key } : null;
  };
}
