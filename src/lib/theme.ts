export const colors = {
  ground: '#F6F0FB',
  text: '#2C2040',
  muted: '#625475',
  grape: '#6D2FC4',
  link: '#5A25A6',
  pink: '#B8339A',
  pinkTint: '#FBE3F4',
  grapeTint: '#EFE6FF',
  edge: '#CFC6DC',
  today: '#E6D2FF',
  // The flower outlines where they sit behind buttons and bands: lavender. Drawn mostly see-through, so they stay faint.
  bloom: '#A582E8',
  line: '#E7DBF3',
  dash: '#B49FCF',
  white: '#FFFFFF',
  sky: '#CFE3FF',
  peach: '#FFD9C7',
  mint: '#CDEFE0',
  yellow: '#FFE08A',
  mintText: '#17523A',
  danger: '#A3221B',
};

export const covers: Record<string, string> = {
  sky: colors.sky,
  peach: colors.peach,
  mint: colors.mint,
  yellow: colors.yellow,
};

export const avatarColors = [colors.peach, colors.sky, colors.mint, colors.yellow, '#F7C9EA'];

export const fonts = {
  medium: 'Nunito_500Medium',
  bold: 'Nunito_700Bold',
  extra: 'Nunito_800ExtraBold',
  black: 'Nunito_900Black',
};

export const shadow = {
  shadowColor: '#5A288C',
  shadowOpacity: 0.12,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 8 },
  elevation: 3,
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
