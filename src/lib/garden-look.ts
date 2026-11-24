// How a group's garden looks: the paint on its house, how its lawn is kept, the things it has
// earned for the yard, and the season. Everyone in the group sees the same garden, so the paint,
// the lawn and the switches are kept on the group (supabase/updates/023-garden-look.sql). The
// season is not kept anywhere: it follows the date.
//
// The house itself grows with the group's rank, which nobody chooses: a cottage to begin with,
// and a mansion for a group that has reached the sixth rank or beyond.
//
// This file is the rules, with nothing in it that draws. The colours, the lawn styles and the
// house's levels are the design handoffs' (design_handoff_garden_a_v3/README.md is the newest).

import { HOUSE_PAINTS, type LawnStyle, type Season } from '../garden/palette';
import { HOUSE_LEVELS } from '../garden/plan';
import { levelFor } from './points';

export type { LawnStyle, Season };

/** The seven things a group earns for its yard by finishing things together. */
export type Extra = 'bench' | 'bath' | 'lights' | 'picnic' | 'wood' | 'fire' | 'pond';

/** A group's choices for its garden. An extra's switch only matters once the group has earned it. */
export type GardenLook = { roof: string; walls: string; door: string; lawn: LawnStyle } & Record<Extra, boolean>;

/** The garden as it first was, which is what a group has until it chooses otherwise. */
export const DEFAULT_LOOK: GardenLook = {
  roof: HOUSE_PAINTS.roof[0],
  walls: HOUSE_PAINTS.walls[0],
  door: HOUSE_PAINTS.door[0],
  lawn: 'soft',
  bench: true,
  bath: true,
  lights: true,
  picnic: true,
  wood: true,
  fire: true,
  pond: true,
};

/** The lawns to choose from, in the order they are offered. */
export const LAWNS: { key: LawnStyle; name: string }[] = [
  { key: 'soft', name: 'Soft' },
  { key: 'mown', name: 'Mown' },
  { key: 'meadow', name: 'Meadow' },
];

/**
 * Said when a garden's look cannot be saved because the database does not have update 023. It
 * names the update on purpose: only whoever looks after the database can put this right.
 */
export const NO_GARDEN_LOOK = 'The garden cannot be changed yet. The database is missing update 023 (garden look).';

const oneOf = (value: unknown, choices: readonly string[]): string => {
  const found = typeof value === 'string' ? choices.find((c) => c.toLowerCase() === value.toLowerCase()) : undefined;
  return found ?? choices[0];
};

/**
 * A group's choices, read from what the database holds. Empty is the garden as it first was.
 * A colour that is not one of the ones on offer, or anything else not understood, falls back to
 * what a garden starts with, so the house is never painted a colour the app does not have.
 */
export function gardenLook(value: unknown): GardenLook {
  const look = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    roof: oneOf(look.roof, HOUSE_PAINTS.roof),
    walls: oneOf(look.walls, HOUSE_PAINTS.walls),
    door: oneOf(look.door, HOUSE_PAINTS.door),
    lawn: oneOf(look.lawn, LAWNS.map((l) => l.key)) as LawnStyle,
    bench: look.bench !== false,
    bath: look.bath !== false,
    lights: look.lights !== false,
    // A garden saved before these four existed has no word on them, which means switched on.
    picnic: look.picnic !== false,
    wood: look.wood !== false,
    fire: look.fire !== false,
    pond: look.pond !== false,
  };
}

/**
 * What a group earns, and how many things it has to have done to earn each. `name` is what the
 * switch is called and `full` is what the thing is called in a sentence.
 */
export const EXTRAS: { key: Extra; at: number; name: string; full: string }[] = [
  { key: 'bench', at: 5, name: 'Bench', full: 'Bench' },
  { key: 'bath', at: 10, name: 'Birdbath', full: 'Birdbath' },
  { key: 'lights', at: 20, name: 'Lights', full: 'String lights' },
  { key: 'picnic', at: 30, name: 'Picnic', full: 'Picnic blanket' },
  { key: 'wood', at: 40, name: 'Woodpile', full: 'Woodpile' },
  { key: 'fire', at: 60, name: 'Fire pit', full: 'Fire pit' },
  { key: 'pond', at: 80, name: 'Pond', full: 'Pond' },
];

/** Which extras stand in the yard: those the group has earned and has switched on. */
export function extrasOut(look: GardenLook, done: number): Record<Extra, boolean> {
  const out = { bench: false, bath: false, lights: false, picnic: false, wood: false, fire: false, pond: false };
  for (const extra of EXTRAS) out[extra.key] = done >= extra.at && look[extra.key];
  return out;
}

/** The extras earned by going from one number of things done to a higher one. */
export function newlyEarned(before: number, after: number): typeof EXTRAS {
  return EXTRAS.filter((extra) => before < extra.at && after >= extra.at);
}

/** Said when an extra is earned: "5 things done. Bench unlocked". */
export function earnedWords(done: number, extra: { full: string }): string {
  return `${done} things done. ${extra.full} unlocked`;
}

/** Said when an extra that is not earned yet is tapped: "Do 2 more things together to unlock the birdbath". */
export function lockedWords(done: number, extra: { at: number; full: string }): string {
  const left = Math.max(1, extra.at - done);
  return `Do ${left} more ${left === 1 ? 'thing' : 'things'} together to unlock the ${extra.full.toLowerCase()}`;
}

