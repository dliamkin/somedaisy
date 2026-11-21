import {
  CLASSIC,
  classicKey,
  contrast,
  coverChange,
  coverOf,
  coverPath,
  fromHsl,
  hexColor,
  isDark,
  LOOKS,
  NAME_DARK,
  NAME_LIGHT,
  nameColor,
  nameSize,
  OWN_COLORS,
  patternStrength,
  readyLook,
  sameCover,
  shapeStrength,
  SHAPE_STRENGTH,
  surpriseLook,
  textOn,
  threeOf,
  type Cover,
} from '../covers';

const GROUP = '0f0e0d0c-0b0a-4908-8706-050403020100';
const look = (name: string) => LOOKS.find((l) => l.name === name)!;

describe('contrast', () => {
  it('follows the standard formula', () => {
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrast('#FFFFFF', '#000000')).toBeCloseTo(21, 5);
    expect(contrast('#777777', '#777777')).toBeCloseTo(1, 5);
    // A pair with a well-known answer: this grey on white is 4.54 to 1.
    expect(contrast('#767676', '#FFFFFF')).toBeCloseTo(4.54, 2);
  });
});

describe('the colour of the name', () => {
  it('is dark ink on the five pale looks and white on the three dark ones', () => {
    for (const name of ['Mint', 'Peach', 'Lavender', 'Sky', 'Sunny']) expect(textOn(look(name).background)).toBe(NAME_DARK);
    for (const name of ['Grape', 'Night', 'Berry']) expect(textOn(look(name).background)).toBe(NAME_LIGHT);
  });

  it('is dark ink on all four classic colours', () => {
    for (const key of Object.keys(CLASSIC)) expect(textOn(CLASSIC[key])).toBe(NAME_DARK);
  });

  it('is whichever of the two stands out more, on any colour', () => {
    for (const background of ['#000000', '#FFFFFF', '#808080', '#FF0000', '#00FF00', '#0000FF', '#6D2FC4', '#B49FCF']) {
      const chosen = textOn(background);
      const other = chosen === NAME_DARK ? NAME_LIGHT : NAME_DARK;
      expect(contrast(chosen, background)).toBeGreaterThanOrEqual(contrast(other, background));
    }
  });

  it('is always white on a photo, and worked out from the colour while the photo is not showing', () => {
    const photo: Cover = { kind: 'photo', background: '#CDEFE0', pattern: true, photo: { source: 'upload', path: coverPath(GROUP), version: 1 } };
    expect(nameColor(photo)).toBe(NAME_LIGHT);
    expect(isDark(photo)).toBe(true);
    expect(nameColor(photo, false)).toBe(NAME_DARK);
    expect(isDark(photo, false)).toBe(false);
  });

  it('draws the pattern softer on a dark cover', () => {
    expect(patternStrength({ kind: 'look', ...look('Mint'), pattern: true })).toBe(0.5);
    expect(patternStrength({ kind: 'look', ...look('Grape'), pattern: true })).toBe(0.25);
  });

  it('fades the shape behind the name only when the name would be hard to read on it', () => {
    for (const ready of LOOKS.filter((l) => l.name !== 'Berry')) expect(shapeStrength(ready)).toBe(SHAPE_STRENGTH);
    // Berry's name is white, and the shape behind it is a pale coral that white is hard to read on.
    expect(shapeStrength(look('Berry'))).toBe(0.35);
    // Picked by hand: a pale background, so dark ink, with a nearly black shape behind the name.
    expect(shapeStrength({ background: '#FFFFFF', shape1: '#CFE3FF', shape2: '#1A1028' })).toBe(0.35);
  });
});

