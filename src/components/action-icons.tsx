import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';

import { colors } from '@/lib/theme';

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
} as const;

export type ActionIconName = keyof typeof DRAWINGS;

export function ActionIcon({ name, size = 22, color = colors.link }: { name: ActionIconName; size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <G fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
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
 */
export function IconAction({
  icon,
  label,
  onPress,
  text,
  strong,
}: {
  icon: ActionIconName;
  label: string;
  onPress: () => void;
  text?: string | null;
  strong?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const color = strong ? colors.pink : colors.link;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      hitSlop={4}
      style={({ pressed }) => ({ minWidth: 40, height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, flexShrink: text ? 1 : 0, opacity: pressed ? 0.6 : 1 })}>
      <ActionIcon name={icon} color={color} />
      {text ? (
        <T size={14} weight="extra" color={color} lines={1} style={{ flexShrink: 1 }}>
          {text}
        </T>
      ) : null}
      {hovered ? (
        // A wide, centred layer of its own, so the words are not squeezed to the icon's width.
        <View pointerEvents="none" style={{ position: 'absolute', bottom: 42, left: -110, right: -110, alignItems: 'center', zIndex: 2 }}>
          <View style={{ maxWidth: 220, backgroundColor: colors.text, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
            <T size={12} weight="extra" color={colors.white} lines={1}>
              {label}
            </T>
          </View>
        </View>
      ) : null}
    </Pressable>
  );
}
