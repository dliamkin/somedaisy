import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';

import { colors, fonts } from '@/lib/theme';

import { useReducedMotion } from './celebrate';

const HEIGHT = 44;
const SIDE = 16; // the space either side of the words, edge included
const TIME = 420;

/**
 * A chip that turns into another one in place, for a button that becomes its own confirmation.
 * Like a slot machine: the old words drop out through the bottom of the chip, then the new words
 * slide up into place with a small settle. All the while the chip glides straight to its new
 * width and colour, stretching for longer words and narrowing for shorter ones.
 *
 * A tap only counts once the change has finished, so tapping twice quickly cannot confirm
 * something the person has not had time to read. People who have asked for less motion get the
 * new chip at once.
 */
export function MorphChip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  const reduced = useReducedMotion();
  // The words on show, and the words they are replacing while a change is under way.
  const [current, setCurrent] = useState(label);
  const [leaving, setLeaving] = useState<string | null>(null);
  const [settled, setSettled] = useState(true);
  // How wide the words are, kept with the words it was measured for.
  const [measured, setMeasured] = useState<{ text: string; width: number } | null>(null);
  const [swap] = useState(() => new Animated.Value(1));
  const [width] = useState(() => new Animated.Value(0));
  const [tint] = useState(() => new Animated.Value(selected ? 1 : 0));
  const [sized, setSized] = useState(false);

  // New words have arrived: remember the old ones so they can be seen leaving.
  if (label !== current) {
    setLeaving(current);
    setCurrent(label);
    setSettled(false);
  }

  // Once the new words have been measured, glide to their width and swap the words over.
  useEffect(() => {
    // Wait for the measurement of the words now on show, not the ones before them.
    if (measured === null || measured.text !== current || reduced === null) return;
    const target = Math.ceil(measured.width) + SIDE * 2;
    if (!sized || reduced) {
      width.setValue(target);
      swap.setValue(1);
      tint.setValue(selected ? 1 : 0);
      const done = setTimeout(() => {
        setSized(true);
        setLeaving(null);
        setSettled(true);
      }, 0);
      return () => clearTimeout(done);
    }
    swap.setValue(0);
    const ease = Easing.out(Easing.cubic);
    const run = Animated.parallel([
      Animated.timing(width, { toValue: target, duration: TIME, easing: ease, useNativeDriver: false }),
      // Steady, because the two halves of the swap each have their own easing below.
      Animated.timing(swap, { toValue: 1, duration: TIME, easing: Easing.linear, useNativeDriver: false }),
      Animated.timing(tint, { toValue: selected ? 1 : 0, duration: TIME, easing: ease, useNativeDriver: false }),
    ]);
    run.start(({ finished }) => {
      if (!finished) return;
      setLeaving(null);
      setSettled(true);
    });
    return () => run.stop();
    // `sized` only matters the first time; leaving it out stops the first measure from replaying.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measured, current, selected, reduced, width, swap, tint]);

  const words = { fontFamily: fonts.extra, fontSize: 15, color: colors.text } as const;
  const layer = { position: 'absolute', top: 0, bottom: 0, left: -400, right: -400, alignItems: 'center', justifyContent: 'center' } as const;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: Boolean(selected) }}
      onPress={settled ? onPress : undefined}>
      {/* Measures the new words without showing them, so the chip knows how wide to become. */}
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', opacity: 0, flexDirection: 'row' }}>
        <Text key={current} numberOfLines={1} style={words} onLayout={(e) => setMeasured({ text: current, width: e.nativeEvent.layout.width })}>
          {current}
        </Text>
      </View>
      <Animated.View
        style={{
          height: HEIGHT,
          width: sized ? width : undefined,
          minWidth: sized ? undefined : HEIGHT,
          borderRadius: HEIGHT / 2,
          borderWidth: 2,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
          borderColor: tint.interpolate({ inputRange: [0, 1], outputRange: ['rgba(184, 51, 154, 0)', colors.pink] }),
          backgroundColor: tint.interpolate({ inputRange: [0, 1], outputRange: [colors.white, colors.pinkTint] }),
        }}>
        {sized ? (
          // Both sets of words sit in a wide, centred layer of their own, so neither is squeezed
          // or cut short while the chip is between widths. The chip's edge clips them.
          <>
            {leaving !== null ? (
              <View pointerEvents="none" style={layer}>
                <Animated.Text
                  numberOfLines={1}
                  style={[words, { transform: [{ translateY: swap.interpolate({ inputRange: [0, 0.5], outputRange: [0, HEIGHT], easing: Easing.in(Easing.quad), extrapolate: 'clamp' }) }] }]}>
                  {leaving}
                </Animated.Text>
              </View>
            ) : null}
            <View pointerEvents="none" style={layer}>
              <Animated.Text
                numberOfLines={1}
                style={[words, { transform: [{ translateY: swap.interpolate({ inputRange: [0.45, 1], outputRange: [HEIGHT, 0], easing: Easing.out(Easing.back(1.6)), extrapolate: 'clamp' }) }] }]}>
                {current}
              </Animated.Text>
            </View>
          </>
        ) : (
          // Before the first measurement the chip simply fits its words.
          <Text numberOfLines={1} style={[words, { paddingHorizontal: SIDE - 2 }]}>
            {current}
          </Text>
        )}
      </Animated.View>
    </Pressable>
  );
}
