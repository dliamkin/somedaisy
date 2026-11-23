// How a group's garden looks: the paint on its house, how its lawn is kept, the things it has
// earned for the yard, and the season. Everyone in the group sees the same garden, so the paint,
// the lawn and the switches are kept on the group (supabase/updates/023-garden-look.sql). The
// season is not kept anywhere: it follows the date.
//
// This file is the rules, with nothing in it that draws. The colours and the lawn styles are the
// design handoff's (design_handoff_garden_a_v2/README.md).

import { HOUSE_PAINTS, type LawnStyle, type Season } from '../garden/palette';

export type { LawnStyle, Season };

/** The three things a group earns for its yard by finishing things together. */
export type Extra = 'bench' | 'bath' | 'lights';

/** A group's choices for its garden. An extra's switch only matters once the group has earned it. */
export type GardenLook = { roof: string; walls: string; door: string; lawn: LawnStyle } & Record<Extra, boolean>;

/** The garden as it first was, which is what a group has until it chooses otherwise. */
export const DEFAULT_LOOK: GardenLook = { roof: HOUSE_PAINTS.roof[0], walls: HOUSE_PAINTS.walls[0], door: HOUSE_PAINTS.door[0], lawn: 'soft', bench: true, bath: true, lights: true };

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
];

/** Which extras stand in the yard: those the group has earned and has switched on. */
export function extrasOut(look: GardenLook, done: number): Record<Extra, boolean> {
  const out = { bench: false, bath: false, lights: false };
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

/** What each paint colour is called, for a screen reader. */
export const PAINT_NAMES: Record<string, string> = {
  '#8A4BE6': 'violet',
  '#B8339A': 'pink',
  '#2F7BE8': 'blue',
  '#1FA98A': 'teal',
  '#E8B923': 'gold',
  '#FFFFFF': 'white',
  '#FFD9C7': 'peach',
  '#CFE3FF': 'sky blue',
  '#F7C9EA': 'rose',
  '#6D2FC4': 'grape',
  '#17806A': 'green',
};
