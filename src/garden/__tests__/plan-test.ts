import { dark, light, LIST_COLORS } from '../../lib/theme';
import { groundY, HILL_Z, lawn, pathX, seeded, steppingStones, wind } from '../ground';
import { DAYLIGHT, EXTRAS, HALL, HOUSE_PAINTS, HOUSE_PARTS, PAINT, POSTCARD, SKY, STARS, WILDFLOWERS } from '../palette';
import { BATH_AT, BED, BENCH_AT, FRAMES, frameScale, freePlace, FRONT, GARAGE_SHRUBS, HOUSE_LEVELS, LAWN_EXTRAS, LAWN_SPOTS, LEAVES, leafSize, MAX_LEAVES, placeOf, SHAPES, SLOTS, stemHeight, variety, WALL } from '../plan';
import { SHRUBS } from '../plants';

describe('the ground', () => {
  it('is highest at the top of the hill and falls away all round', () => {
    expect(groundY(0, HILL_Z)).toBe(0);
    expect(groundY(3, HILL_Z)).toBeLessThan(0);
    expect(groundY(0, 4)).toBeLessThan(groundY(0, 2));
    expect(groundY(-2, 1)).toBeCloseTo(groundY(2, 1));
  });

  it('never runs out, however far away', () => {
    expect(Number.isFinite(groundY(100, 100))).toBe(true);
  });

  it('has a path that bends toward the door at the back', () => {
    expect(pathX(0)).toBe(0);
    expect(pathX(-4)).toBeCloseTo(0.4 * Math.sin(-3.2) - 0.5);
  });

  it('lays twelve stepping stones, alternating either side of the path', () => {
    const stones = steppingStones();
    expect(stones).toHaveLength(12);
    expect(stones[0][1]).toBe(3.5);
    expect(stones[0][0]).toBeCloseTo(pathX(3.5) - 0.09);
    expect(stones[1][0]).toBeCloseTo(pathX(3.5 - 0.62) + 0.09);
  });

  it('is calm in a still garden and gusty in a gentle one', () => {
    expect(wind(1, 2, 3, 0)).toBeCloseTo(0);
    expect(Math.abs(wind(1, 2, 3, 1))).toBeGreaterThan(0);
    expect(Math.abs(wind(1, 2, 3, 1))).toBeLessThanOrEqual(1.65);
  });

  it('makes the same garden every time', () => {
    const a = seeded();
    const b = seeded();
    const first = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(first);
    expect(first.every((n) => n > 0 && n < 1)).toBe(true);
  });

  it('knows the lawn inside the garden from the rough grass outside it', () => {
    expect(lawn(0, 0).out).toBe(0);
    expect(lawn(8, 0).out).toBe(1);
    expect(lawn(0, 0)).toEqual(lawn(0, 0));
  });
});

describe('the planting plan', () => {
  it('has twelve places in the yard and three more in the front row', () => {
    expect(SLOTS).toHaveLength(BED);
    expect(FRONT).toHaveLength(3);
  });

  it('gives no two places the same spot', () => {
    const spots = [...SLOTS, ...FRONT.map(([, spot]) => spot)].map(([x, z]) => `${x},${z}`);
    expect(new Set(spots).size).toBe(15);
  });

  it('fills the yard in order', () => {
    expect(freePlace(new Set(), false)).toBe(0);
    expect(freePlace(new Set([0, 1, 3]), false)).toBe(2);
  });

  it('puts an idea that was just added in the front row while there is room', () => {
    expect(freePlace(new Set([0, 1]), true)).toBe(13);
    expect(freePlace(new Set([0, 13]), true)).toBe(12);
    expect(freePlace(new Set([13, 12]), true)).toBe(15);
    expect(freePlace(new Set([13, 12, 15]), true)).toBe(0);
  });

  it('never gives a full bed and its front row a place twice', () => {
    // Twelve flowers planted together, then three new ideas.
    const taken = new Set<number>();
    for (let i = 0; i < BED; i++) taken.add(freePlace(taken, false));
    for (let i = 0; i < FRONT.length; i++) taken.add(freePlace(taken, true));
    const spots = [...taken].map((slot) => placeOf(slot).join(','));
    expect(new Set(spots).size).toBe(15);
  });

  it('knows where each place is', () => {
    expect(placeOf(0)).toEqual(SLOTS[0]);
    expect(placeOf(11)).toEqual(SLOTS[11]);
    expect(placeOf(13)).toEqual([1.2, 4.3]);
  });
});

