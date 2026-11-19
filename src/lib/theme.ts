// Every colour in the app lives in this file and is read through `useTheme()`. No screen or
// component has a colour value of its own. The names follow docs/POLISH-AND-DARK-MODE.md, section 9.
//
// Three kinds of colour are here:
//   * `fixed`: the same in every mode (the pastels, the daisy, the logo tile).
//   * `light`: what changes with the mode. Dark mode will be a second set with the same names.
//   * A few palettes built from those, for things that never change: covers, avatars, confetti.

import { createContext, useContext } from 'react';

/** Colours that stay the same whatever the mode. */
const fixed = {
  white: '#FFFFFF',
  /** The app's dark ink, for words and icons sitting on a pale colour that never changes. */
  ink: '#2C2040',
  // Pastels: covers, icon tiles, avatars.
  sky: '#CFE3FF',
  peach: '#FFD9C7',
  mint: '#CDEFE0',
  yellow: '#FFE08A',
  rose: '#F7C9EA',
  /** Words on mint, such as "Everyone's in". */
  mintText: '#17523A',
  /** The logo's tile, the splash screen and the picture made for sharing. */
  logoTile: '#8A4BE6',
  daisyCenter: '#FFD25A',
  daisyCheek: '#F58FB8',
  /** The ring around a special stamp. */
  gold: '#E8B923',
};

export const light = {
  ...fixed,
  /** Page background. */
  background: '#F6F0FB',
  /** Cards, sheets, input backgrounds, round icon buttons. */
  card: '#FFFFFF',
  /** Main text. */
  text: '#2C2040',
  /** Secondary text. */
  textMuted: '#625475',
  /** Past days, disabled items, placeholder words. */
  textDisabled: '#8E80A3',
  /** Filled buttons, focus outline, chosen-vote outline. */
  button: '#6D2FC4',
  /** Text on filled buttons. */
  onButton: '#FFFFFF',
  /** Links, quiet text buttons, line icons. */
  link: '#5A25A6',
  /** Progress bar fill, selected outline. */
  accent: '#B8339A',
  /** Pink text, such as the rank name on Home. */
  accentText: '#9C2580',
  /** Fill of a selected chip or day. */
  selected: '#FBE3F4',
  /** Fill of the vote the person chose. */
  voteOn: '#EFE6FD',
  /** Today on calendars, progress bar track. */
  today: '#E6D2FF',
  /** Hairlines and card borders. */
  line: '#E7DBF3',
  /** Borders of inputs and outlined buttons, dashed shapes. */
  outline: '#B49FCF',
  /** Selected tab pill, and the words on it. */
  tabOn: '#2C2040',
  onTabOn: '#FFFFFF',
  /** Card shadow. */
  shadow: 'rgba(90, 40, 140, 0.12)',
  /** Text and initials sitting on a pastel. Always dark. */
  onPastel: '#2C2040',

  // Not in the design's table, but the app needs them.
  /** The shadow cast upward by the band behind the pinned buttons. */
  shadowStrong: 'rgba(90, 40, 140, 0.22)',
  /** A grey hairline around a quiet button on a card. */
  edge: '#CFC6DC',
  /** The faint flower outlines behind buttons and bands. */
  bloom: '#A582E8',
  /** Removing and deleting, and the words of an error. */
  danger: '#A3221B',
  /** The box behind an error. */
  dangerTint: '#FDE7E5',
};

export type Colors = { [K in keyof typeof light]: string };

/** The card shadow, as the style a view takes. Made from the theme's `shadow` colour. */
function shadowStyle(shadow: string) {
  const [r, g, b, a] = (shadow.match(/[\d.]+/g) ?? ['0', '0', '0', '0']).map(Number);
  return {
    shadowColor: `rgb(${r}, ${g}, ${b})`,
    shadowOpacity: a,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  };
}

export type Theme = { colors: Colors; shadow: ReturnType<typeof shadowStyle> };

export const lightTheme: Theme = { colors: light, shadow: shadowStyle(light.shadow) };

const ThemeContext = createContext<Theme>(lightTheme);

/** The colours to draw with, and the card shadow. The one way a screen or component gets a colour. */
export function useTheme(): Theme {
  return useContext(ThemeContext);
}

/** A colour ("#RRGGBB") made fully see-through, for fading to and from it. */
export function clear(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, 0)`;
}

export const covers: Record<string, string> = {
  sky: fixed.sky,
  peach: fixed.peach,
  mint: fixed.mint,
  yellow: fixed.yellow,
};

export const avatarColors = [fixed.peach, fixed.sky, fixed.mint, fixed.yellow, fixed.rose];

/** The avatar colour for a member whose own is not known. */
export const DEFAULT_AVATAR = fixed.peach;

/** The colours offered for a list, and handed out in turn to lists that have not chosen. People pick these, so they never change with the mode. */
export const LIST_COLORS = [
  '#7B3FE4', '#2F7BE8', '#E0489E', '#1FA98A', '#4B5FE0', '#B8339A', '#0F9BB5', '#5BAA3C', '#D43D6B', '#3D4A6B',
  '#9B5DE5', '#5E35B1', '#3F51B5', '#1565C0', '#42A5F5', '#00ACC1', '#00897B', '#2E7D32', '#7CB342', '#C2185B',
  '#EC407A', '#F48FB1', '#AB47BC', '#6C63FF', '#E53935', '#546E7A', '#26A69A', '#80CBC4', '#F2C94C', '#111827',
];

/** What a list's icon is drawn in: white on most colours, dark ink on very light ones. */
export const TILE_INK = { onDark: fixed.white, onLight: fixed.ink };

/** The colours of Google's "G". Theirs, not ours, so they never change. */
export const GOOGLE_LOGO = { red: '#EA4335', blue: '#4285F4', yellow: '#FBBC05', green: '#34A853' };

/** Confetti is thrown over the celebration's violet in every mode, so its colours never change. */
export const CONFETTI = [fixed.white, fixed.yellow, fixed.daisyCenter, light.selected, fixed.daisyCheek, fixed.mint, fixed.sky, light.today];

/** The petals of the daisies that bloom from a card's corners in a celebration. */
export const BLOOM_PETALS = [fixed.white, light.selected, fixed.sky, fixed.white];

export const fonts = {
  medium: 'Nunito_500Medium',
  bold: 'Nunito_700Bold',
  extra: 'Nunito_800ExtraBold',
  black: 'Nunito_900Black',
};

// The emoji offered under "+ emoji" on an idea. Thumbs up and down have their own buttons.
export const MORE_REACTIONS = [
  '😍', '🔥', '🎉', '😂', '🤔', '🍿', '❤️', '🤩',
  '🙌', '👏', '🥳', '😎', '😋', '🤤', '😮', '👀',
  '💯', '✨', '🤝', '🙈', '😬', '😴', '💸', '🌧️',
  '☀️', '🏖️', '⛰️', '🚗', '✈️', '🍕', '🍷', '🎶',
];
export const REACTIONS = ['👍', '👎', ...MORE_REACTIONS];
export const STARTER_LISTS = ['Movies', 'Places', 'Food', 'Shows', 'Games', 'Trips', 'Day trips'];
