// Every colour in the garden scene. The garden is a picture of a place, so its colours are its
// own and do not change with light and dark mode: what changes is the time of day (below).
// The app's buttons and sheets over the garden take their colours from src/lib/theme.ts as usual.
//
// The values come from the design handoff (design_handoff_garden_a) and are final. The ones the
// garden shares with the brand are checked against the theme by a test.

/** Flat colours of things in the scene. */
export const PAINT = {
  white: '#FFFFFF',
  black: '#000000',
  /** The app's dark ink: the bee's stripes, a butterfly's body, the number on a date marker. */
  ink: '#2C2040',
  /** A daisy's centre, the sun's centre, the bee. */
  center: '#FFD25A',
  roof: '#8A4BE6',
  door: '#6D2FC4',
  knob: '#E8B923',
  /** The doorstep and the stepping stones. */
  stone: '#F6F0FB',
  /** Window trim and the stake of a date marker. */
  trim: '#B49FCF',
  /** The window box and the pots by the door. */
  pot: '#FFD9C7',
  /** The chimney and the little flowers in the pots. */
  chimney: '#F7C9EA',
  /** The glow from the window, and the fireflies. */
  glow: '#FFE08A',
  /** The ring round a chosen flower, and the edge of a date marker. */
  ring: '#B8339A',
  farHill: '#86B870',
  /** The small plants in the window box and the pots. */
  plant: '#7DB95A',
  stem: '#17523A',
  star: '#F4EEFB',
  bark: '#8A776A',
  /** The woods on the far hills: pointed trees and round ones, each between two greens. */
  farCone: ['#2F6B48', '#3F7F52'],
  farBall: ['#4B8F45', '#74B25A'],
  butterflies: ['#F7C9EA', '#FFE08A', '#CFE3FF', '#FFD9C7'],
} as const;

/** What changes with the time of day. Every value blends smoothly into the next when the time changes. */
export type Daylight = {
  sky: string;
  /** Multiplies the lawn, the leaves, the bark and the soil. */
  foliage: string;
  /** The haze that far things fade into. */
  haze: string;
  skyLight: string;
  groundLight: string;
  skyLightStrength: number;
  sun: string;
  sunStrength: number;
  windowPane: string;
  /** The petals of the daisy in the sky. */
  skyDaisy: string;
  skyDaisyY: number;
  /** How much of the night is out, from 0 to 1: stars, fireflies, and no butterflies. */
  night: number;
  stem: string;
  /** How bright the light from the house's window is. */
  windowLight: number;
};

export type TimeOfDay = 'day' | 'dusk' | 'night';

export const DAYLIGHT: Record<TimeOfDay, Daylight> = {
  day: { sky: '#CFE3FF', foliage: '#FFFFFF', haze: '#D9DEFF', skyLight: '#FFFFFF', groundLight: '#E6D2FF', skyLightStrength: 1.7, sun: '#FFFFFF', sunStrength: 1.9, windowPane: '#CFE3FF', skyDaisy: '#FFFFFF', skyDaisyY: -2.7, night: 0, stem: '#17523A', windowLight: 0 },
  dusk: { sky: '#FFD9C7', foliage: '#F3CDBB', haze: '#FBD3D0', skyLight: '#FFFFFF', groundLight: '#F7C9EA', skyLightStrength: 1.6, sun: '#FFFFFF', sunStrength: 1.7, windowPane: '#FFE08A', skyDaisy: '#FFE08A', skyDaisyY: -10.5, night: 0.3, stem: '#17523A', windowLight: 3 },
  night: { sky: '#171124', foliage: '#8A80DC', haze: '#1B1530', skyLight: '#C4B5D4', groundLight: '#3D2F5A', skyLightStrength: 1.5, sun: '#C9A6FF', sunStrength: 0.9, windowPane: '#FFE08A', skyDaisy: '#F4EEFB', skyDaisyY: -0.8, night: 1, stem: '#8FE0BD', windowLight: 9 },
};

