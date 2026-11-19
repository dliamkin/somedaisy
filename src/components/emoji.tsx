import { Image } from 'expo-image';

import { EMOJI_PICTURES } from '@/lib/emoji-pictures';

import { T } from './ui';

/**
 * One emoji, drawn from the app's own pictures so it looks the same for everyone. An emoji the
 * app has no picture for is left to the device to draw. It is decoration: whatever it sits in
 * says what it is to a screen reader.
 */
export function Emoji({ char, size = 22 }: { char: string; size?: number }) {
  const picture = EMOJI_PICTURES[char];
  if (!picture) return <T size={Math.round(size * 0.85)}>{char}</T>;
  return <Image source={picture} style={{ width: size, height: size }} contentFit="contain" accessible={false} />;
}
