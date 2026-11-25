import { Image } from 'expo-image';
import { useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Platform, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { nameColor, nameSize, patternStrength, shapeStrength, type Cover as CoverData } from '@/lib/covers';
import { dark } from '@/lib/theme';

import { useReducedMotion } from './celebrate';
import { RankDaisy } from './daisy';
import { CoverFlowers } from './flower-outlines';
import { T } from './ui';

// A group's cover, drawn in the app: its colours, two round shapes, the flower pattern, the daisy
// that grows with the group's rank, and the group's name. One component for the three places a
// cover shows, so a group looks the same everywhere. The rules (which colour the name is, how big
// it is) are in src/lib/covers.ts. See docs/REDESIGN-HOME-AND-GROUP-2.md, section 1.

/** Where a cover is shown: on a group's card on Home, as the preview in the cover picker, or across the top of the group's own page. */
export type CoverPlace = 'card' | 'picker' | 'page';

type Shape = { size: number; top?: number; bottom?: number; left?: number; right?: number };

type Layout = {
  height: number;
  /** The size of a short name. A longer one is drawn smaller (see `nameSize`). */
  name: number;
  daisy: number;
  daisyRight: number;
  /** How far the daisy is from the top. Left out, it sits half way down. */
  daisyTop?: number;
  /** The name's distance from the left and bottom edges, where it is pinned to them. */
  left: number;
  bottom: number;
  /** The room kept clear at the right of the name, so it never runs under the daisy. */
  clear: number;
  shape1: Shape;
  shape2: Shape;
};

// The round shapes grow with the cover: about 95% and 90% of its height, hanging off the top right
// and the bottom left. The group's page has its own, set by hand, since its cover is much taller
// and a panel overlaps its bottom edge.
const grown = (height: number): Pick<Layout, 'shape1' | 'shape2'> => ({
  shape1: { size: Math.round(height * 0.947), right: -34, top: -Math.round(height * 0.25) },
  shape2: { size: Math.round(height * 0.9), left: -41, bottom: -Math.round(height * 0.45) },
});

/** The sizes of a cover in each place, as the design gives them. */
export const COVER: Record<CoverPlace, Layout> = {
  card: { height: 96, name: 26, daisy: 64, daisyRight: 14, left: 16, bottom: 12, clear: 92, ...grown(96) },
  picker: { height: 132, name: 30, daisy: 72, daisyRight: 16, left: 18, bottom: 16, clear: 92, ...grown(132) },
  page: {
    height: 222,
    name: 32,
    daisy: 84,
    daisyRight: 14,
    daisyTop: 92,
    left: 24,
    bottom: 0,
    clear: 106,
    shape1: { size: 190, right: -40, top: -30 },
    shape2: { size: 180, left: -50, bottom: -70 },
  },
};

// The fade over a photo: a little at the top, so the photo still shows, and deep at the bottom,
// behind the name. A flat dark layer would hide the photo.
const FADE = [
  { at: 0, strength: 0.1 },
  { at: 0.45, strength: 0.25 },
  { at: 1, strength: 0.78 },
];

/**
 * A group's cover.
 *
 * `photo` is where a photo cover's photo loads from, and what to keep it under on the device:
 * the caller works that out, since an uploaded photo needs an address asked for from storage (see
 * `useCoverPhotos`). The key stays the same when only the address changes, so the photo is kept
 * and not fetched again. Until the photo has loaded, and if it
 * will not load, the cover shows its colour and pattern instead, with the name in a colour that
 * can be read on them.
 *
 * `children` go under the name: the members and how many there are. Given as a function, they
 * are told the colour the name is in, so words beside it can match. On the group's page, `above`
 * is the row of round buttons over the cover, and `inset` is the room the clock and battery take
 * at the top of the screen, which the cover runs under.
 */
export function Cover({
  cover,
  place,
  name,
  earned,
  photo: source,
  above,
  inset = 0,
  children,
  style,
}: {
  cover: CoverData;
  place: CoverPlace;
  name: string;
  /** How many of the daisy's eight petals are filled in: one for each rank the group has reached. */
  earned: number;
  photo?: { uri: string; key?: string } | null;
  above?: ReactNode;
  inset?: number;
  children?: ReactNode | ((ink: string) => ReactNode);
  style?: StyleProp<ViewStyle>;
}) {
  const layout = COVER[place];
  // The photo that has loaded, and the one that would not, so a different photo gets its own chance.
  const [loaded, setLoaded] = useState<string | null>(null);
  const [broken, setBroken] = useState<string | null>(null);
  // Told apart by the key, so a new address for the same photo does not start it loading again.
  const mark = source ? (source.key ?? source.uri) : null;
  const photo = cover.kind === 'photo' && source && broken !== mark ? source : null;
  const showing = photo !== null && loaded === mark;
  const ink = nameColor(cover, showing);
  const size = nameSize(name, layout.name);
  const height = layout.height + inset;
  const below = typeof children === 'function' ? children(ink) : children;

  const title = (
    <T size={size} weight="black" color={ink} lines={2} style={{ lineHeight: Math.round(size * 1.08), letterSpacing: -0.6 }}>
      {name}
    </T>
  );

  return (
    <View style={[{ height, backgroundColor: cover.background, overflow: 'hidden' }, style]}>
      {cover.kind === 'look' ? (
        <>
          <Circle shape={layout.shape1} color={cover.shape1} />
          <Circle shape={layout.shape2} color={cover.shape2} opacity={shapeStrength(cover)} />
        </>
      ) : null}
      {cover.pattern && !showing ? <CoverFlowers opacity={patternStrength(cover)} /> : null}
      {photo ? (
        <Image
          source={{ uri: photo.uri, cacheKey: photo.key }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: showing ? 1 : 0 }}
          contentFit="cover"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          onLoad={() => setLoaded(mark)}
          onError={() => setBroken(mark)}
        />
      ) : null}
      {showing ? (
        <Svg pointerEvents="none" width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 1 1" style={{ position: 'absolute', top: 0, left: 0 }}>
          <Defs>
            <LinearGradient id="cover-fade" x1="0" y1="0" x2="0" y2="1">
              {FADE.map((stop) => (
                <Stop key={stop.at} offset={stop.at} stopColor={dark.background} stopOpacity={stop.strength} />
              ))}
            </LinearGradient>
          </Defs>
          <Rect width={1} height={1} fill="url(#cover-fade)" />
        </Svg>
      ) : null}
      <View
        // On the group's page the daisy can be tapped, for the fun of it. Anywhere else the cover is
        // a button itself, or a preview, and the daisy is only a picture.
        pointerEvents={place === 'page' ? 'box-none' : 'none'}
        aria-hidden
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          position: 'absolute',
          right: layout.daisyRight,
          top: layout.daisyTop === undefined ? (height - layout.daisy) / 2 : layout.daisyTop + inset,
        }}>
        {place === 'page' ? <TurningDaisy earned={earned} size={layout.daisy} /> : <RankDaisy earned={earned} size={layout.daisy} />}
      </View>
      {place === 'page' ? (
        // On the group's page the cover is the top of the screen: the buttons, then the name under them.
        // This box lies over the daisy, so taps on the empty parts of it are let through.
        <View pointerEvents="box-none" style={{ paddingTop: inset + 20, paddingHorizontal: layout.left }}>
          {above}
          <View style={{ marginTop: 20, marginRight: layout.clear - layout.left, gap: 8 }}>
            {title}
            {below}
          </View>
        </View>
      ) : (
        <View style={{ position: 'absolute', left: layout.left, right: layout.clear, bottom: layout.bottom, gap: 8 }}>
          {title}
          {below}
        </View>
      )}
    </View>
  );
}

