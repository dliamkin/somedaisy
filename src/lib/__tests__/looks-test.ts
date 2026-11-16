import { blendFor, cleanHex, guessIcon, ICON_LABELS, ICONS, isIcon, lookFor, TILE_COLORS } from '../looks';

/** The hue of a colour, 0 to 360, to check which way a blend leans. */
function hue(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return 0;
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return h * 60;
}

describe('the icon set', () => {
  it('has no repeats, a name for every icon, and names the database accepts', () => {
    expect(new Set(ICONS).size).toBe(ICONS.length);
    for (const icon of ICONS) {
      expect(ICON_LABELS[icon]).toBeTruthy();
      expect(icon).toMatch(/^[a-z][a-z0-9-]{0,29}$/);
    }
  });

  it('knows its own icons from anything else', () => {
    expect(isIcon('movie')).toBe(true);
    expect(isIcon('Movie')).toBe(false);
    expect(isIcon('')).toBe(false);
    expect(isIcon(null)).toBe(false);
  });
});

describe('guessIcon', () => {
  it('picks an icon from the name of a familiar list', () => {
    expect(guessIcon('Movies')).toBe('movie');
    expect(guessIcon('TV shows')).toBe('tv');
    expect(guessIcon('Food')).toBe('food');
    expect(guessIcon('Day trips')).toBe('car');
    expect(guessIcon('Trips')).toBe('plane');
    expect(guessIcon('Places')).toBe('pin');
    expect(guessIcon('Board games')).toBe('dice');
  });

  it('gives the daisy to a list it does not recognise, and does not match inside words', () => {
    expect(guessIcon('Birthday plans')).toBe('daisy');
    expect(guessIcon('Theatre')).toBe('daisy');
    expect(guessIcon('')).toBe('daisy');
    expect(guessIcon(null)).toBe('daisy');
  });
});

describe('cleanHex', () => {
  it('takes a colour code with or without the #, short or long, in any case', () => {
    expect(cleanHex('#7b3fe4')).toBe('#7B3FE4');
    expect(cleanHex('7B3FE4')).toBe('#7B3FE4');
    expect(cleanHex('  #abc ')).toBe('#AABBCC');
  });

  it('refuses anything else', () => {
    for (const bad of ['', '#', 'red', '#12', '#12345', '#1234567', '#GGGGGG', 'url(x)', null, 7]) expect(cleanHex(bad)).toBeNull();
  });
});

describe('blendFor', () => {
  it('starts at the chosen colour and ends at a different, valid one', () => {
    for (const color of [...TILE_COLORS, '#000000', '#FFFFFF', '#808080', '#FF0000', '#FFE08A']) {
      const blend = blendFor(color);
      expect(blend.from).toBe(color);
      expect(blend.to).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it('never leans a pink or red into orange', () => {
    for (const color of ['#E0489E', '#B8339A', '#D43D6B', '#FF0000', '#E0203A']) {
      const h = hue(blendFor(color).to);
      expect(h > 250 && h < 345).toBe(true);
    }
  });

  it('draws the icon in white, or in dark ink on a very light colour', () => {
    expect(blendFor('#7B3FE4').ink).toBe('#FFFFFF');
    expect(blendFor('#1FA98A').ink).toBe('#FFFFFF');
    expect(blendFor('#FFE08A').ink).toBe('#2C2040');
    expect(blendFor('#FFFFFF').ink).toBe('#2C2040');
  });
});

describe('lookFor', () => {
  it('uses what the list has chosen', () => {
    expect(lookFor({ name: 'Movies', icon: 'star', color: '#2f7be8' }, 0)).toEqual({ icon: 'star', color: '#2F7BE8' });
  });

  it('guesses the icon and takes a colour by place when nothing is chosen', () => {
    expect(lookFor({ name: 'Movies' }, 0)).toEqual({ icon: 'movie', color: TILE_COLORS[0] });
    expect(lookFor({ name: 'Camping', icon: null, color: null }, 1)).toEqual({ icon: 'daisy', color: TILE_COLORS[1] });
    expect(lookFor({ name: 'Food' }, TILE_COLORS.length + 2).color).toBe(TILE_COLORS[2]);
  });

  it('ignores a chosen icon or colour it does not understand, and copes with no list', () => {
    expect(lookFor({ name: 'Food', icon: 'unicorn', color: 'red' }, 0)).toEqual({ icon: 'food', color: TILE_COLORS[0] });
    expect(lookFor(null, 0)).toEqual({ icon: 'daisy', color: TILE_COLORS[0] });
    expect(lookFor(undefined, -1).color).toBe(TILE_COLORS[TILE_COLORS.length - 1]);
  });
});