describe('nameSize', () => {
  it('is the full size up to 14 letters', () => {
    expect(nameSize('Weekend crew', 30)).toBe(30);
    expect(nameSize('12345678901234', 26)).toBe(26);
  });

  it('steps down to about 80% from 15 to 24 letters', () => {
    expect(nameSize('Movie night regulars', 30)).toBe(24);
    expect(nameSize('123456789012345', 30)).toBe(24);
    expect(nameSize('123456789012345678901234', 32)).toBe(25);
  });

  it('steps down to about 68% from 25 letters', () => {
    expect(nameSize('Christopher Wedding - late September', 30)).toBe(20);
    expect(nameSize('Christopher Wedding - late September', 26)).toBe(17);
    expect(nameSize('1234567890123456789012345', 32)).toBe(21);
  });

  it('counts letters, not the spaces round the name, and an emoji as one', () => {
    expect(nameSize('   Weekend crew   ', 30)).toBe(30);
    expect(nameSize('Weekend crew 🌼', 30)).toBe(30);
  });
});

describe('coverOf', () => {
  it('is the classic colour with the pattern on for a group that has chosen nothing newer', () => {
    expect(coverOf({ cover: 'mint' })).toEqual({ kind: 'classic', background: CLASSIC.mint, pattern: true });
    expect(coverOf({ cover: 'peach', cover_style: null })).toEqual({ kind: 'classic', background: CLASSIC.peach, pattern: true });
  });

  it('falls back to sky for a word it does not know', () => {
    expect(coverOf({ cover: '🌼' })).toEqual({ kind: 'classic', background: CLASSIC.sky, pattern: true });
    expect(coverOf({})).toEqual({ kind: 'classic', background: CLASSIC.sky, pattern: true });
  });

  it('reads a look', () => {
    expect(coverOf({ cover: 'sky', cover_style: { kind: 'look', background: '#4b2a8c', shape1: '#6D2FC4', shape2: '#B8339A', pattern: false } })).toEqual({
      kind: 'look',
      background: '#4B2A8C',
      shape1: '#6D2FC4',
      shape2: '#B8339A',
      pattern: false,
    });
  });

  it('reads a classic colour with the pattern off', () => {
    expect(coverOf({ cover: 'mint', cover_style: { kind: 'classic', background: CLASSIC.mint, pattern: false } })).toEqual({ kind: 'classic', background: CLASSIC.mint, pattern: false });
  });

  it('reads both kinds of photo', () => {
    const uploaded = { source: 'upload', path: coverPath(GROUP), version: 3 };
    expect(coverOf({ id: GROUP, cover: 'sky', cover_style: { kind: 'photo', background: '#CDEFE0', pattern: true, photo: uploaded } })).toEqual({ kind: 'photo', background: '#CDEFE0', pattern: true, photo: uploaded });
    const searched = { source: 'search', url: 'https://images.example.org/a?w=1200', credit: 'Photo by Ann', creditUrl: 'https://example.org/@ann' };
    expect(coverOf({ id: GROUP, cover: 'sky', cover_style: { kind: 'photo', background: '#CDEFE0', pattern: true, photo: searched } })).toEqual({ kind: 'photo', background: '#CDEFE0', pattern: true, photo: searched });
  });

  it('leaves the colour when a photo cannot be read', () => {
    const colour = { kind: 'classic', background: '#CDEFE0', pattern: true };
    for (const photo of [
      null,
      { source: 'upload', path: 'someone-else/cover.jpg', version: 1 },
      { source: 'upload', path: coverPath(GROUP), version: 0 },
      { source: 'search', url: 'http://images.example.org/a', credit: 'Photo by Ann', creditUrl: 'https://example.org/@ann' },
      { source: 'search', url: 'https://images.example.org/a', credit: '', creditUrl: 'https://example.org/@ann' },
      { source: 'somewhere' },
    ]) {
      expect(coverOf({ id: GROUP, cover: 'sky', cover_style: { kind: 'photo', background: '#CDEFE0', pattern: true, photo } })).toEqual(colour);
    }
  });

  it('falls back to the classic colour for anything else it cannot read', () => {
    const classic = { kind: 'classic', background: CLASSIC.peach, pattern: true };
    for (const cover_style of [
      'look',
      42,
      [],
      { kind: 'look', background: 'red', shape1: '#6D2FC4', shape2: '#B8339A', pattern: true },
      { kind: 'look', background: '#4B2A8C', shape1: '#6D2FC4', pattern: true },
      { kind: 'look', background: '#4B2A8C', shape1: '#6D2FC4', shape2: '#B8339A' },
      { kind: 'video', background: '#4B2A8C', pattern: true },
    ]) {
      expect(coverOf({ cover: 'peach', cover_style })).toEqual(classic);
    }
  });
});

