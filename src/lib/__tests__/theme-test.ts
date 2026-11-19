import { clear, dark, darkTheme, light, lightTheme, schemeFor, toAppearance, type Colors } from '../theme';

/** How bright a colour is to the eye, from 0 (black) to 1 (white), the way the contrast rules measure it. */
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The contrast between two colours, from 1 (the same) to 21 (black on white). */
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const MODES: [string, Colors][] = [
  ['light', light],
  ['dark', dark],
];

describe('the two sets of colours', () => {
  it('have the same names', () => {
    expect(Object.keys(dark).sort()).toEqual(Object.keys(light).sort());
  });

  it('keep the pastels, the daisy and the logo tile the same in both', () => {
    for (const name of ['sky', 'peach', 'mint', 'yellow', 'rose', 'mintText', 'logoTile', 'daisyCenter', 'daisyCheek', 'white', 'ink'] as const) {
      expect(dark[name]).toBe(light[name]);
    }
  });

  it('use grape for buttons in light mode and the brighter violet in dark mode', () => {
    expect(light.button).toBe('#6D2FC4');
    expect(dark.button).toBe('#8A4BE6');
  });

  it('say which mode they are', () => {
    expect(lightTheme.dark).toBe(false);
    expect(darkTheme.dark).toBe(true);
    expect(darkTheme.colors).toBe(dark);
  });
});

describe.each(MODES)('%s mode is readable', (_mode, c) => {
  const surfaces = [c.background, c.card];

  it('main and muted text stand out strongly on the page and on cards', () => {
    for (const surface of surfaces) {
      expect(contrast(c.text, surface)).toBeGreaterThanOrEqual(7);
      expect(contrast(c.textMuted, surface)).toBeGreaterThanOrEqual(5.5);
    }
  });

  it('links, pink text, good news and errors can be read on the page and on cards', () => {
    for (const surface of surfaces) {
      for (const words of [c.link, c.accentText, c.good, c.danger]) expect(contrast(words, surface)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(c.danger, c.dangerTint)).toBeGreaterThanOrEqual(4.5);
  });

  it('words on a filled button, a selected tab, a chosen chip and a chosen vote can be read', () => {
    expect(contrast(c.onButton, c.button)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.onTabOn, c.tabOn)).toBeGreaterThanOrEqual(7);
    for (const fill of [c.selected, c.voteOn, c.today]) expect(contrast(c.text, fill)).toBeGreaterThanOrEqual(7);
  });

  it('words on a pastel are always dark enough', () => {
    for (const pastel of [c.sky, c.peach, c.mint, c.yellow, c.rose]) expect(contrast(c.onPastel, pastel)).toBeGreaterThanOrEqual(7);
    expect(contrast(c.mintText, c.mint)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('dark mode', () => {
  it('makes cards lighter than the page, and edges of text boxes easy to see', () => {
    expect(luminance(dark.card)).toBeGreaterThan(luminance(dark.background));
    expect(contrast(dark.outline, dark.card)).toBeGreaterThanOrEqual(3);
    expect(contrast(dark.outline, dark.background)).toBeGreaterThanOrEqual(3);
  });
});

describe('toAppearance', () => {
  it('reads back a saved choice', () => {
    expect(toAppearance('light')).toBe('light');
    expect(toAppearance('dark')).toBe('dark');
    expect(toAppearance('auto')).toBe('auto');
  });

  it('is Auto when nothing, or nonsense, was saved', () => {
    for (const saved of [null, undefined, '', 'Dark', 'purple', 1]) expect(toAppearance(saved)).toBe('auto');
  });
});

describe('schemeFor', () => {
  it('follows the device on Auto', () => {
    expect(schemeFor('auto', 'dark')).toBe('dark');
    expect(schemeFor('auto', 'light')).toBe('light');
  });

  it('is light on Auto when the device does not say', () => {
    for (const device of [null, undefined, 'unspecified']) expect(schemeFor('auto', device)).toBe('light');
  });

  it('keeps to the choice whatever the device says', () => {
    expect(schemeFor('light', 'dark')).toBe('light');
    expect(schemeFor('dark', 'light')).toBe('dark');
  });
});

describe('clear', () => {
  it('is the same colour made see-through', () => {
    expect(clear('#5A25A6')).toBe('rgba(90, 37, 166, 0)');
    expect(clear('#FFFFFF')).toBe('rgba(255, 255, 255, 0)');
  });
});
