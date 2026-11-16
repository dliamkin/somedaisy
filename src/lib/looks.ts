// How a list looks on its ideas' cards: a drawn icon on a tile of blended colour.
//
// A list can carry its own icon and colour (supabase/updates/012-list-looks.sql). A list without
// them, which is every list made before that update or made without choosing, gets an icon guessed
// from its name and a colour by its place among the group's lists.

/** Every icon a list can have, in the order the picker shows them. The drawings live in components/list-tile.tsx. */
export const ICONS = [
  'daisy',
  'movie',
  'tv',
  'popcorn',
  'ticket',
  'music',
  'mic',
  'food',
  'pizza',
  'cake',
  'coffee',
  'cocktail',
  'pin',
  'map',
  'car',
  'bus',
  'plane',
  'suitcase',
  'globe',
  'mountain',
  'tent',
  'tree',
  'wave',
  'sun',
  'moon',
  'snowflake',
  'dice',
  'gamepad',
  'ball',
  'bike',
  'dumbbell',
  'book',
  'pencil',
  'camera',
  'bag',
  'gift',
  'home',
  'bed',
  'people',
  'heart',
  'star',
  'sparkle',
  'bulb',
  'paw',
  'fish',
  'anchor',
  'flag',
] as const;

export type IconName = (typeof ICONS)[number];

/** What each icon is called when read aloud. */
export const ICON_LABELS: Record<IconName, string> = {
  daisy: 'Daisy',
  movie: 'Film',
  tv: 'Television',
  popcorn: 'Popcorn',
  ticket: 'Ticket',
  music: 'Music',
  mic: 'Microphone',
  food: 'Bowl of food',
  pizza: 'Pizza',
  cake: 'Cake',
  coffee: 'Coffee',
  cocktail: 'Cocktail',
  pin: 'Map pin',
  map: 'Map',
  car: 'Car',
  bus: 'Bus',
  plane: 'Plane',
  suitcase: 'Suitcase',
  globe: 'Globe',
  mountain: 'Mountain',
  tent: 'Tent',
  tree: 'Tree',
  wave: 'Waves',
  sun: 'Sun',
  moon: 'Moon',
  snowflake: 'Snowflake',
  dice: 'Dice',
  gamepad: 'Game controller',
  ball: 'Ball',
  bike: 'Bicycle',
  dumbbell: 'Weights',
  book: 'Book',
  pencil: 'Pencil',
  camera: 'Camera',
  bag: 'Shopping bag',
  gift: 'Gift',
  home: 'Home',
  bed: 'Bed',
  people: 'People',
  heart: 'Heart',
  star: 'Star',
  sparkle: 'Sparkle',
  bulb: 'Light bulb',
  paw: 'Paw',
  fish: 'Fish',
  anchor: 'Anchor',
  flag: 'Flag',
};

export function isIcon(value: unknown): value is IconName {
  return typeof value === 'string' && (ICONS as readonly string[]).includes(value);
}

// Each pattern matches from the start of a word, so "Theatre" is not taken for "eat".
const GUESSES: [RegExp, IconName][] = [
  [/\b(movie|film|cinema)/i, 'movie'],
  [/\b(show|series|tv\b)/i, 'tv'],
  [/\b(food|eat|restaurant|dinner|lunch|brunch|cook)/i, 'food'],
  [/\b(day trip|drive|road)/i, 'car'],
  [/\b(trip|travel|holiday|vacation)/i, 'plane'],
  [/\b(place|visit|sight)/i, 'pin'],
  [/\b(game|play)/i, 'dice'],
  [/\b(music|concert|gig\b)/i, 'music'],
  [/\b(book|read)/i, 'book'],
  [/\b(hike|hiking|walk|outdoor|nature|park)/i, 'mountain'],
  [/\b(sport|gym\b|run|swim)/i, 'ball'],
  [/\b(drink|bars?\b|coffee|cafe)/i, 'coffee'],
];

/** An icon for a list, guessed from its name. Lists the app does not recognise get the daisy. */
export function guessIcon(listName: string | null | undefined): IconName {
  const name = listName ?? '';
  return GUESSES.find(([pattern]) => pattern.test(name))?.[1] ?? 'daisy';
}

/** The colours offered as ready-made choices, and handed out in turn to lists that have not chosen. */
export const TILE_COLORS = ['#7B3FE4', '#2F7BE8', '#E0489E', '#1FA98A', '#4B5FE0', '#B8339A', '#0F9BB5', '#5BAA3C', '#D43D6B', '#3D4A6B'];

/** A colour as "#RRGGBB" in capitals, from what someone typed ("#abc", "A1B2C3"), or null if it is not one. */
export function cleanHex(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const text = input.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(text)) return `#${[...text].map((c) => c + c).join('')}`.toUpperCase();
  if (/^[0-9a-f]{6}$/i.test(text)) return `#${text}`.toUpperCase();
  return null;
}

type Hsl = { h: number; s: number; l: number };

function toHsl(hex: string): Hsl {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, l };
}

function toHex({ h, s, l }: Hsl): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const part = (v: number) =>
    Math.round(Math.min(1, Math.max(0, v + m)) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`.toUpperCase();
}

export type TileBlend = {
  /** The chosen colour, at the tile's top left. */
  from: string;
  /** Its partner at the bottom right: a neighbouring colour, a little lighter. */
  to: string;
  /** What the icon is drawn in: white on most colours, the app's dark ink on very light ones. */
  ink: string;
};

/**
 * The two-colour blend for a tile, worked out from one colour, so any colour someone picks gets
 * the same look as the ready-made ones.
 */
export function blendFor(color: string): TileBlend {
  const hsl = toHsl(color);
  // Pinks and reds lean back towards purple, everything else leans forward, so no blend
  // passes through orange on its way.
  const lean = hsl.h >= 290 || hsl.h < 20 ? -38 : 38;
  const to = toHex({ h: (hsl.h + lean + 360) % 360, s: hsl.s, l: Math.min(0.82, hsl.l + 0.1) });
  // How bright the colour looks to the eye, the usual way of weighing red, green and blue.
  const n = parseInt(color.slice(1), 16);
  const bright = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return { from: color, to, ink: bright > 0.72 ? '#2C2040' : '#FFFFFF' };
}

export type ListLook = { icon: IconName; color: string };

/**
 * How a list looks: its own icon and colour where it has them, otherwise an icon guessed from
 * its name and a colour by its place among the group's lists.
 */
export function lookFor(list: { name?: string | null; icon?: string | null; color?: string | null } | null | undefined, place: number): ListLook {
  const turn = ((place % TILE_COLORS.length) + TILE_COLORS.length) % TILE_COLORS.length;
  return {
    icon: isIcon(list?.icon) ? list.icon : guessIcon(list?.name),
    color: cleanHex(list?.color) ?? TILE_COLORS[turn],
  };
}