describe('coverChange', () => {
  it('saves a classic colour with the pattern on as its word alone, as older copies of the app do', () => {
    expect(coverChange({ kind: 'classic', background: CLASSIC.mint, pattern: true })).toEqual({ cover: 'mint', cover_style: null });
    expect(coverChange({ kind: 'classic', background: CLASSIC.yellow.toLowerCase(), pattern: true })).toEqual({ cover: 'yellow', cover_style: null });
  });

  it('saves a classic colour with the pattern off as both', () => {
    expect(coverChange({ kind: 'classic', background: CLASSIC.mint, pattern: false })).toEqual({ cover: 'mint', cover_style: { kind: 'classic', background: CLASSIC.mint, pattern: false } });
  });

  it('saves a look without touching the word', () => {
    const grape: Cover = { kind: 'look', ...look('Grape'), pattern: true };
    expect(coverChange(grape)).toEqual({ cover_style: { kind: 'look', background: '#4B2A8C', shape1: '#6D2FC4', shape2: '#B8339A', pattern: true } });
    // Nothing but the cover is written: not the look's name.
    expect(Object.keys(coverChange(grape).cover_style ?? {})).toEqual(['kind', 'background', 'shape1', 'shape2', 'pattern']);
  });

  it('comes back the same when read again', () => {
    const all: Cover[] = [
      { kind: 'classic', background: CLASSIC.peach, pattern: true },
      { kind: 'classic', background: CLASSIC.peach, pattern: false },
      { kind: 'look', ...look('Night'), pattern: false },
      { kind: 'photo', background: '#CDEFE0', pattern: true, photo: { source: 'upload', path: coverPath(GROUP), version: 2 } },
      { kind: 'photo', background: '#CDEFE0', pattern: false, photo: { source: 'search', url: 'https://images.example.org/a', credit: 'Photo by Ann', creditUrl: 'https://example.org/@ann' } },
    ];
    for (const cover of all) {
      const change = coverChange(cover);
      expect(sameCover(coverOf({ id: GROUP, cover: change.cover ?? 'sky', cover_style: change.cover_style }), cover)).toBe(true);
    }
  });
});

describe('sameCover', () => {
  it('does not mind capitals or the order a cover was put together in', () => {
    const one: Cover = { kind: 'look', background: '#cdefe0', shape1: '#CFE3FF', shape2: '#FFE08A', pattern: true };
    const other: Cover = { pattern: true, shape2: '#ffe08a', shape1: '#cfe3ff', background: '#CDEFE0', kind: 'look' };
    expect(sameCover(one, other)).toBe(true);
    expect(sameCover(one, { ...other, pattern: false })).toBe(false);
    expect(sameCover(one, { kind: 'classic', background: '#CDEFE0', pattern: true })).toBe(false);
  });
});

