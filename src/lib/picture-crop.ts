// Choosing which part of a photo an idea shows.
//
// An idea's picture is shown as a strip twice as wide as it is tall, across the top of its card.
// A photo taken on a phone is nothing like that shape, so most of it cannot show. Before a photo
// is kept, the person sees it behind a frame of that shape, moves it about and makes it bigger
// until the frame holds what they want, and only that part is kept (src/lib/picture-files.ts).
//
// This file is the sums for that, with nothing in it that needs a phone or a screen:
// where the photo sits behind the frame, and which part of it the frame is showing.

import { PICTURE_SIDE } from './pictures';

/** How much wider than tall an idea's picture is, wherever it shows: on its card, and on the forms. */
export const PICTURE_SHAPE = 2;

/** The most a photo can be made bigger behind the frame. */
export const MOST_ZOOM = 4;

export type Size = { width: number; height: number };

/**
 * Where a photo sits behind the frame. `zoom` is 1 when the photo just covers the frame, and
 * `x` and `y` are how far its top left corner is from the frame's, in the frame's own dots: zero
 * or less, since the photo always covers the whole frame.
 */
export type CropView = { zoom: number; x: number; y: number };

/** The part of a photo to keep, in the photo's own dots. */
export type CropRect = { originX: number; originY: number; width: number; height: number };

const within = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

/** How many frame dots one dot of the photo takes at zoom 1, when the photo just covers the frame. */
export function coverScale(photo: Size, frame: Size): number {
  return Math.max(frame.width / photo.width, frame.height / photo.height);
}

/** How big the photo is drawn behind the frame. */
export function shownSize(photo: Size, frame: Size, zoom: number): Size {
  const scale = coverScale(photo, frame) * zoom;
  return { width: photo.width * scale, height: photo.height * scale };
}

/** The same view, pulled back so the photo still covers the whole frame and is no bigger than allowed. */
export function clampView(photo: Size, frame: Size, view: CropView): CropView {
  const zoom = within(view.zoom, 1, MOST_ZOOM);
  const shown = shownSize(photo, frame, zoom);
  return { zoom, x: within(view.x, frame.width - shown.width, 0), y: within(view.y, frame.height - shown.height, 0) };
}

/** Where a photo starts: just covering the frame, with its middle in the middle. */
export function startView(photo: Size, frame: Size): CropView {
  const shown = shownSize(photo, frame, 1);
  return { zoom: 1, x: (frame.width - shown.width) / 2, y: (frame.height - shown.height) / 2 };
}

/** The view after the photo is dragged by so many frame dots. It stops at its own edges. */
export function moveView(photo: Size, frame: Size, view: CropView, dx: number, dy: number): CropView {
  return clampView(photo, frame, { zoom: view.zoom, x: view.x + dx, y: view.y + dy });
}

/**
 * The view after the photo is made bigger or smaller. Whatever is under `about` stays under it:
 * the middle of the frame for a button, or the spot between two fingers for a pinch.
 */
export function zoomView(photo: Size, frame: Size, view: CropView, zoom: number, about: { x: number; y: number } = { x: frame.width / 2, y: frame.height / 2 }): CropView {
  const next = within(zoom, 1, MOST_ZOOM);
  const grow = next / view.zoom;
  return clampView(photo, frame, { zoom: next, x: about.x - (about.x - view.x) * grow, y: about.y - (about.y - view.y) * grow });
}

/** The part of the photo the frame is showing, in whole dots of the photo, and never outside it. */
export function cropOf(photo: Size, frame: Size, view: CropView): CropRect {
  const held = clampView(photo, frame, view);
  const scale = coverScale(photo, frame) * held.zoom;
  const width = within(Math.round(frame.width / scale), 1, Math.floor(photo.width));
  const height = within(Math.round(frame.height / scale), 1, Math.floor(photo.height));
  return {
    originX: within(Math.round(-held.x / scale), 0, Math.floor(photo.width) - width),
    originY: within(Math.round(-held.y / scale), 0, Math.floor(photo.height) - height),
    width,
    height,
  };
}

/**
 * The size to keep a cut-out part at: no wider than the app keeps any picture. Null when it is
 * already small enough, since a small picture is never made bigger.
 */
export function keptSize(part: Size, most: number = PICTURE_SIDE): Size | null {
  if (!(part.width > most)) return null;
  return { width: most, height: Math.max(1, Math.round((part.height * most) / part.width)) };
}