// One turn of the daisy: how long it takes, and how it slows to a stop. Starting values from the
// design (`design_handoff_group_header_1d`), to be tuned by feel.
const TURN_MS = 700;
const TURN_EASE = Easing.bezier(0.2, 0.8, 0.2, 1);
// Turning can run off the main thread on phones. The web has no such thing.
const NATIVE = Platform.OS !== 'web';

/**
 * The daisy on the group's page, which spins once when tapped. It leads nowhere. A tap while it
 * is still turning adds another turn to the one under way, and does not start it again. People
 * who have asked their device for less motion get a daisy that stands still.
 *
 * It is left out of what a keyboard and a screen reader step through: it does nothing they could
 * use. Every tap is counted, turning or not, for a surprise that may be hung on the count later.
 * Nothing reads the count yet.
 */
function TurningDaisy({ earned, size }: { earned: number; size: number }) {
  const reduced = useReducedMotion();
  const [turns] = useState(() => new Animated.Value(0));
  // The turns asked for since the daisy last stood still, and every tap since the page opened.
  const asked = useRef(0);
  const taps = useRef(0);

  const tapped = () => {
    taps.current += 1;
    // Still until the device has said it is not asking for less motion.
    if (reduced !== false) return;
    asked.current += 1;
    turns.stopAnimation((now) => {
      const goal = asked.current;
      Animated.timing(turns, { toValue: goal, duration: TURN_MS * Math.max(0.5, goal - now), easing: TURN_EASE, useNativeDriver: NATIVE }).start(({ finished }) => {
        // A whole number of turns looks the same as none, so the count starts again from there.
        if (!finished || asked.current !== goal) return;
        asked.current = 0;
        turns.setValue(0);
      });
    });
  };

  return (
    <Pressable accessible={false} focusable={false} tabIndex={-1} onPress={tapped} style={Platform.OS === 'web' ? ({ cursor: 'default' } as object) : null}>
      <Animated.View style={{ transform: [{ rotate: turns.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
        <RankDaisy earned={earned} size={size} />
      </Animated.View>
    </Pressable>
  );
}

function Circle({ shape, color, opacity = 1 }: { shape: Shape; color: string; opacity?: number }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: shape.size,
        height: shape.size,
        borderRadius: shape.size / 2,
        backgroundColor: color,
        opacity,
        top: shape.top,
        bottom: shape.bottom,
        left: shape.left,
        right: shape.right,
      }}
    />
  );
}
