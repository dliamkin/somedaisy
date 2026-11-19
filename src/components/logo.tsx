import { Image } from 'expo-image';
import { View } from 'react-native';

import { useTheme } from '@/lib/theme';

// The horizontal logo file is 1941 x 448: the daisy icon with the SomeDaisy wordmark beside it.
const RATIO = 1941 / 448;

export function Logo({ height = 40 }: { height?: number }) {
  const { colors, dark } = useTheme();
  const width = Math.round(height * RATIO);
  if (!dark) {
    return (
      <Image
        source={require('../../assets/logo/somedaisy-logo-horizontal.png')}
        style={{ height, width }}
        contentFit="contain"
        accessibilityLabel="SomeDaisy"
      />
    );
  }
  // In dark mode the name is drawn in the page's light text colour, since its own deep plum would
  // not show. The tile and the daisy do not change. The two are placed where they sit in the
  // one-piece logo, which is 485.25 by 112 on its own grid.
  const u = height / 112;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel="SomeDaisy" style={{ height, width }}>
      <Image source={require('../../assets/icon/rounded/somedaisy-icon-512.png')} style={{ position: 'absolute', left: 6 * u, top: 6 * u, width: 100 * u, height: 100 * u }} contentFit="contain" />
      <Image
        source={require('../../assets/logo/somedaisy-wordmark.png')}
        tintColor={colors.text}
        style={{ position: 'absolute', left: 124.55 * u, top: 4.64 * u, width: 361.45 * u, height: 103.07 * u }}
        contentFit="contain"
      />
    </View>
  );
}