describe('a flower', () => {
  it('opens and grows taller as its idea comes along', () => {
    expect(SHAPES[1].fold).toBeGreaterThan(SHAPES[2].fold);
    expect(SHAPES[2].fold).toBeGreaterThan(SHAPES[3].fold);
    expect(SHAPES[1].stem).toBeLessThan(SHAPES[2].stem);
    expect(SHAPES[2].stem).toBeLessThan(SHAPES[3].stem);
    expect(SHAPES[4]).toEqual(SHAPES[3]);
  });

  it('is always the same height for the same idea, and not all one height', () => {
    expect(variety('abc')).toBe(variety('abc'));
    expect(new Set(['1', '2', '3'].map(variety))).toEqual(new Set([0, 1, 2]));
    expect(stemHeight({ id: '3', stage: 1 })).toBeCloseTo(0.78);
    expect(stemHeight({ id: '2', stage: 3 })).toBeCloseTo(1.36 + 0.14);
  });

  it('has a place for a leaf for each of six members', () => {
    expect(LEAVES).toHaveLength(MAX_LEAVES);
    expect(new Set(LEAVES.map((l) => `${l.half} ${l.up}`)).size).toBe(MAX_LEAVES);
  });

  it('shows an answer in the size of the leaf', () => {
    expect(leafSize(1)).toBe(1);
    expect(leafSize(2)).toBe(0.6);
    expect(leafSize(0)).toBe(0.24);
    expect(leafSize(undefined)).toBe(0.24);
  });
});

