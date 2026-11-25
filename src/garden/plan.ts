// The planting plan: what a flower is told about its idea, where flowers stand, and how a flower's
// shape follows how far its idea has come. No drawing here, only the plan, so it can be tested.
//
// The numbers come from the design handoff (design_handoff_garden_a/garden3d.js) and are final.

/**
 * How far an idea has come, which is what a flower's shape shows:
 * 1 is new (a closed bud), 2 is waiting on votes (a half-open cup), 3 is everyone's in (a full
 * bloom), 4 is planned (a full bloom with a date marker behind it).
 */
export type Stage = 1 | 2 | 3 | 4;

/** One person's answer on an idea: 0 has not voted, 1 is in, 2 said "Eh". */
export type Vote = 0 | 1 | 2;

/** Everything the garden is told about one idea. Plain values only: it crosses into a web view on phones. */
export type Flower = {
  id: string;
  /** The idea's whole name, for a screen reader. */
  title: string;
  /** A short name, for the tag that appears over the flower. */
  short: string;
  /** The colour of its petals: its list's colour. */
  color: string;
  stage: Stage;
  /** One answer for each leaf, in the order of the garden's leaves. */
  votes: Vote[];
  /** The day of the month written on its date marker, when it is planned. */
  day: string | null;
  /** True from "We did it!" until the flower has flown into the house. */
  fly?: boolean;
};

/** How many flowers the garden shows at once. The yard has twelve places either side of the path. */
export const BED = 12;

/** The most leaves a flower has. Each leaf is one member of the group. */
export const MAX_LEAVES = 6;

/** How many petals the daisy in the sky has: one for each rank a group can reach. */
export const SKY_PETALS = 8;

/** The twelve places in the yard, either side of the path, as [x, z]. */
export const SLOTS: [number, number][] = [
  [-1.15, 4.1],
  [1.15, 3.45],
  [-1.4, 2.75],
  [1.4, 2.1],
  [-1.0, 1.4],
  [1.75, 0.7],
  [-1.9, 0],
  [1.05, -0.7],
  [-1.15, -1.4],
  [2.0, -2.1],
  [-2.2, -2.8],
  [1.2, -3.3],
];

/** Three more places in the front row, so an idea that has just been added always comes up in view. In the order they are taken. */
export const FRONT: [number, [number, number]][] = [
  [13, [1.2, 4.3]],
  [12, [-0.6, 3.4]],
  [15, [0.5, 4.45]],
];

/** Where the flower in a numbered place stands. */
export function placeOf(slot: number): [number, number] {
  return FRONT.find(([n]) => n === slot)?.[1] ?? SLOTS[slot % SLOTS.length];
}

/**
 * The place a new flower takes, given the places already taken. One that has just been added
 * (`fresh`) takes a front place while there is one. Otherwise the first empty place in the yard.
 */
export function freePlace(taken: ReadonlySet<number>, fresh: boolean): number {
  if (fresh) for (const [n] of FRONT) if (!taken.has(n)) return n;
  let i = 0;
  while (taken.has(i)) i++;
  return i;
}

/** A flower's shape at each stage: how far its petals are folded shut, the size of its centre, how far its head tips toward the viewer, the size of its head, and how tall it stands. */
export const SHAPES: Record<Stage, { fold: number; center: number; tilt: number; head: number; stem: number }> = {
  1: { fold: 1.38, center: 0.25, tilt: 0.12, head: 0.8, stem: 0.78 },
  2: { fold: 0.8, center: 0.8, tilt: 0.5, head: 0.93, stem: 1.05 },
  3: { fold: 0.16, center: 1, tilt: 0.95, head: 1, stem: 1.36 },
  4: { fold: 0.16, center: 1, tilt: 0.95, head: 1, stem: 1.36 },
};

/** A number from 0 to 2 that is always the same for the same idea, so flowers at one stage are not all one height. */
export function variety(id: string): number {
  let sum = 0;
  for (const letter of id) sum = (sum + (letter.codePointAt(0) ?? 0)) % 3;
  return sum;
}

/** How tall a flower's stem is. */
export function stemHeight(flower: Pick<Flower, 'id' | 'stage'>): number {
  return SHAPES[flower.stage].stem + variety(flower.id) * 0.07;
}

/**
 * Where each leaf grows: on the lower or the upper half of the stem, how far up that half, and
 * which way round the stem it points. The first three are the design's. The next three fill the
 * gaps between them, for groups of four to six.
 */
export const LEAVES: { half: 'lower' | 'upper'; up: number; turn: number }[] = [
  { half: 'lower', up: 0.6, turn: 2.4 },
  { half: 'upper', up: 0.12, turn: -0.5 },
  { half: 'upper', up: 0.62, turn: 4.1 },
  { half: 'lower', up: 0.3, turn: 5.6 },
  { half: 'upper', up: 0.38, turn: 1.3 },
  { half: 'lower', up: 0.86, turn: 0.4 },
];

/** How big a leaf is for each answer: full for "I'm in", smaller for "Eh", a nub for no answer yet. */
export function leafSize(vote: Vote | undefined): number {
  return vote === 1 ? 1 : vote === 2 ? 0.6 : 0.24;
}

// ---------- Inside the house (design_handoff_garden_a_v2) ----------

