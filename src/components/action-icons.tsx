import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';

import { useTheme } from '@/lib/theme';

import { T } from './ui';

// The small icons for what you can do with an idea, and for inviting people. Drawn here as thin
// rounded lines on a 24 by 24 grid, the same way as the list icons, so they look the same on
// every phone and in every browser. There are no image files and no emoji.
const dot = (x: number, y: number, r: number) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0`;

const DRAWINGS = {
  // A speech bubble with three dots.
  comment: ['M5 4.5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-6.5L8 20.5v-4H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z', dot(8.5, 10.5, 0.4), dot(12, 10.5, 0.4), dot(15.5, 10.5, 0.4)],
  // A calendar page with one day marked.
  date: ['M5 5.5h14a2 2 0 0 1 2 2V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7.5a2 2 0 0 1 2-2z', 'M3 10.5h18M8 3v4M16 3v4', 'M9.5 15.5l2 2 3.5-4'],
  // An arrow leaving a tray.
  share: ['M12 15V3.5', 'M7.5 8L12 3.5 16.5 8', 'M5 12.5V19a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6.5'],
  // A pencil.
  edit: ['M4 20l1.2-4.8L16.5 4a2.1 2.1 0 0 1 3 3L8.3 18.3z', 'M14.5 6l3 3'],
  // A person with a plus beside them.
  invite: [dot(9.5, 8, 3.5), 'M3 20.5a6.5 6.5 0 0 1 13 0', 'M19.5 7.5v6M16.5 10.5h6'],
  // A thumbs up, and the same hand turned over.
  up: ['M3 10.5h3.5v10H3z', 'M6.5 10.5l4-7a2.2 2.2 0 0 1 3 2.6l-.7 3.4h5.7a2 2 0 0 1 1.95 2.45l-1.6 7a2 2 0 0 1-1.95 1.55H6.5'],
  down: ['M3 3.5h3.5v10H3z', 'M6.5 13.5l4 7a2.2 2.2 0 0 0 3-2.6l-.7-3.4h5.7a2 2 0 0 0 1.95-2.45l-1.6-7a2 2 0 0 0-1.95-1.55H6.5'],
  // Three lines with a dot before each: every list, one under the other.
  lists: [dot(4.5, 6.5, 0.6), dot(4.5, 12, 0.6), dot(4.5, 17.5, 0.6), 'M9 6.5h11.5M9 12h11.5M9 17.5h11.5'],
  // A smiling face with a plus beside it.
  emoji: [dot(10.5, 13.5, 7.5), dot(8, 12, 0.4), dot(13, 12, 0.4), 'M7.5 15.5a3.6 3.6 0 0 0 6 0', 'M20 2.5v5M17.5 5h5'],
} as const;

export type ActionIconName = keyof typeof DRAWINGS;

// The widest the words over an icon can be.
const TIP_WIDTH = 220;

export function ActionIcon({ name, size = 22, color }: { name: ActionIconName; size?: number; color?: string }) {
  const { colors } = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <G fill="none" stroke={color ?? colors.link} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
        {DRAWINGS[name].map((d, i) => (
          <Path key={i} d={d} />
        ))}
      </G>
    </Svg>
  );
}

/**
 * An icon that does something to an idea. It has no words on show, so `label` says what it does:
 * a screen reader reads it out, and on a computer it appears above the icon while the pointer is
 * over it. `text` is for the few words that do belong beside the icon, such as a count or a date.
 * `on` is for an icon that is a choice, such as a thumbs up: true once this person has chosen it,
 * which fills in behind the icon, and false while they have not.
 * `tip` says which way the words over the icon spread. Centred over an icon at the edge of a
 * card, half of them would run off the side of the page and be cut off. So an icon near the
 * left edge takes "start" (the words begin at the icon and run right) and one near the right
 * edge takes "end".
 */
export function IconAction({
  icon,
  label,
  onPress,
  text,
  strong,
  on,
  tip = 'center',
}: {
  icon: ActionIconName;
  label: string;
  onPress: () => void;
  text?: string | null;
  strong?: boolean;
  on?: boolean;
  tip?: 'start' | 'center' | 'end';
}) {
  const { colors } = useTheme();
  const [hovered, setHovered] = useState(false);
  const color = strong ? colors.accent : colors.link;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={on === undefined ? undefined : { selected: on }}
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      hitSlop={4}
      style={({ pressed }) => ({
        minWidth: 40,
        height: 44,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        flexShrink: text ? 1 : 0,
        opacity: pressed ? 0.6 : 1,
        // A chosen one gets the same fill and edge as a chosen vote chip.
        borderRadius: 22,
        paddingHorizontal: on === undefined ? 0 : 6,
        borderWidth: on === undefined ? 0 : 2,
        borderColor: on ? colors.button : 'transparent',
        backgroundColor: on ? colors.voteOn : 'transparent',
      })}>
      <ActionIcon name={icon} color={color} />
      {text ? (
        <T size={14} weight="extra" color={color} lines={1} style={{ flexShrink: 1 }}>
          {text}
        </T>
      ) : null}
      {hovered ? (
        // A wide layer of its own, so the words are not squeezed to the icon's width.
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            bottom: 42,
            left: tip === 'start' ? 0 : tip === 'end' ? -TIP_WIDTH : -TIP_WIDTH / 2,
            right: tip === 'end' ? 0 : tip === 'start' ? -TIP_WIDTH : -TIP_WIDTH / 2,
            alignItems: tip === 'start' ? 'flex-start' : tip === 'end' ? 'flex-end' : 'center',
            zIndex: 2,
          }}>
          <View style={{ maxWidth: TIP_WIDTH, backgroundColor: colors.tabOn, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
            <T size={12} weight="extra" color={colors.onTabOn} lines={1}>
              {label}
            </T>
          </View>
        </View>
      ) : null}
    </Pressable>
  );
}