describe("the garden's colours", () => {
  it('match the brand where they are the brand', () => {
    expect(PAINT.ink).toBe(light.ink);
    expect(PAINT.center).toBe(light.daisyCenter);
    expect(PAINT.roof).toBe(light.logoTile);
    expect(PAINT.door).toBe(light.button);
    expect(PAINT.ring).toBe(light.accent);
    expect(PAINT.stone).toBe(light.background);
    expect(PAINT.trim).toBe(light.outline);
    expect(PAINT.knob).toBe(light.gold);
    expect(PAINT.stem).toBe(light.good);
  });

  it('use the app\'s pastels for butterflies', () => {
    expect([...PAINT.butterflies].sort()).toEqual([light.rose, light.yellow, light.sky, light.peach].sort());
  });

  it('make the night sky the dark page, and day and dusk the sky and peach pastels', () => {
    expect(DAYLIGHT.night.sky).toBe(dark.background);
    expect(DAYLIGHT.day.sky).toBe(light.sky);
    expect(DAYLIGHT.dusk.sky).toBe(light.peach);
  });

  it('say the same things about every time of day', () => {
    expect(Object.keys(DAYLIGHT.dusk).sort()).toEqual(Object.keys(DAYLIGHT.day).sort());
    expect(Object.keys(DAYLIGHT.night).sort()).toEqual(Object.keys(DAYLIGHT.day).sort());
  });

  it('are written like the list colours that petals take', () => {
    for (const color of [...Object.values(PAINT).flat(), ...LIST_COLORS]) expect(color).toMatch(/^#[0-9A-F]{6}$/);
  });
});

describe('the hallway inside the house', () => {
  it('has twelve places for frames on a wall', () => {
    expect(FRAMES).toHaveLength(WALL);
    expect(WALL).toBe(12);
  });

  it('keeps every frame on the wall, above the sideboard and clear of its neighbours\' middles', () => {
    for (const [x, y, w, h] of FRAMES) {
      expect(Math.abs(x) + w / 2).toBeLessThan(1.15);
      expect(y - h / 2).toBeGreaterThan(0.66);
      expect(y + h / 2).toBeLessThan(3.5);
    }
    const middles = FRAMES.map(([x, y]) => `${x},${y}`);
    expect(new Set(middles).size).toBe(12);
  });

  it('has nine frames with corners and three round ones', () => {
    expect(FRAMES.filter(([, , , , round]) => round === 1)).toHaveLength(3);
  });

  it('hangs the frames of a nearly empty wall a little larger', () => {
    expect([1, 3].map(frameScale)).toEqual([1.22, 1.22]);
    expect([4, 6].map(frameScale)).toEqual([1.12, 1.12]);
    expect([7, 12].map(frameScale)).toEqual([1, 1]);
  });
});

describe('the yard', () => {
  it('stands the bench right of the path and the birdbath left of it, clear of every flower', () => {
    expect(BENCH_AT[0]).toBeGreaterThan(0);
    expect(BATH_AT[0]).toBeLessThan(0);
    for (const [x, z] of [...SLOTS, ...FRONT.map(([, spot]) => spot)]) {
      expect(Math.hypot(x - BENCH_AT[0], z - BENCH_AT[1])).toBeGreaterThan(0.5);
      expect(Math.hypot(x - BATH_AT[0], z - BATH_AT[1])).toBeGreaterThan(0.5);
    }
  });
});

describe('what the third design added to the yard', () => {
  const spots = LAWN_EXTRAS.map((key) => LAWN_SPOTS[key]);

  it('has a spot for a picnic, a woodpile, a fire pit and a pond, in the order the grass is told them', () => {
    expect(LAWN_EXTRAS).toEqual(['picnic', 'wood', 'fire', 'pond']);
    expect(spots.map((s) => [...s.at, s.flat])).toEqual([
      [-2.45, 1, 0.5],
      [2.55, 1.5, 0.3],
      [-2.1, 3.25, 0.25],
      [2.15, 3.3, 0.36],
    ]);
  });

  it('stands each clear of every flower, the path, the bench, the birdbath and each other', () => {
    for (const { at, flat } of spots) {
      const reach = Math.sqrt(flat);
      for (const [x, z] of [...SLOTS, ...FRONT.map(([, spot]) => spot)]) expect(Math.hypot(x - at[0], z - at[1])).toBeGreaterThan(reach);
      expect(Math.abs(at[0] - pathX(at[1]))).toBeGreaterThan(reach + 0.3);
      expect(Math.hypot(BENCH_AT[0] - at[0], BENCH_AT[1] - at[1])).toBeGreaterThan(reach + 0.5);
      expect(Math.hypot(BATH_AT[0] - at[0], BATH_AT[1] - at[1])).toBeGreaterThan(reach + 0.5);
      for (const other of spots) if (other !== spots.find((s) => s.at === at)) expect(Math.hypot(other.at[0] - at[0], other.at[1] - at[1])).toBeGreaterThan(reach + Math.sqrt(other.flat));
    }
  });

  it('grows the house through six levels, and clears the two shrubs right of it for the garage', () => {
    expect(HOUSE_LEVELS).toBe(6);
    expect(GARAGE_SHRUBS).toEqual([2, 3]);
    // Both stand to the right of the house and in front of it, where the garage and its drive go.
    for (const i of GARAGE_SHRUBS) {
      expect(SHRUBS[i][0]).toBeGreaterThan(1.5);
      expect(SHRUBS[i][0]).toBeLessThan(2.8);
    }
  });

  it('paints the umbrella in the brand pink and white', () => {
    expect(HOUSE_PARTS.umbrella).toEqual(['#E0489E', '#FFFFFF']);
    expect(HOUSE_PARTS.gold).toBe(light.gold);
  });

  it('has no wisps at night, and clouds that are nearly solid', () => {
    expect(SKY.night.wisps).toBe(0);
    expect(SKY.night.cloudOpacity).toBe(0.95);
    // Day and dusk are as they were.
    expect([SKY.day.cloudOpacity, SKY.day.wisps, SKY.dusk.cloudOpacity, SKY.dusk.wisps]).toEqual([0.97, 0.5, 0.97, 0.7]);
  });
});

describe('the colours added with the second design', () => {
  it('say the same things about the sky at every time of day', () => {
    expect(Object.keys(SKY.dusk).sort()).toEqual(Object.keys(SKY.day).sort());
    expect(Object.keys(SKY.night).sort()).toEqual(Object.keys(SKY.day).sort());
  });

  it('keep the glow weak by day, so the white daisy can be read against the sky', () => {
    expect(SKY.day.glowStrength).toBeLessThan(0.2);
    expect(SKY.dusk.glowStrength).toBeGreaterThan(SKY.day.glowStrength);
  });

  it('have about six thousand stars in three sizes', () => {
    expect(STARS).toHaveLength(3);
    expect(STARS.reduce((sum, [, , count]) => sum + count, 0)).toBe(6020);
  });

  it('start every house in the colours it has always had', () => {
    expect(HOUSE_PAINTS.roof[0]).toBe(PAINT.roof);
    expect(HOUSE_PAINTS.walls[0]).toBe(PAINT.white);
    expect(HOUSE_PAINTS.door[0]).toBe(PAINT.door);
    expect(HOUSE_PAINTS.roof).toHaveLength(24);
    expect(HOUSE_PAINTS.walls).toHaveLength(24);
    expect(HOUSE_PAINTS.door).toHaveLength(24);
  });

  it('keep every colour a house could be painted before the third design', () => {
    for (const color of ['#8A4BE6', '#B8339A', '#2F7BE8', '#1FA98A', '#E8B923']) expect(HOUSE_PAINTS.roof).toContain(color);
    for (const color of ['#FFFFFF', '#FFD9C7', '#CFE3FF', '#F7C9EA']) expect(HOUSE_PAINTS.walls).toContain(color);
    for (const color of ['#6D2FC4', '#B8339A', '#17806A', '#E8B923']) expect(HOUSE_PAINTS.door).toContain(color);
  });

  it('take the brand\'s colours where they share them', () => {
    expect(EXTRAS.can).toBe(light.logoTile);
    expect(HALL.brass).toBe(light.gold);
    expect(POSTCARD.card).toBe(light.card);
    expect(POSTCARD.ink).toBe(light.text);
    expect(POSTCARD.muted).toBe(light.textMuted);
    expect(POSTCARD.blank).toBe(light.sky);
    expect([...WILDFLOWERS].slice(0, 3)).toEqual([light.white, light.yellow, light.rose]);
  });
});
