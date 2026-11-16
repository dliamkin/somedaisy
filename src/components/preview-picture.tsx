import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable } from 'react-native';

import { usablePicture } from '@/lib/preview';
import { colors } from '@/lib/theme';

/**
 * The preview picture of the page an idea links to, across the top of its card. Shows nothing
 * when there is no picture or it will not load (a removed or blocked image), so a card is never
 * left with a broken frame. With `onPress`, tapping the picture opens the page it came from.
 */
export function PreviewPicture({ uri, label, onPress }: { uri: string | null | undefined; label: string; onPress?: () => void }) {
  // Remember the picture that failed, so a different one gets its own chance.
  const [broken, setBroken] = useState<string | null>(null);
  const picture = usablePicture(uri);
  if (!picture || broken === picture) return null;
  const image = (
    <Image
      source={{ uri: picture }}
      style={{ width: '100%', aspectRatio: 1.91, borderRadius: 16, backgroundColor: colors.ground }}
      contentFit="cover"
      accessibilityLabel={onPress ? undefined : `Picture for ${label}`}
      onError={() => setBroken(picture)}
    />
  );
  if (!onPress) return image;
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={`Open the link for ${label}`} onPress={onPress}>
      {image}
    </Pressable>
  );
}
