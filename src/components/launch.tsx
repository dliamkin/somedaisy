import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Animated, Platform, View } from 'react-native';

import { useTheme } from '@/lib/theme';

/** The width of the mark on the phone's own splash screen. Keep in step with imageWidth in app.json. */
const MARK = 120;
// The name and line under the mark. The picture is 900 x 400.
const WORDS_WIDTH = 250;
const WORDS_HEIGHT = (WORDS_WIDTH * 400) / 900;

/**
 * The app's opening screen. A phone can only show one small picture on a plain colour while an
 * app starts, so this carries on from exactly there: the same violet with the same mark in the
 * same place, and the name and "Turn someday into a day." fading in underneath.
 */
export function Launch() {
  // The violet behind the phone's own splash screen. Keep `logoTile` in step with expo-splash-screen in app.json.
  const { colors } = useTheme();
  const fade = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 350, delay: 120, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [fade]);

  return (
    <View accessible accessibilityLabel="SomeDaisy. Turn someday into a day." style={{ flex: 1, backgroundColor: colors.logoTile, alignItems: 'center', justifyContent: 'center' }}>
      <Image source={require('../../assets/images/splash-icon.png')} style={{ width: MARK, height: MARK }} contentFit="contain" />
      {/* Hung below the mark instead of stacked with it, so the mark stays dead centre where the phone drew it. */}
      <Animated.View style={{ position: 'absolute', top: '50%', marginTop: MARK / 2 + 22, opacity: fade }}>
        <Image source={require('../../assets/images/launch-words.png')} style={{ width: WORDS_WIDTH, height: WORDS_HEIGHT }} contentFit="contain" />
      </Animated.View>
    </View>
  );
}
