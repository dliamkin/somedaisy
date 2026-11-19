import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

import { useTheme } from '@/lib/theme';

export function Daisy({ size = 36, petal, center }: { size?: number; petal?: string; center?: string }) {
  const { colors } = useTheme();
  const angles = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <Svg width={size} height={size} viewBox="0 0 36 36">
      {angles.map((a) => (
        <Ellipse key={a} cx={18} cy={8.1} rx={4.1} ry={6.8} fill={petal ?? colors.accent} transform={`rotate(${a} 18 18)`} />
      ))}
      <Circle cx={18} cy={18} r={5.1} fill={center ?? colors.daisyCenter} />
    </Svg>
  );
}

/**
 * The daisy on a group's cover, which grows with the group's rank: eight petals, one per rank.
 * The petals earned so far are filled in and the rest are dashed outlines. It has no face; the
 * face belongs to the logo only.
 */
export function RankDaisy({ earned, size = 56 }: { /** How many petals are filled in, from 1 to 8. */ earned: number; size?: number }) {
  const { colors } = useTheme();
  const angles = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {angles.map((a, i) =>
        i < earned ? (
          <Ellipse key={a} cx={50} cy={22} rx={11} ry={19} fill={colors.white} transform={`rotate(${a} 50 50)`} />
        ) : (
          <Ellipse key={a} cx={50} cy={22} rx={10} ry={18} fill="none" stroke={colors.white} strokeWidth={2} strokeDasharray="4 4" transform={`rotate(${a} 50 50)`} />
        ),
      )}
      <Circle cx={50} cy={50} r={13} fill={colors.daisyCenter} />
    </Svg>
  );
}

/** A tick, for something reached or done. */
export function CheckIcon({ color, size = 14 }: { color?: string; size?: number }) {
  const { colors } = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Path d="M4 10.5l4 4 8-9" fill="none" stroke={color ?? colors.onButton} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function BackIcon({ color }: { color?: string }) {
  const { colors } = useTheme();
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20">
      <Path d="M12.5 4l-6 6 6 6" fill="none" stroke={color ?? colors.text} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** An X, for closing a page that was opened to do one thing. */
export function CloseIcon({ color }: { color?: string }) {
  const { colors } = useTheme();
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20">
      <Path d="M5 5l10 10M15 5L5 15" fill="none" stroke={color ?? colors.text} strokeWidth={2.5} strokeLinecap="round" />
    </Svg>
  );
}

export function PlusIcon({ color, size = 20 }: { color?: string; size?: number }) {
  const { colors } = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Path d="M10 4v12M4 10h12" fill="none" stroke={color ?? colors.text} strokeWidth={2.5} strokeLinecap="round" />
    </Svg>
  );
}