// Time zones in the southern half of the world that have seasons to speak of. Near the equator
// the months do not divide into the four seasons either way, so those are left with the north.
const SOUTH = [
  'Australia/',
  'Antarctica/',
  'Pacific/Auckland',
  'Pacific/Chatham',
  'Pacific/Fiji',
  'Pacific/Tongatapu',
  'Pacific/Noumea',
  'Pacific/Norfolk',
  'Pacific/Easter',
  'Africa/Johannesburg',
  'Africa/Maseru',
  'Africa/Mbabane',
  'Africa/Gaborone',
  'Africa/Windhoek',
  'Africa/Maputo',
  'Africa/Harare',
  'Africa/Lusaka',
  'Africa/Blantyre',
  'Indian/Mauritius',
  'Indian/Reunion',
  'Indian/Antananarivo',
  'America/Argentina/',
  'America/Buenos_Aires',
  'America/Cordoba',
  'America/Mendoza',
  'America/Santiago',
  'America/Punta_Arenas',
  'America/Montevideo',
  'America/Asuncion',
  'America/Sao_Paulo',
  'America/La_Paz',
  'Atlantic/Stanley',
];

/** Whether a time zone, such as "Australia/Sydney", is in the southern half of the world, where the seasons are the other way round. */
export function southern(timeZone: string): boolean {
  return SOUTH.some((zone) => (zone.endsWith('/') ? timeZone.startsWith(zone) : timeZone === zone));
}

/** The device's time zone, such as "Europe/London". Empty when the device will not say. */
export function deviceZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    return '';
  }
}

const NORTH_SEASONS: Season[] = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter'];

/**
 * The season in the garden: December to February is winter in the north, and so on round the
 * year, with the seasons the other way round for a device in the southern half of the world.
 * The device's time zone is the only thing that is asked. Nothing about where anyone is gets kept.
 */
export function seasonFor(now: Date, timeZone: string = deviceZone()): Season {
  return NORTH_SEASONS[(now.getMonth() + (southern(timeZone) ? 6 : 0)) % 12];
}

/**
 * What the house is at each level, and what reaching that level added to it. The first is the
 * cottage every group starts with.
 */
export const HOUSES: { name: string; adds: string }[] = [
  { name: 'Cottage', adds: 'a cottage' },
  { name: 'Cottage with a garage', adds: 'a garage' },
  { name: 'Two-story home', adds: 'a second story' },
  { name: 'Home with a lanai', adds: 'a lanai across the front' },
  { name: 'Home with a patio', adds: 'a patio with an umbrella' },
  { name: 'Mansion', adds: 'a room over the garage and a cupola with a pennant' },
];

/**
 * How far a group's house has grown, from 1 (the cottage) to 6 (the mansion). Each of the first
 * six ranks is one level: Homebodies have the cottage and Trailblazers the mansion, which
 * Daredevils and Legends keep. A group whose points are not known has the cottage.
 */
export function houseLevel(points: number | null): number {
  if (points === null) return 1;
  return Math.min(HOUSE_LEVELS, levelFor(points).index + 1);
}

/**
 * What "Our garden" says about the house: its name, then where it stands and what comes next.
 * "Cottage" and " · rank level 1 of 6. The next rank adds a garage."
 */
export function houseWords(level: number): { name: string; rest: string } {
  const at = Math.max(1, Math.min(HOUSE_LEVELS, Math.round(level)));
  const next = HOUSES[at];
  return { name: HOUSES[at - 1].name, rest: ` · rank level ${at} of ${HOUSE_LEVELS}. ${next ? `The next rank adds ${next.adds}.` : 'As grand as it gets.'}` };
}

/** Said when the house grows while the garden is open: "Level up! The house grew: a garage". Null when it has not grown. */
export function houseGrew(before: number, after: number): string | null {
  return after > before && HOUSES[after - 1] ? `Level up! The house grew: ${HOUSES[after - 1].adds}` : null;
}

/** What each paint colour is called, for a screen reader. */
export const PAINT_NAMES: Record<string, string> = {
  '#8A4BE6': 'violet',
  '#6D2FC4': 'grape',
  '#B8339A': 'pink',
  '#E0489E': 'bright pink',
  '#D9434E': 'red',
  '#B8402E': 'brick red',
  '#A8322C': 'barn red',
  '#E2703A': 'orange',
  '#C98A2B': 'ochre',
  '#E8B923': 'gold',
  '#F2D56B': 'straw yellow',
  '#8FA83A': 'olive green',
  '#3E9A4E': 'leaf green',
  '#1FA98A': 'teal',
  '#17806A': 'pine green',
  '#2A9DB8': 'sea blue',
  '#2F7BE8': 'blue',
  '#3B5BC9': 'cobalt blue',
  '#2C3E7A': 'navy',
  '#5A6B8C': 'slate blue',
  '#6E7FA8': 'dusty blue',
  '#7A7F8E': 'grey',
  '#4A4458': 'charcoal',
  '#2C2040': 'midnight',
  '#5B3E2B': 'dark brown',
  '#8A6244': 'brown',
  '#B98B63': 'tan',
  '#C7B8D9': 'pale lilac',
  '#FFFFFF': 'white',
  '#FFF7E8': 'cream',
  '#FBEFD5': 'vanilla',
  '#FFE9B8': 'butter yellow',
  '#FFD9C7': 'peach',
  '#FFC9B0': 'apricot',
  '#F7C9EA': 'rose',
  '#F4B8C8': 'blush pink',
  '#E6D2FF': 'lavender',
  '#CDB8F0': 'lilac',
  '#CFE3FF': 'sky blue',
  '#A9CBF5': 'powder blue',
  '#C9EEF0': 'ice blue',
  '#BFE8D6': 'mint',
  '#CFE5B8': 'pale green',
  '#A9C99A': 'sage',
  '#E9E4DC': 'linen',
  '#D8D2C8': 'stone',
  '#C9C4D4': 'pale grey',
  '#B8A48C': 'sand',
  '#E8B8A0': 'clay pink',
  '#C9705A': 'terracotta',
};
