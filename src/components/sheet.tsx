import { useEffect, useState, type ReactNode } from 'react';
import { Animated, BackHandler, Easing, KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/lib/theme';

import { useReducedMotion } from './celebrate';
import { T } from './ui';

// Moving and fading can run off the main thread on phones. The web has no such thing.
const NATIVE = Platform.OS !== 'web';

/**
 * A panel that slides up from the bottom of the screen over the page, which is dimmed behind it.
 * For a few choices about one thing, or a closer look at it, without leaving the page. Tapping
 * the dimmed page, the phone's back button or the Escape key shuts it. It rides above the
 * keyboard, for a panel with a box to type in, and for one opened while the keyboard is up.
 *
 * It is drawn inside the page, not as a window of its own, so it has to be placed last in the
 * page's outermost box, after everything it should cover.
 */
export function Sheet({ title, onClose, children }: { title?: string; onClose: () => void; children: ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [shown] = useState(() => new Animated.Value(0));

  useEffect(() => {
    // Wait to hear whether the person wants less motion. Those who do get the panel in place at once.
    if (reduced === null) return;
    if (reduced) {
      shown.setValue(1);
      return;
    }
    const run = Animated.timing(shown, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE });
    run.start();
    return () => run.stop();
  }, [reduced, shown]);

  useEffect(() => {
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    if (Platform.OS !== 'web' || typeof document === 'undefined') return () => back.remove();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      back.remove();
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <View accessibilityViewIsModal style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: shown }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={{ flex: 1, backgroundColor: colors.scrim }} />
      </Animated.View>
      {/* Only the panel is in here, and taps beside it go through to the dimmed page behind. */}
      <KeyboardAvoidingView behavior="padding" pointerEvents="box-none" style={{ flex: 1, justifyContent: 'flex-end' }}>
      <Animated.View
        style={{
          width: '100%',
          maxWidth: 480,
          alignSelf: 'center',
          opacity: shown,
          transform: [{ translateY: shown.interpolate({ inputRange: [0, 1], outputRange: [48, 0] }) }],
        }}>
        <View
          style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: 30,
            borderTopRightRadius: 30,
            paddingTop: 10,
            paddingHorizontal: 16,
            paddingBottom: insets.bottom + 20,
            gap: 10,
            boxShadow: `0 -10px 30px ${colors.shadowStrong}`,
          }}>
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: colors.line, alignSelf: 'center' }} />
          {title ? (
            <T size={20} weight="black" lines={2} style={{ paddingHorizontal: 4 }}>
              {title}
            </T>
          ) : null}
          {children}
        </View>
      </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

/** One thing to do, as a row on a sheet: a small picture, then what it does. */
export function SheetRow({ icon, label, onPress }: { icon: ReactNode; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 12, borderRadius: 16, backgroundColor: pressed ? colors.background : 'transparent' })}>
      {icon}
      <T size={16} weight="extra">
        {label}
      </T>
    </Pressable>
  );
}