/** The greens of one kind of tree or shrub: its dark leaves, its light ones, its yellowed ones, and the dark heart of each clump. */
export type Greens = { dark: string; light: string; yellowed: string; core: string };

export const GREENS = {
  /** The tree left of the house, and the trees behind. */
  left: { dark: '#2C6A33', light: '#8DCB57', yellowed: '#C5D96A', core: '#2E6230' },
  /** The tree right of the house. */
  right: { dark: '#3E7F3A', light: '#A6D968', yellowed: '#D2DF7A', core: '#3A7236' },
  /** The tree at the side, just out of view. */
  side: { dark: '#2A6644', light: '#7CC474', yellowed: '#B9D780', core: '#2B6040' },
  /** Conifers do not yellow. */
  conifer: { dark: '#1F4F3A', light: '#5E9C62', yellowed: '#5E9C62', core: '#173A2B' },
  shrubA: { dark: '#2F6E3A', light: '#86C35C', yellowed: '#B8D66C', core: '#2E6434' },
  shrubB: { dark: '#3A7A4E', light: '#93CF86', yellowed: '#C2DC8C', core: '#356C46' },
} satisfies Record<string, Greens>;

/** The lawn as it is painted on the ground: from its darker green to its lighter, and where it is dry. As red, green and blue out of 255. */
export const LAWN = { dark: [56, 110, 48], light: [98, 150, 62], dry: [140, 146, 78] } as const;
/** The blades of grass standing on it, which are lighter. */
export const BLADES = { dark: [92, 164, 62], light: [156, 212, 98], dry: [204, 210, 112] } as const;
/** What is painted over the lawn, as "red,green,blue": the worn path, and the shade under the house, the trees and the shrubs. */
export const WORN = { path: '178,152,110', house: '40,76,38', tree: '38,74,38', conifer: '34,66,40', shrub: '36,72,36' } as const;
/** Bark is one brown with darker and paler streaks. */
export const BARK_STREAKS = { dark: '58,44,40', pale: '190,172,156' } as const;
/** The patch of bare soil under each flower, from its middle out to where it meets the grass, and its crumbs. */
export const SOIL = { middle: '74,54,40', mid: '84,62,44', edge: '70,84,44', rim: '70,96,46', crumbDark: '48,34,26', crumbPale: '128,100,72' } as const;

// ---------- Added with the second design handoff (design_handoff_garden_a_v2) ----------

/** The time of year. Summer is the garden as it first was. */
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

/** How the lawn is kept: as it first was, mown short in stripes, or left to grow with wildflowers in it. */
export type LawnStyle = 'soft' | 'mown' | 'meadow';

/**
 * The sky at each time of day: four colours from the haze on the horizon up to straight overhead,
 * the glow round the daisy in the sky and how strong it is, the top and the base of a cloud and how
 * solid clouds are, and how much the high wisps show. The glow by day is weak on purpose, so the
 * sky behind the daisy stays blue and its white petals can be read. At night a cloud is nearly
 * solid, or the puffs it is made of show through each other as patches, and there are no wisps.
 */
export type Sky = { haze: string; low: string; mid: string; zenith: string; glow: string; glowStrength: number; cloudTop: string; cloudBase: string; cloudOpacity: number; wisps: number };

export const SKY: Record<TimeOfDay, Sky> = {
  day: { haze: '#DDE6FF', low: '#B9D7FF', mid: '#8CBCFF', zenith: '#5A97EE', glow: '#FFF3D6', glowStrength: 0.12, cloudTop: '#FFFFFF', cloudBase: '#C2D0EE', cloudOpacity: 0.97, wisps: 0.5 },
  dusk: { haze: '#FFC79E', low: '#FFB0A8', mid: '#C79BE8', zenith: '#6E78D6', glow: '#FF9A5C', glowStrength: 0.8, cloudTop: '#FFC2A8', cloudBase: '#F08A8A', cloudOpacity: 0.97, wisps: 0.7 },
  night: { haze: '#2C2452', low: '#1F1840', mid: '#15102E', zenith: '#0B0820', glow: '#B79CFF', glowStrength: 0.15, cloudTop: '#3B3570', cloudBase: '#1F1A40', cloudOpacity: 0.95, wisps: 0 },
};