describe('small helpers', () => {
  it('knows a colour when it sees one', () => {
    expect(hexColor('#cdefe0')).toBe('#CDEFE0');
    for (const bad of ['CDEFE0', '#CDE', '#CDEFE0FF', 'red', '', null, 12]) expect(hexColor(bad)).toBeNull();
  });

  it('knows the four classic colours by their words', () => {
    expect(classicKey(CLASSIC.sky)).toBe('sky');
    expect(classicKey(CLASSIC.yellow.toLowerCase())).toBe('yellow');
    expect(classicKey('#4B2A8C')).toBeNull();
  });

  it('keeps an uploaded photo in the group\'s own folder', () => {
    expect(coverPath(GROUP.toUpperCase())).toBe(`${GROUP}/cover.jpg`);
  });

  it('makes colours from hue, strength and lightness', () => {
    expect(fromHsl(0, 100, 50)).toBe('#FF0000');
    expect(fromHsl(120, 100, 50)).toBe('#00FF00');
    expect(fromHsl(240, 100, 50)).toBe('#0000FF');
    expect(fromHsl(360, 100, 50)).toBe('#FF0000');
    expect(fromHsl(0, 0, 100)).toBe('#FFFFFF');
    expect(fromHsl(200, 0, 0)).toBe('#000000');
  });
});

describe('picking your own three', () => {
  it('offers 24 real colours, none of them twice', () => {
    expect(OWN_COLORS).toHaveLength(24);
    for (const colour of OWN_COLORS) expect(hexColor(colour)).toBe(colour);
    expect(new Set(OWN_COLORS).size).toBe(24);
  });

  it('knows a ready-made look from three colours picked by hand', () => {
    expect(readyLook({ background: '#cdefe0', shape1: '#CFE3FF', shape2: '#FFE08A' })?.name).toBe('Mint');
    expect(readyLook({ background: '#CDEFE0', shape1: '#CFE3FF', shape2: '#2C2040' })).toBeNull();
  });

  it('starts from the cover the group has', () => {
    expect(threeOf({ kind: 'look', ...look('Night'), pattern: true })).toEqual({ background: '#1F2A5C', shape1: '#2F9E78', shape2: '#6D2FC4' });
    // A plain colour that a ready-made look is built on borrows that look's shapes.
    expect(threeOf({ kind: 'classic', background: '#FFD9C7', pattern: true })).toEqual({ background: '#FFD9C7', shape1: '#F7C9EA', shape2: '#FFE08A' });
    // Any other plain colour borrows the first look's.
    expect(threeOf({ kind: 'classic', background: '#123456', pattern: false })).toEqual({ background: '#123456', shape1: '#CFE3FF', shape2: '#FFE08A' });
  });
});

describe('surpriseLook', () => {
  // A stand-in for chance that gives the same numbers every time, so the test does.
  const seeded = (seed: number) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const hueOf = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max === min) return 0;
    const d = max - min;
    const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return (h * 60 + 360) % 360;
  };
  const many = Array.from({ length: 400 }, (_, i) => surpriseLook(seeded(i + 1)));

  it('gives three real colours', () => {
    for (const made of many) for (const colour of [made.background, made.shape1, made.shape2]) expect(hexColor(colour)).toBe(colour);
  });

  it('keeps every colour out of orange and brown', () => {
    for (const made of many) {
      for (const colour of [made.background, made.shape1, made.shape2]) {
        const hue = hueOf(colour);
        // The range kept clear is 15 to 45. A little slack, since a colour is rounded to whole steps of red, green and blue.
        expect(hue > 17 && hue < 43).toBe(false);
      }
    }
  });

  it('always leaves the name easy to read', () => {
    for (const made of many) expect(contrast(textOn(made.background), made.background)).toBeGreaterThanOrEqual(4.5);
  });

  it('is dark about one time in four, and different from one time to the next', () => {
    const darkOnes = many.filter((made) => textOn(made.background) === NAME_LIGHT).length;
    expect(darkOnes).toBeGreaterThan(60);
    expect(darkOnes).toBeLessThan(140);
    // Pale colours sit close together, so some of the 400 share a background. Most do not.
    expect(new Set(many.map((made) => made.background)).size).toBeGreaterThan(200);
  });

  it('copes with chance that is stuck', () => {
    // 30 degrees every time: right in the middle of the range it has to stay out of.
    const made = surpriseLook(() => 30 / 360);
    expect(hueOf(made.background) > 17 && hueOf(made.background) < 43).toBe(false);
  });
});
