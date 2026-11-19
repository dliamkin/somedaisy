// The picture for each reaction emoji, so a reaction looks the same on every phone and in every
// browser. Left to the device, each draws its own: Apple's, Google's, Samsung's, Microsoft's.
//
// The pictures are Google's Noto Emoji, 72 by 72, in assets/emoji (Apache licence, kept beside
// them). Each file is named by the emoji's code. A new emoji in MORE_REACTIONS needs its picture
// added here, or it falls back to the device's own drawing; a test checks none is missing.
//
// The emoji itself is still what is stored and what a notification says. Only the drawing changes.

export const EMOJI_PICTURES: Record<string, number> = {
  '😍': require('../../assets/emoji/1f60d.png'),
  '🔥': require('../../assets/emoji/1f525.png'),
  '🎉': require('../../assets/emoji/1f389.png'),
  '😂': require('../../assets/emoji/1f602.png'),
  '🤔': require('../../assets/emoji/1f914.png'),
  '🍿': require('../../assets/emoji/1f37f.png'),
  '❤️': require('../../assets/emoji/2764.png'),
  '🤩': require('../../assets/emoji/1f929.png'),
  '🙌': require('../../assets/emoji/1f64c.png'),
  '👏': require('../../assets/emoji/1f44f.png'),
  '🥳': require('../../assets/emoji/1f973.png'),
  '😎': require('../../assets/emoji/1f60e.png'),
  '😋': require('../../assets/emoji/1f60b.png'),
  '🤤': require('../../assets/emoji/1f924.png'),
  '😮': require('../../assets/emoji/1f62e.png'),
  '👀': require('../../assets/emoji/1f440.png'),
  '💯': require('../../assets/emoji/1f4af.png'),
  '✨': require('../../assets/emoji/2728.png'),
  '🤝': require('../../assets/emoji/1f91d.png'),
  '🙈': require('../../assets/emoji/1f648.png'),
  '😬': require('../../assets/emoji/1f62c.png'),
  '😴': require('../../assets/emoji/1f634.png'),
  '💸': require('../../assets/emoji/1f4b8.png'),
  '🌧️': require('../../assets/emoji/1f327.png'),
  '☀️': require('../../assets/emoji/2600.png'),
  '🏖️': require('../../assets/emoji/1f3d6.png'),
  '⛰️': require('../../assets/emoji/26f0.png'),
  '🚗': require('../../assets/emoji/1f697.png'),
  '✈️': require('../../assets/emoji/2708.png'),
  '🍕': require('../../assets/emoji/1f355.png'),
  '🍷': require('../../assets/emoji/1f377.png'),
  '🎶': require('../../assets/emoji/1f3b6.png'),
};