/** The stars: three sizes, each with its colour, its size in dots and how many there are. */
export const STARS: readonly (readonly [string, number, number])[] = [
  ['#BFB3E6', 1.5, 4200],
  ['#F4EEFB', 2.2, 1500],
  ['#FFFFFF', 3.3, 320],
];

/** The colours a group can paint its house: twenty-four for each part. The first of each is what every house starts with. */
export const HOUSE_PAINTS = {
  // prettier-ignore
  roof: ['#8A4BE6', '#6D2FC4', '#B8339A', '#E0489E', '#D9434E', '#B8402E', '#E2703A', '#C98A2B', '#E8B923', '#8FA83A', '#3E9A4E', '#1FA98A', '#17806A', '#2A9DB8', '#2F7BE8', '#3B5BC9', '#2C3E7A', '#5A6B8C', '#7A7F8E', '#4A4458', '#2C2040', '#8A6244', '#B98B63', '#C7B8D9'],
  // prettier-ignore
  walls: ['#FFFFFF', '#FFF7E8', '#FBEFD5', '#FFE9B8', '#FFD9C7', '#FFC9B0', '#F7C9EA', '#F4B8C8', '#E6D2FF', '#CDB8F0', '#CFE3FF', '#A9CBF5', '#C9EEF0', '#BFE8D6', '#CFE5B8', '#A9C99A', '#E9E4DC', '#D8D2C8', '#C9C4D4', '#B8A48C', '#E8B8A0', '#C9705A', '#6E7FA8', '#4A4458'],
  // prettier-ignore
  door: ['#6D2FC4', '#8A4BE6', '#B8339A', '#E0489E', '#D9434E', '#A8322C', '#E2703A', '#E8B923', '#F2D56B', '#8FA83A', '#3E9A4E', '#17806A', '#1FA98A', '#2A9DB8', '#2F7BE8', '#2C3E7A', '#2C2040', '#4A4458', '#7A7F8E', '#FFFFFF', '#FFF7E8', '#B98B63', '#8A6244', '#5B3E2B'],
} as const;

/**
 * What the house gains as the group's rank rises (design_handoff_garden_a_v3). New walls and roofs
 * take the group's own paint, so only the parts that are always one colour are here.
 */
export const HOUSE_PARTS = {
  garageDoor: '#F6F0FB',
  /** The boards of the lanai. */
  deck: '#D9B08A',
  /** The patio umbrella's eight stripes, and the pennant on the cupola. */
  umbrella: ['#E0489E', '#FFFFFF'],
  pennant: '#E0489E',
  /** The ball on top of the umbrella and of the cupola. */
  gold: '#E8B923',
  /** The puff of warm specks when a new part arrives. */
  arrive: '#FFE08A',
} as const;

/** What the seasons add: blossom and falling leaves in the air, and the far hills in autumn and under frost. */
export const SEASONS = {
  blossom: '#F7C9EA',
  fallingLeaves: ['#D9552B', '#F0A93A', '#B8402E'],
  farAutumn: '#B89A58',
  farWinter: '#DDE4F2',
} as const;

/** The wildflowers in a meadow lawn. */
export const WILDFLOWERS = ['#FFFFFF', '#FFE08A', '#F7C9EA', '#D9C2FF'] as const;

