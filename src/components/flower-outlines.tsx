import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

import { flowerField } from '@/lib/flower-field';
import { useTheme } from '@/lib/theme';

// A scattering of flowers drawn as thin white outlines, to sit softly behind a group's cover
// colour. Drawn in the app: there is no image file. Positions are fixed, so every cover looks
// the same from one visit to the next. The pattern is 480 wide and 72 tall, and is scaled to
// cover whatever space it is given.

type Flower = { kind: 'daisy' | 'bloom' | 'bud'; x: number; y: number; r: number; turn: number };

const FLOWERS: Flower[] = [
  { kind: 'daisy', x: 22, y: 14, r: 22, turn: 10 },
  { kind: 'bloom', x: 74, y: 58, r: 17, turn: 0 },
  { kind: 'bud', x: 58, y: 16, r: 9, turn: -20 },
  { kind: 'daisy', x: 128, y: 26, r: 16, turn: 25 },
  { kind: 'bud', x: 112, y: 64, r: 8, turn: 30 },
  { kind: 'bloom', x: 176, y: 6, r: 14, turn: 20 },
  { kind: 'daisy', x: 192, y: 60, r: 20, turn: -8 },
  { kind: 'bud', x: 226, y: 28, r: 9, turn: 10 },
  { kind: 'bloom', x: 262, y: 50, r: 16, turn: 36 },
  { kind: 'daisy', x: 284, y: 6, r: 15, turn: 0 },
  { kind: 'bud', x: 312, y: 66, r: 8, turn: -30 },
  { kind: 'daisy', x: 342, y: 36, r: 19, turn: 18 },
  { kind: 'bloom', x: 386, y: 4, r: 13, turn: 10 },
  { kind: 'bud', x: 392, y: 60, r: 9, turn: 15 },
  { kind: 'daisy', x: 462, y: 66, r: 18, turn: -12 },
  { kind: 'bloom', x: 470, y: 10, r: 14, turn: 50 },
];

const EIGHT = [0, 45, 90, 135, 180, 225, 270, 315];
const FIVE = [0, 72, 144, 216, 288];

function Outline({ flower }: { flower: Flower }) {
  const { kind, x, y, r, turn } = flower;
  if (kind === 'daisy') {
    return (
      <G transform={`rotate(${turn} ${x} ${y})`}>
        {EIGHT.map((a) => (
          <Ellipse key={a} cx={x} cy={y - r * 0.62} rx={r * 0.2} ry={r * 0.38} transform={`rotate(${a} ${x} ${y})`} />
        ))}
        <Circle cx={x} cy={y} r={r * 0.22} />
      </G>
    );
  }
  if (kind === 'bloom') {
    return (
      <G transform={`rotate(${turn} ${x} ${y})`}>
        {FIVE.map((a) => (
          <Circle key={a} cx={x} cy={y - r * 0.55} r={r * 0.42} transform={`rotate(${a} ${x} ${y})`} />
        ))}
        <Circle cx={x} cy={y} r={r * 0.2} />
      </G>
    );
  }
  // A bud on a short curved stem, with one leaf.
  return (
    <G transform={`rotate(${turn} ${x} ${y})`}>
      <Path d={`M ${x} ${y} q ${-r * 0.5} ${r * 0.9} ${r * 0.1} ${r * 1.9}`} />
      <Path d={`M ${x} ${y} c ${-r * 0.9} ${-r * 0.4} ${-r * 0.7} ${-r * 1.4} 0 ${-r * 1.5} c ${r * 0.7} ${r * 0.1} ${r * 0.9} ${r * 1.1} 0 ${r * 1.5} z`} />
      <Path d={`M ${x - r * 0.15} ${y + r} q ${r * 0.9} ${-r * 0.5} ${r * 1.2} ${r * 0.3} q ${-r * 0.8} ${r * 0.3} ${-r * 1.2} ${-r * 0.3} z`} />
    </G>
  );
}

/**
 * Fills the box it is placed in. Purely decorative: it takes no taps and is not read out.
 * `color` is the colour of the lines. `part` chooses which stretch of the pattern shows when the
 * box is narrower than the pattern, so boxes side by side do not all show the same flowers.
 */
export function FlowerOutlines({ opacity = 0.6, color, part = 'middle' }: { opacity?: number; color?: string; part?: 'start' | 'middle' | 'end' }) {
  const { colors } = useTheme();
  const align = part === 'start' ? 'xMinYMid' : part === 'end' ? 'xMaxYMid' : 'xMidYMid';
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity }}>
      <Svg width="100%" height="100%" viewBox="0 0 480 72" preserveAspectRatio={`${align} slice`}>
        <G fill="none" stroke={color ?? colors.white} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
          {FLOWERS.map((flower, i) => (
            <Outline key={i} flower={flower} />
          ))}
        </G>
      </Svg>
    </View>
  );
}

// How much of the flowers shows through. Low on purpose: they are a hint behind the words and
// buttons on top of them, not a pattern to look at.
const FAINT = 0.1;

/**
 * A flowery background for a box on a pale page: a button, a card, the band behind the pinned
 * buttons. Unlike the cover pattern above, the flowers are laid out for the box's own size, so
 * they are the same size and the same strength everywhere, and a tall box gets more flowers
 * instead of bigger ones. There is one look, on purpose: nothing to set but `shift`, which
 * shows a different stretch of flowers in boxes that sit side by side.
 */
export function FlowerField({ shift = 0 }: { shift?: number }) {
  const { colors } = useTheme();
  const [box, setBox] = useState({ width: 0, height: 0 });
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (Math.abs(width - box.width) > 0.5 || Math.abs(height - box.height) > 0.5) setBox({ width, height });
      }}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: FAINT }}>
      {box.width > 0 && box.height > 0 ? (
        <Svg width={box.width} height={box.height} viewBox={`0 0 ${box.width} ${box.height}`}>
          <G fill="none" stroke={colors.bloom} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            {flowerField(box.width, box.height, shift).map((flower, i) => (
              <Outline key={i} flower={flower} />
            ))}
          </G>
        </Svg>
      ) : null}
    </View>
  );
}
