// A group's cover: what is drawn across the top of its card on Home, its own page and the cover
// picker. A cover is drawn, never an image file, except for a photo cover's photo.
//
// This file is the rules, with nothing in it that needs a phone or the database: what a cover is,
// the ready-made looks, how one is read from and written to a group's row, the colour of the name
// on it, and how big the name is. Drawing it is src/components/cover.tsx.
//
// The colours here are data, not theme tokens: a group picks them and they are the same in light
// and dark mode. See docs/REDESIGN-HOME-AND-GROUP-2.md, section 1.

import { covers as CLASSIC_COLORS, light } from './theme';

/** A photo on a cover: one the group uploaded (kept in storage), or one found by search (only its address is kept). */
export type CoverPhoto =
  | { source: 'upload'; path: string; version: number }
  | { source: 'search'; url: string; credit: string; creditUrl: string };

/**
 * A cover. Every kind keeps a `background` and whether the flower pattern is on: a photo cover
 * shows them while its photo loads, or if it will not load.
 */
export type Cover =
  | { kind: 'classic'; background: string; pattern: boolean }
  | { kind: 'look'; background: string; shape1: string; shape2: string; pattern: boolean }
  | { kind: 'photo'; background: string; pattern: boolean; photo: CoverPhoto };

/** The three colours of a look. */
export type Look = { background: string; shape1: string; shape2: string };

/** The four colours the app has always had, by the word a group's row keeps for them. */
export const CLASSIC: Record<string, string> = CLASSIC_COLORS;

/** The classic colour a group gets when its row names none the app knows. */
export const DEFAULT_CLASSIC = 'sky';

/** The eight ready-made looks, in the order they are offered. */
export const LOOKS: (Look & { name: string })[] = [
  { name: 'Mint', background: '#CDEFE0', shape1: '#CFE3FF', shape2: '#FFE08A' },
  { name: 'Peach', background: '#FFD9C7', shape1: '#F7C9EA', shape2: '#FFE08A' },
  { name: 'Lavender', background: '#E6D2FF', shape1: '#CFE3FF', shape2: '#F7C9EA' },
  { name: 'Sky', background: '#CFE3FF', shape1: '#CDEFE0', shape2: '#E6D2FF' },
  { name: 'Sunny', background: '#FFE08A', shape1: '#FFD9C7', shape2: '#CDEFE0' },
  { name: 'Grape', background: '#4B2A8C', shape1: '#6D2FC4', shape2: '#B8339A' },
  { name: 'Night', background: '#1F2A5C', shape1: '#2F9E78', shape2: '#6D2FC4' },
  { name: 'Berry', background: '#8E1F74', shape1: '#B8339A', shape2: '#FF9E7A' },
];

/**
 * The colours offered when a group picks its own three: twelve pale ones, then twelve deep ones.
 * People pick these, so like the looks they are the same in light and dark mode. Orange and brown
 * are left out, as everywhere in the app; peach and yellow are the app's own pastels.
 */
export const OWN_COLORS = [
  '#FFFFFF', '#F7C9EA', '#FFD9C7', '#FFE08A', '#E3F2A6', '#CDEFE0',
  '#BFEDEA', '#CFE3FF', '#D5D6FF', '#E6D2FF', '#F3D1F7', '#E7DBF3',
  '#2C2040', '#8E1F74', '#B8339A', '#D43D6B', '#5BAA3C', '#2F9E78',
  '#0F9BB5', '#2F7BE8', '#1F2A5C', '#4B2A8C', '#6D2FC4', '#8A4BE6',
];

/** Whether two colours are the same, whatever their capitals. */
export function sameColor(one: string, other: string): boolean {
  return one.toUpperCase() === other.toUpperCase();
}

/** The ready-made look these three colours are, or null when they were picked by hand. */
export function readyLook(look: Look): (Look & { name: string }) | null {
  return LOOKS.find((ready) => sameColor(ready.background, look.background) && sameColor(ready.shape1, look.shape1) && sameColor(ready.shape2, look.shape2)) ?? null;
}

