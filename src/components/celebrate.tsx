// The moving parts of a celebration: a full-screen sheet, a burst of confetti, things that pop
// in, and daisies that bloom from a card's corners. All drawn in the app, with no image files.
//
// People who have asked their phone to reduce motion get the same screens standing still.

import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, ScrollView, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '@/lib/theme';

import { Daisy } from './daisy';

// Moving and fading can run off the main thread on phones. The web has no such thing.
const NATIVE = Platform.OS !== 'web';

/** Whether the person has asked for less motion. Null until the phone has answered. */
export function useReducedMotion(): boolean | null {
  const [reduced, setReduced] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then(
      (on) => alive && setReduced(on),
      () => alive && setReduced(false),
    );
    return () => {
      alive = false;
    };
  }, []);
  return reduced;
}

/**
 * A full-screen grape sheet over the page, with its contents in a centred, phone-width column.
 * It scrolls, so nothing is cut off on a small phone. `behind` is drawn over the whole sheet,
 * under the contents, and is where confetti goes.
 */
export function Overlay({ children, behind }: { children: ReactNode; behind?: ReactNode }) {
  return (
    <View accessibilityViewIsModal style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.grape }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 28 }}>
        <View style={{ width: '100%', maxWidth: 420, alignSelf: 'center', alignItems: 'stretch', gap: 18 }}>{children}</View>
      </ScrollView>
      {behind}
    </View>
  );
}

const CONFETTI = [colors.white, colors.yellow, '#FFD25A', colors.pinkTint, '#F58FB8', colors.mint, colors.sky, colors.today];

type Piece = { x: number; lift: number; drift: number; spin: number; size: number; round: boolean; color: string; late: number };

function makePieces(count: number): Piece[] {
  return Array.from({ length: count }, (_, i) => ({
    x: Math.random() * 2 - 1, // how far left or right of centre it flies, from -1 to 1
    lift: 0.25 + Math.random() * 0.45, // how high it is thrown, as a share of the screen
    drift: Math.random() * 0.3 - 0.15,
    spin: (Math.random() * 4 + 2) * (Math.random() < 0.5 ? -1 : 1),
    size: 8 + Math.random() * 8,
    round: Math.random() < 0.35,
    color: CONFETTI[i % CONFETTI.length],
    late: Math.random() * 0.18, // a ragged start, so it is a burst and not a wall
  }));
}

/**
 * One burst of confetti over the whole sheet: thrown up from the middle, then falling away.
 * It never gets in the way of a tap, and is not announced by a screen reader.
 */
export function Confetti({ count = 44, delay = 150 }: { count?: number; delay?: number }) {
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const [pieces] = useState(() => makePieces(count));
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reduced !== false) return;
    const run = Animated.timing(progress, { toValue: 1, duration: 3200, delay, easing: Easing.linear, useNativeDriver: NATIVE });
    run.start();
    return () => run.stop();
  }, [reduced, progress, delay]);

  if (reduced !== false) return null;

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
      {pieces.map((p, i) => {
        const start = p.late;
        const top = Math.min(0.95, start + 0.28);
        const reach = Math.min(width, 900) * 0.5;
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: width / 2 - p.size / 2,
              top: height * 0.34,
              width: p.size,
              height: p.round ? p.size : p.size * 0.55,
              borderRadius: p.round ? p.size / 2 : 2,
              backgroundColor: p.color,
              opacity: progress.interpolate({ inputRange: [0, start, start + 0.02, 0.8, 1], outputRange: [0, 0, 1, 1, 0], extrapolate: 'clamp' }),
              transform: [
                { translateX: progress.interpolate({ inputRange: [start, 1], outputRange: [0, (p.x + p.drift) * reach], extrapolate: 'clamp' }) },
                {
                  translateY: progress.interpolate({
                    inputRange: [start, top, 1],
                    outputRange: [0, -height * p.lift * 0.6, height * 0.75],
                    extrapolate: 'clamp',
                  }),
                },
                { rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${Math.round(p.spin * 360)}deg`] }) },
              ],
            }}
          />
        );
      })}
    </View>
  );
}

/** Its contents pop in with a little bounce, after `delay`. */
export function PopIn({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const [scale] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reduced === null) return;
    if (reduced) {
      scale.setValue(1);
      return;
    }
    const run = Animated.sequence([Animated.delay(delay), Animated.spring(scale, { toValue: 1, friction: 5, tension: 90, useNativeDriver: NATIVE })]);
    run.start();
    return () => run.stop();
  }, [reduced, scale, delay]);

  return (
    <Animated.View style={[style, { opacity: scale.interpolate({ inputRange: [0, 0.4], outputRange: [0, 1], extrapolate: 'clamp' }), transform: [{ scale }] }]}>
      {children}
    </Animated.View>
  );
}

type Corner = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

const CORNERS: Record<Corner, ViewStyle> = {
  topLeft: { top: -18, left: -14 },
  topRight: { top: -20, right: -12 },
  bottomLeft: { bottom: -16, left: -10 },
  bottomRight: { bottom: -18, right: -14 },
};

/** A daisy that blooms out of one corner of the card it is placed in: it grows and turns as it opens. */
function Bloom({ corner, size, delay, petal }: { corner: Corner; size: number; delay: number; petal: string }) {
  const reduced = useReducedMotion();
  const [open] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reduced === null) return;
    if (reduced) {
      open.setValue(1);
      return;
    }
    const run = Animated.sequence([Animated.delay(delay), Animated.spring(open, { toValue: 1, friction: 4, tension: 60, useNativeDriver: NATIVE })]);
    run.start();
    return () => run.stop();
  }, [reduced, open, delay]);

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        { position: 'absolute' },
        CORNERS[corner],
        {
          opacity: open.interpolate({ inputRange: [0, 0.3], outputRange: [0, 1], extrapolate: 'clamp' }),
          transform: [{ scale: open }, { rotate: open.interpolate({ inputRange: [0, 1], outputRange: ['-120deg', '0deg'] }) }],
        },
      ]}>
      <Daisy size={size} petal={petal} />
    </Animated.View>
  );
}

/**
 * Wraps a card so daisies bloom from its corners, one after another, starting at `delay`.
 * The card itself is passed in and is not changed.
 */
export function Blooming({ children, delay = 0, corners = ['topRight', 'bottomLeft'] }: { children: ReactNode; delay?: number; corners?: Corner[] }) {
  const petals = [colors.white, colors.pinkTint, colors.sky, colors.white];
  const sizes = [44, 36, 30, 38];
  return (
    <View>
      {children}
      {corners.map((corner, i) => (
        <Bloom key={corner} corner={corner} size={sizes[i % sizes.length]} delay={delay + i * 220} petal={petals[i % petals.length]} />
      ))}
    </View>
  );
}
