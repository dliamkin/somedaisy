import { useEffect, useState, type ReactNode } from 'react';
import { Animated, BackHandler, Easing, Platform, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/lib/theme';

import { useReducedMotion } from './celebrate';
import { T } from './ui';

// Moving and fading can run off the main thread on phones. The web has no such thing.
const NATIVE = Platform.OS !== 'web';

/**
 * A box in the middle of the screen, over the page, which is dimmed behind it. For a question that
 * has to be answered before anything else happens, such as whether to delete a group. Tapping the
 * dimmed page, the phone's back button or the Escape key shuts it, unless `locked` says the answer
 * is being acted on.
 *
 * Like a sheet, it is drawn inside the page, not as a window of its own, so it has to be placed
 * last in the page's outermost box, after everything it should cover.
 */
export function Dialog({ title, onClose, locked, children }: { title: string; onClose: () => void; locked?: boolean; children: ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const [shown] = useState(() => new Animated.Value(0));

  useEffect(() => {
    // Wait to hear whether the person wants less motion. Those who do get the box in place at once.
    if (reduced === null) return;
    if (reduced) {
      shown.setValue(1);
      return;
    }
    const run = Animated.timing(shown, { toValue: 1, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE });
    run.start();
    return () => run.stop();
  }, [reduced, shown]);

  useEffect(() => {
    const shut = () => {
      if (!locked) onClose();
    };
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      shut();
      return true;
    });
    if (Platform.OS !== 'web' || typeof document === 'undefined') return () => back.remove();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') shut();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      back.remove();
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose, locked]);

  return (
    <View accessibilityViewIsModal style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }}>
      <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: shown }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" disabled={locked} onPress={onClose} style={{ flex: 1, backgroundColor: colors.scrim }} />
      </Animated.View>
      <Animated.View
        accessibilityRole="alert"
        style={{
          width: '100%',
          maxWidth: 420,
          maxHeight: height - insets.top - insets.bottom - 32,
          borderRadius: 28,
          backgroundColor: colors.card,
          boxShadow: `0 10px 30px ${colors.shadowStrong}`,
          opacity: shown,
          transform: [{ scale: shown.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }],
        }}>
        {/* On a short screen what it says scrolls, so its buttons can always be reached. */}
        <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
          <T size={22} weight="black" style={{ lineHeight: 26, letterSpacing: -0.3 }}>
            {title}
          </T>
          {children}
        </ScrollView>
      </Animated.View>
    </View>
  );
}
