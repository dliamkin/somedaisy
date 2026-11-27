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

/**
 * A band across the frame, in the frame's own dots. Given to the sums below as `hold`, it is the
 * part of the frame the photo has to stay behind from top to bottom, in place of the whole frame:
 * the photo can then be slid up or down until its own edge reaches the band's.
 */
export type Band = { top: number; height: number };

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

/**
 * The same view, pulled back so the photo still covers the whole frame and is no bigger than
 * allowed. With `hold`, the photo only has to cover that band from top to bottom, so it can leave
 * some of the frame above or below the band empty.
 */
export function clampView(photo: Size, frame: Size, view: CropView, hold?: Band | null): CropView {
  const zoom = within(view.zoom, 1, MOST_ZOOM);
  const shown = shownSize(photo, frame, zoom);
  const top = hold ? hold.top : 0;
  const bottom = hold ? hold.top + hold.height : frame.height;
  return { zoom, x: within(view.x, frame.width - shown.width, 0), y: within(view.y, bottom - shown.height, top) };
}

/** Where a photo starts: just covering the frame, with its middle in the middle. */
export function startView(photo: Size, frame: Size): CropView {
  const shown = shownSize(photo, frame, 1);
  return { zoom: 1, x: (frame.width - shown.width) / 2, y: (frame.height - shown.height) / 2 };
}

/** The view after the photo is dragged by so many frame dots. It stops at its own edges. */
export function moveView(photo: Size, frame: Size, view: CropView, dx: number, dy: number, hold?: Band | null): CropView {
  return clampView(photo, frame, { zoom: view.zoom, x: view.x + dx, y: view.y + dy }, hold);
}

/**
 * The view after the photo is made bigger or smaller. Whatever is under `about` stays under it:
 * the middle of the frame for a button, or the spot between two fingers for a pinch.
 */
export function zoomView(
  photo: Size,
  frame: Size,
  view: CropView,
  zoom: number,
  about: { x: number; y: number } = { x: frame.width / 2, y: frame.height / 2 },
  hold?: Band | null,
): CropView {
  const next = within(zoom, 1, MOST_ZOOM);
  const grow = next / view.zoom;
  return clampView(photo, frame, { zoom: next, x: about.x - (about.x - view.x) * grow, y: about.y - (about.y - view.y) * grow }, hold);
}

// The part of the frame the photo is behind, top to bottom: all of it, unless the photo was slid past one of the frame's edges.
function filled(photo: Size, frame: Size, held: CropView): { top: number; bottom: number } {
  const shown = shownSize(photo, frame, held.zoom);
  return { top: Math.max(0, held.y), bottom: Math.min(frame.height, held.y + shown.height) };
}

/**
 * The part of the photo the frame is showing, in whole dots of the photo, and never outside it.
 * Where the photo was slid past an edge of the frame (see `hold`), the part stops at the photo's
 * own edge, so it is less tall than the frame is.
 */
export function cropOf(photo: Size, frame: Size, view: CropView, hold?: Band | null): CropRect {
  const held = clampView(photo, frame, view, hold);
  const scale = coverScale(photo, frame) * held.zoom;
  const { top, bottom } = filled(photo, frame, held);
  const width = within(Math.round(frame.width / scale), 1, Math.floor(photo.width));
  const height = within(Math.round((bottom - top) / scale), 1, Math.floor(photo.height));
  return {
    originX: within(Math.round(-held.x / scale), 0, Math.floor(photo.width) - width),
    originY: within(Math.round((top - held.y) / scale), 0, Math.floor(photo.height) - height),
    width,
    height,
  };
}

/**
 * How far down the kept part a band of the frame sits: 0 when the band is the top of it, 0.5 the
 * middle, 1 the bottom. It is the middle unless the photo was slid past an edge of the frame.
 *
 * This is what a strip showing the kept part has to be told, to show the band and not the middle
 * (see `down` on a cover's photo). It is measured the way pictures are placed: as a share of the
 * height the strip leaves out.
 */
export function bandPlace(photo: Size, frame: Size, view: CropView, band: Band): number {
  const held = clampView(photo, frame, view, band);
  const { top, bottom } = filled(photo, frame, held);
  const spare = bottom - top - band.height;
  if (!(spare > 0.5)) return 0.5;
  return Math.round(within((band.top - top) / spare, 0, 1) * 1000) / 1000;
}

/**
 * The size to keep a cut-out part at: no wider than the app keeps any picture. Null when it is
 * already small enough, since a small picture is never made bigger.
 */
export function keptSize(part: Size, most: number = PICTURE_SIDE): Size | null {
  if (!(part.width > most)) return null;
  return { width: most, height: Math.max(1, Math.round((part.height * most) / part.width)) };
}

/**
 * The band across the middle of the frame that a wider strip shows, when the kept part is also
 * shown somewhere `shape` times as wide as it is tall and filled from its middle. A group's cover
 * is: its page shows nearly all of the photo, and its card on Home a strip across the middle. In
 * the frame's own dots. Null when the strip is no wider a shape than the frame, since it then
 * shows all of the frame's height.
 */
export function middleBand(frame: Size, shape: number): Band | null {
  if (!(shape > 0) || !(frame.width > 0) || !(frame.height > 0)) return null;
  const height = frame.width / shape;
  if (!(height < frame.height)) return null;
  return { top: (frame.height - height) / 2, height };
}