/** The things a group earns for its yard, and the watering can. */
export const EXTRAS = {
  /** The water in the birdbath, and the drops from the watering can. */
  water: '#8EC5FF',
  bird: '#2F7BE8',
  bulbs: ['#FFE08A', '#F7C9EA', '#CFE3FF', '#FFD9C7'],
  can: '#8A4BE6',
  // The picnic: the pink of its gingham blanket, its wicker basket, its fruit, bottle and cup.
  gingham: 'rgba(224,72,158,.5)',
  wicker: '#C99A5B',
  wickerDark: '#A9783F',
  apple: '#D9434E',
  greenApple: '#8FA83A',
  bottle: '#1FA98A',
  cup: '#F7C9EA',
  // The woodpile and the fire's logs: bark and cut ends, and the axe.
  bark: '#8A6244',
  cut: '#E9C6AA',
  axeHead: '#7A7F8E',
  axeHandle: '#B98B63',
  // The fire pit: its ring of stones (the pond's too), the ash, the flames from the outside in, and its light.
  rock: '#C9C4D4',
  ash: '#4A4458',
  flames: ['#FF7A2E', '#FFB23E', '#FFE9A8'],
  fireLight: '#FF9A4A',
  // The pond: its lily pads, the flower on one, and its reeds.
  lilyPad: '#3E9A4E',
  lily: '#F7C9EA',
  reed: '#3E7F3A',
} as const;

/** The glow that fills the screen on the way through the door: its middle and its edge. */
export const DOOR_GLOW = ['#FFF8E0', '#FFE08A'] as const;

/** Inside the house: the hallway where finished ideas hang. */
export const HALL = {
  wallpaper: '#EFE7F8',
  ceiling: '#F6F0FB',
  floor: ['#E3BC9E', '#DCB192', '#E9C6AA', '#D8AD8B'],
  rug: '#F0B8DE',
  rugMiddle: '#FBE3F3',
  wood: '#B98B63',
  woodTop: '#D9B08A',
  woodDark: '#8A6244',
  brass: '#E8B923',
  /** The shade of the table lamp and the globes of the wall lights. */
  shade: '#FFF1CC',
  lamp: '#FFE0A8',
  albums: ['#8A4BE6', '#F7C9EA', '#FFD9C7'],
  /** The three daisies in the vase. */
  vase: ['#E0489E', '#7B3FE4', '#2F7BE8'],
  stalk: '#3E7F3A',
  /** The mat inside a bigger frame, and the paper a pressed flower lies on. */
  mat: '#FFFDF8',
  paper: '#FFFBF4',
} as const;

/**
 * What the house's surfaces are painted with before their colour goes on. Every one is white and a
 * soft grey-violet, so the roof, wall and door colours a group chooses tint them.
 */
export const HOUSE_TEXTURES = {
  /** A board of the walls: lit at the top, a shadow line along its foot, and a few flecks. */
  board: { top: '#FFFFFF', mid: '#F1ECF6', foot: '#E2DAEC', gap: 'rgba(70,50,100,.34)', flecks: ['rgba(255,255,255,.5)', 'rgba(70,50,100,.06)'] },
  /** Shingles: the line down the side of each, and the line under each row. */
  shingle: { side: 'rgba(40,20,70,.3)', row: 'rgba(40,20,70,.42)' },
  /** The door's planks: darker toward each edge, with a fine grain. */
  door: { edge: '30,10,60', grain: 'rgba(30,10,60,.08)' },
  brick: { mortar: 'rgba(90,50,110,.4)' },
  /** The warm light behind the door. */
  doorway: '#FFE08A',
} as const;

/**
 * A postcard of the garden. It is the same in light and dark mode, since it is a picture to send
 * to other people: a white card with dark words, shown over the garden dimmed with the app's ink.
 */
export const POSTCARD = {
  card: '#FFFFFF',
  ink: '#2C2040',
  muted: '#625475',
  /** Behind the picture while it loads. */
  blank: '#CFE3FF',
  dim: 'rgba(44, 32, 64, 0.62)',
  shadow: 'rgba(0, 0, 0, 0.25)',
} as const;