/**
 * The three colours to start from when a group goes on to pick its own: the cover's, if it is a
 * look. For a plain colour, the shapes of the ready-made look on that background, or failing that
 * of the first look, so there is always something to change.
 */
export function threeOf(cover: Cover): Look {
  if (cover.kind === 'look') return { background: cover.background, shape1: cover.shape1, shape2: cover.shape2 };
  const like = LOOKS.find((ready) => sameColor(ready.background, cover.background)) ?? LOOKS[0];
  return { background: cover.background, shape1: like.shape1, shape2: like.shape2 };
}

/** The longest name a group can be given from now on. Longer names from before are left alone. */
export const NAME_MAX = 50;

/**
 * Said when a cover cannot be saved because the database does not have update 018. It names the
 * update on purpose: only whoever looks after the database can put this right.
 */
export const NO_COVERS = 'This cover cannot be saved yet. The database is missing update 018 (group covers).';

// ---------- Colours ----------

const HEX = /^#[0-9a-f]{6}$/i;

/** A colour the way covers keep them: "#RRGGBB", in capitals. Null for anything else. */
export function hexColor(value: unknown): string | null {
  return typeof value === 'string' && HEX.test(value) ? value.toUpperCase() : null;
}

function channels(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** How light a colour is, from 0 (black) to 1 (white), by the standard (WCAG) sum. */
export function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((value) => {
    const part = value / 255;
    return part <= 0.03928 ? part / 12.92 : ((part + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The contrast between two colours, from 1 (the same) to 21 (black on white), by the standard (WCAG) formula. */
export function contrast(one: string, other: string): number {
  const a = luminance(one);
  const b = luminance(other);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** The two colours a name on a cover can be: the app's dark ink, or white. */
export const NAME_DARK = light.ink;
export const NAME_LIGHT = light.white;

/**
 * The colour of words on a background: dark ink or white, whichever stands out more. It is worked
 * out, never chosen, so a name stays readable on any colour a group picks.
 */
export function textOn(background: string): string {
  return contrast(NAME_DARK, background) >= contrast(NAME_LIGHT, background) ? NAME_DARK : NAME_LIGHT;
}

/** The colour of the name, and of the line under it, on a cover. Always white on a photo, which is darkened behind them. */
export function nameColor(cover: Cover, photoShowing = cover.kind === 'photo'): string {
  return cover.kind === 'photo' && photoShowing ? NAME_LIGHT : textOn(cover.background);
}

/** Whether what sits on a cover (the name, the clock and battery over it) is drawn light, because the cover is dark. */
export function isDark(cover: Cover, photoShowing = cover.kind === 'photo'): boolean {
  return nameColor(cover, photoShowing) === NAME_LIGHT;
}

/** How strongly the flower pattern is drawn: softer on a dark cover, so it does not fight the name. */
export function patternStrength(cover: Cover): number {
  return isDark(cover, false) ? 0.25 : 0.5;
}

/** How strongly the round shape behind the name is drawn, normally. */
export const SHAPE_STRENGTH = 0.75;

/**
 * How strongly the shape behind the name is drawn on this cover. A shape the name would be hard
 * to read on (less than 3 to 1) is drawn fainter, which only happens with colours picked by hand.
 */
export function shapeStrength(look: Look): number {
  return contrast(textOn(look.background), look.shape2) < 3 ? 0.35 : SHAPE_STRENGTH;
}

// ---------- The name ----------

/**
 * How big the name is drawn, from how long it is. `base` is the size a short name gets in that
 * place: 26 on a Home card, 30 in the picker, 32 on the group's own page. A name is never drawn
 * on more than two lines; past that it is cut off, and the whole name is in the group's settings.
 */
export function nameSize(name: string, base: number): number {
  const letters = [...name.trim()].length;
  if (letters <= 14) return base;
  return Math.floor(base * (letters <= 24 ? 0.8 : 0.68));
}

// ---------- Reading a cover from a group's row, and writing one ----------

function photoFrom(value: unknown, groupId: string | undefined): CoverPhoto | null {
  const photo = value as { source?: unknown; path?: unknown; version?: unknown; url?: unknown; credit?: unknown; creditUrl?: unknown } | null;
  if (!photo || typeof photo !== 'object') return null;
  if (photo.source === 'upload') {
    const version = photo.version;
    if (typeof photo.path !== 'string' || typeof version !== 'number' || !Number.isInteger(version) || version < 1) return null;
    // An uploaded photo is always the one file in its own group's folder.
    if (groupId !== undefined && photo.path !== coverPath(groupId)) return null;
    return { source: 'upload', path: photo.path, version };
  }
  if (photo.source === 'search') {
    // Only a photo that is on the photo service's own servers, with a credit that leads back to it.
    if (!searchedPhotoAddress(photo.url) || !creditAddress(photo.creditUrl) || typeof photo.credit !== 'string' || !photo.credit.trim() || photo.credit.length > 120) return null;
    return { source: 'search', url: photo.url, credit: photo.credit, creditUrl: photo.creditUrl };
  }
  return null;
}

/** The site a secure web address is on, in small letters. Null for anything that is not a plain secure address. */
function secureSite(address: unknown): string | null {
  if (typeof address !== 'string' || address.length > 1000 || !/^https:\/\/\S+$/i.test(address)) return null;
  // Letters, digits, dots and dashes only, then the path: nothing that could hide another site's name.
  return /^https:\/\/([a-z0-9.-]+)(?=[/?#]|$)/i.exec(address)?.[1].toLowerCase() ?? null;
}

/**
 * Whether an address is a photo on Unsplash's own servers, which is where a cover found by search
 * is always loaded from. Nothing from anywhere else is shown as a searched cover.
 */
export function searchedPhotoAddress(address: unknown): address is string {
  return secureSite(address)?.endsWith('.unsplash.com') ?? false;
}

/** Whether an address is a page on Unsplash, which is where a searched photo's credit leads. */
export function creditAddress(address: unknown): address is string {
  const site = secureSite(address);
  return site === 'unsplash.com' || site === 'www.unsplash.com';
}

/** Where a group's uploaded cover photo is kept: one file, in the group's own folder. */
export function coverPath(groupId: string): string {
  return `${groupId}/cover.jpg`.toLowerCase();
}

/**
 * A group's cover, from its row. `cover` is the word for one of the four classic colours, which
 * every group has. `cover_style` is everything newer, and is empty until a group chooses
 * something a classic colour with the pattern on cannot say. Anything that cannot be read falls
 * back to the classic colour, so a group always has a cover.
 */
export function coverOf(group: { id?: string; cover?: string | null; cover_style?: unknown }): Cover {
  const classic: Cover = { kind: 'classic', background: CLASSIC[group.cover ?? ''] ?? CLASSIC[DEFAULT_CLASSIC], pattern: true };
  const style = group.cover_style as { kind?: unknown; background?: unknown; shape1?: unknown; shape2?: unknown; pattern?: unknown; photo?: unknown } | null | undefined;
  if (!style || typeof style !== 'object') return classic;
  const background = hexColor(style.background);
  if (!background || typeof style.pattern !== 'boolean') return classic;
  if (style.kind === 'classic') return { kind: 'classic', background, pattern: style.pattern };
  if (style.kind === 'look') {
    const shape1 = hexColor(style.shape1);
    const shape2 = hexColor(style.shape2);
    return shape1 && shape2 ? { kind: 'look', background, shape1, shape2, pattern: style.pattern } : classic;
  }
  if (style.kind === 'photo') {
    const photo = photoFrom(style.photo, group.id);
    // A photo that cannot be read leaves the colour it sits on.
    return photo ? { kind: 'photo', background, pattern: style.pattern, photo } : { kind: 'classic', background, pattern: style.pattern };
  }
  return classic;
}

/** The word a group's row keeps for a classic colour, or null if the colour is not one of the four. */
export function classicKey(background: string): string | null {
  const wanted = background.toUpperCase();
  return Object.keys(CLASSIC).find((key) => CLASSIC[key].toUpperCase() === wanted) ?? null;
}

/**
 * What to save on a group's row for a cover. A classic colour with the pattern on is saved the
 * way it always was, as its word alone, so older copies of the app show the same thing. Anything
 * else goes in `cover_style`, and the word is left as it is.
 */
export function coverChange(cover: Cover): { cover?: string; cover_style: Cover | null } {
  const tidy = tidyCover(cover);
  if (tidy.kind !== 'classic') return { cover_style: tidy };
  const key = classicKey(tidy.background);
  if (key && tidy.pattern) return { cover: key, cover_style: null };
  return key ? { cover: key, cover_style: tidy } : { cover_style: tidy };
}

/** A cover with only what its kind keeps, in one order, so the same cover is always written the same way. */
function tidyCover(cover: Cover): Cover {
  const background = cover.background.toUpperCase();
  if (cover.kind === 'look') return { kind: 'look', background, shape1: cover.shape1.toUpperCase(), shape2: cover.shape2.toUpperCase(), pattern: cover.pattern };
  if (cover.kind === 'photo') {
    const photo: CoverPhoto =
      cover.photo.source === 'upload'
        ? { source: 'upload', path: cover.photo.path, version: cover.photo.version }
        : { source: 'search', url: cover.photo.url, credit: cover.photo.credit, creditUrl: cover.photo.creditUrl };
    return { kind: 'photo', background, pattern: cover.pattern, photo };
  }
  return { kind: 'classic', background, pattern: cover.pattern };
}

/** Whether two covers are the same, for telling if the picker has anything to save. */
export function sameCover(one: Cover, other: Cover): boolean {
  return JSON.stringify(tidyCover(one)) === JSON.stringify(tidyCover(other));
}

// ---------- "Surprise me" ----------

/** A colour from its hue (0 to 360), and how strong and how light it is (0 to 100 each). */
export function fromHsl(hue: number, saturation: number, lightness: number): string {
  const h = (((hue % 360) + 360) % 360) / 360;
  const s = saturation / 100;
  const l = lightness / 100;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const part = (shift: number) => {
    let t = h + shift;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    const value = t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
    return Math.round(value * 255).toString(16).padStart(2, '0');
  };
  return `#${part(1 / 3)}${part(0)}${part(-1 / 3)}`.toUpperCase();
}

// The hues the app keeps out of its interface: orange, and brown when dark.
const NO_FROM = 15;
const NO_TO = 45;

/** A hue moved out of the orange and brown range, to whichever side is nearer. */
function clearOfOrange(hue: number): number {
  const h = ((hue % 360) + 360) % 360;
  if (h < NO_FROM || h > NO_TO) return h;
  return h < (NO_FROM + NO_TO) / 2 ? NO_FROM - 5 : NO_TO + 5;
}

/**
 * A new look that is different every time and never clashes. Not three random colours: one
 * random hue, and two more a set distance round the colour wheel from it. About one time in four
 * it is a dark look. `random` gives numbers from 0 up to 1, and is only passed in by the tests.
 */
export function surpriseLook(random: () => number = Math.random): Look {
  let hue = random() * 360;
  // A few tries, then a hue that is certainly allowed, so a stuck `random` cannot loop for ever.
  for (let tries = 0; hue >= NO_FROM && hue <= NO_TO && tries < 20; tries++) hue = random() * 360;
  hue = clearOfOrange(hue);
  const dark = random() < 0.25;
  const hue1 = clearOfOrange(hue + 140);
  const hue2 = clearOfOrange(hue - 80);
  return dark
    ? { background: fromHsl(hue, 55, 26), shape1: fromHsl(hue1, 60, 46), shape2: fromHsl(hue2, 60, 50) }
    : { background: fromHsl(hue, 72, 88), shape1: fromHsl(hue1, 78, 87), shape2: fromHsl(hue2, 82, 80) };
}