/** How many frames hang on one wall of the hallway. */
export const WALL = 12;

/** A finished idea as the hallway is told it, for the frame it hangs in. Plain values only. */
export type Memory = {
  /** The idea's whole name. */
  title: string;
  /** A short name, written under the pressed flower in the bigger frames. */
  short: string;
  /** The colour of its pressed flower: its list's colour. */
  color: string;
  /**
   * The web address of the picture that fills the frame in place of the flower: the one the idea's
   * card showed. The flower hangs until it has loaded, and stays if it cannot be.
   */
  picture: string | null;
};

/**
 * The twelve places on a wall, as [x, y, width, height, round, frame colour, how thick the frame
 * is]. They fill in this order, from the middle outward, so a wall looks arranged however many
 * frames it has. A round one that is taller than wide is an oval.
 */
export const FRAMES: readonly (readonly [number, number, number, number, 0 | 1, string, number])[] = [
  [0, 2.1, 0.56, 0.7, 0, '#E8B923', 0.05],
  [0.58, 1.9, 0.42, 0.56, 0, '#8A4BE6', 0.032],
  [-0.57, 1.86, 0.4, 0.4, 0, '#FFFFFF', 0.042],
  [0, 1.47, 0.56, 0.4, 0, '#2C2040', 0.028],
  [-0.57, 2.42, 0.4, 0.5, 0, '#FFD9C7', 0.05],
  [0.57, 2.48, 0.38, 0.38, 0, '#1FA98A', 0.032],
  [0, 2.76, 0.38, 0.38, 1, '#E8B923', 0.032],
  [0.56, 1.37, 0.42, 0.32, 0, '#F7C9EA', 0.04],
  [-0.56, 1.36, 0.34, 0.44, 1, '#8A4BE6', 0.032],
  [0, 0.99, 0.36, 0.36, 0, '#FFFFFF', 0.036],
  [-0.52, 0.87, 0.3, 0.3, 0, '#E8B923', 0.03],
  [0.53, 0.9, 0.3, 0.3, 1, '#2C2040', 0.03],
];

/** A wall with only a few frames hangs them a little larger, so it does not look bare. */
export function frameScale(count: number): number {
  return count <= 3 ? 1.22 : count <= 6 ? 1.12 : 1;
}

/** Where the bench and the birdbath stand, as [x, z]. Wildflowers keep clear of both. */
export const BENCH_AT: [number, number] = [2.45, -0.75];
export const BATH_AT: [number, number] = [-2.5, -1.5];

// ---------- Added with the third design handoff (design_handoff_garden_a_v3) ----------

/** The four bigger things a group earns for its lawn. */
export type LawnExtra = 'picnic' | 'wood' | 'fire' | 'pond';

/** In the order the graphics card is told about them. */
export const LAWN_EXTRAS: readonly LawnExtra[] = ['picnic', 'wood', 'fire', 'pond'];

/**
 * Where each stands, as [x, z], which way it is turned, and `flat`: the square of how far round it
 * the grass lies flat. The spots are clear of every flower's place, the path, the bench and the
 * birdbath, and wildflowers keep clear of them.
 */
export const LAWN_SPOTS: Record<LawnExtra, { at: [number, number]; flat: number; turn: number }> = {
  picnic: { at: [-2.45, 1], flat: 0.5, turn: 0.35 },
  wood: { at: [2.55, 1.5], flat: 0.3, turn: -0.3 },
  fire: { at: [-2.1, 3.25], flat: 0.25, turn: 0 },
  pond: { at: [2.15, 3.3], flat: 0.36, turn: 0.4 },
};

// ---------- The things that answer a tap (toys.ts and hallway.ts) ----------

/** How long after one footprint the next one lands on the stone ahead, in seconds. The footsteps are heard at the same pace. */
export const STEP_EVERY = 0.26;
/** How long a footprint stays before it starts to fade, and how long the fading takes, in seconds. */
const PRINT_STAYS = 1.5;
const PRINT_FADES = 0.8;

/**
 * How dark the footprint on a stepping stone is, from 0 to 1, `since` seconds after the walk up
 * the path began. `stone` counts from the front of the garden. Each one lands in turn, stays a
 * while and fades, so the prints lead up to the door and are gone behind whoever made them.
 */
export function printShows(since: number, stone: number): number {
  const landed = since - stone * STEP_EVERY;
  if (landed <= 0) return 0;
  const coming = Math.min(1, landed / 0.08);
  const going = Math.min(1, Math.max(0, (landed - PRINT_STAYS) / PRINT_FADES));
  return coming * (1 - going);
}

/** How long a walk up `stones` stepping stones takes to be over, the last print faded, in seconds. */
export function walkLasts(stones: number): number {
  return (stones - 1) * STEP_EVERY + PRINT_STAYS + PRINT_FADES;
}

/**
 * The colour a lamp turns to when it is tapped: on through `colours` colours, then back to its own
 * warm light, which is 0.
 */
export function nextLight(now: number, colours: number): number {
  return (now + 1) % (colours + 1);
}

/** How many sizes the house comes in: a cottage, and five things added to it as the group's rank rises. */
export const HOUSE_LEVELS = 6;

/** The two shrubs right of the house, by their place in `SHRUBS`. They make way for the garage. */
export const GARAGE_SHRUBS: readonly number[] = [2, 3];
