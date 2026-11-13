import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

import { colors } from '@/lib/theme';

export function Daisy({ size = 36, petal = colors.pink, center = '#FFD25A' }: { size?: number; petal?: string; center?: string }) {
  const angles = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <Svg width={size} height={size} viewBox="0 0 36 36">
      {angles.map((a) => (
        <Ellipse key={a} cx={18} cy={8.1} rx={4.1} ry={6.8} fill={petal} transform={`rotate(${a} 18 18)`} />
      ))}
      <Circle cx={18} cy={18} r={5.1} fill={center} />
    </Svg>
  );
}

export function BackIcon({ color = colors.text }: { color?: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20">
      <Path d="M12.5 4l-6 6 6 6" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function PlusIcon({ color = colors.text, size = 20 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Path d="M10 4v12M4 10h12" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
    </Svg>
  );
}
