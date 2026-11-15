import { Image } from 'expo-image';
import { useState } from 'react';

import { usablePicture } from '@/lib/preview';
import { colors } from '@/lib/theme';

/**
 * The preview picture of the page an idea links to, across the top of its card. Shows nothing
 * when there is no picture or it will not load (a removed or blocked image), so a card is never
 * left with a broken frame.
 */
export function PreviewPicture({ uri, label }: { uri: string | null | undefined; label: string }) {
  // Remember the picture that failed, so a different one gets its own chance.
  const [broken, setBroken] = useState<string | null>(null);
  const picture = usablePicture(uri);
  if (!picture || broken === picture) return null;
  return (
    <Image
      source={{ uri: picture }}
      style={{ width: '100%', aspectRatio: 1.91, borderRadius: 16, backgroundColor: colors.ground }}
      contentFit="cover"
      accessibilityLabel={`Picture for ${label}`}
      onError={() => setBroken(picture)}
    />
  );
}
