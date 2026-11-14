import { Image } from 'expo-image';

// The horizontal logo file is 1941 x 448: the daisy icon with the SomeDaisy wordmark beside it.
const RATIO = 1941 / 448;

export function Logo({ height = 40 }: { height?: number }) {
  return (
    <Image
      source={require('../../assets/logo/somedaisy-logo-horizontal.png')}
      style={{ height, width: Math.round(height * RATIO) }}
      contentFit="contain"
      accessibilityLabel="SomeDaisy"
    />
  );
}
