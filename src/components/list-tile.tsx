import { View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { blendFor, type IconName } from '@/lib/looks';
import { shadow } from '@/lib/theme';

// The icons are drawn here, in the app, as thin rounded lines on a 24 by 24 grid. There are no
// image files. Each is a handful of line paths; `dot` makes a small circle as a path.
const dot = (x: number, y: number, r: number) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0`;

const DRAWINGS: Record<Exclude<IconName, 'daisy'>, string[]> = {
  movie: ['M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M3.2 10.4L20 6l-.9-3.2L2.3 7.3z', 'M8 5.8l2 3M13.2 4.4l2 3'],
  tv: ['M4 7h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z', 'M8 3l4 4 4-4', 'M8 22h8'],
  popcorn: ['M6 9l1.5 12h9L18 9z', 'M6 9a2.5 2.5 0 0 1 3-3 3 3 0 0 1 6 0 2.5 2.5 0 0 1 3 3', 'M10 9.5l.5 11M14 9.5l-.5 11'],
  ticket: ['M3 7h18v3.5a1.5 1.5 0 0 0 0 3V17H3v-3.5a1.5 1.5 0 0 0 0-3z', 'M14 7.5v2M14 11v2M14 14.5v2'],
  music: ['M9 18V5l11-2v13', dot(6.5, 18, 2.5), dot(17.5, 16, 2.5)],
  mic: ['M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3z', 'M6 11a6 6 0 0 0 12 0', 'M12 17v4M9 21h6'],
  food: ['M3 11h18a9 9 0 0 1-18 0z', 'M9 21h6', 'M9 7c-1-1.5 1-2.5 0-4M14 7c-1-1.5 1-2.5 0-4'],
  pizza: ['M12 21L3.5 6.5a17 17 0 0 1 17 0z', dot(10, 9.5, 1), dot(14, 10.5, 1), dot(12, 14.5, 1)],
  cake: ['M4 13h16v7a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z', 'M4 16.5c2 1.5 3.5 1.5 5.3 0 1.8 1.5 3.6 1.5 5.4 0 1.8 1.5 3.3 1.5 5.3 0', 'M12 13V8.5', 'M12 5.5c-1.2-1.5 0-2.5 0-3.5 0 1 1.2 2 0 3.5z'],
  coffee: ['M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z', 'M17 10h1.5a2.5 2.5 0 0 1 0 5H17', 'M8 5.5c-1-1 1-2 0-3M12 5.5c-1-1 1-2 0-3'],
  cocktail: ['M4 4h16l-8 9z', 'M12 13v7', 'M8 20.5h8', 'M7 7.5h10'],
  pin: ['M12 22c-5-6-7-9.5-7-12.5a7 7 0 0 1 14 0c0 3-2 6.5-7 12.5z', dot(12, 9.5, 2.5)],
  map: ['M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z', 'M9 4v14M15 6v14'],
  car: ['M3 16v-3l2-5a2 2 0 0 1 2-1h10a2 2 0 0 1 2 1l2 5v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z', 'M3.5 12.5h17', 'M6 17v2M18 17v2', dot(7, 14.7, 0.5), dot(17, 14.7, 0.5)],
  bus: ['M6 3h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'M4 11h16', 'M7.5 18L6 21M16.5 18l1.5 3', dot(8, 14.5, 0.5), dot(16, 14.5, 0.5)],
  plane: ['M21 3L3 10.5l7 2.5 2.5 7z', 'M21 3L10 13'],
  suitcase: ['M4 8h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z', 'M9 8V5.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V8', 'M3 13h18'],
  globe: [dot(12, 12, 9), 'M3 12h18', 'M12 3c-3.5 3.5-3.5 14.5 0 18 3.5-3.5 3.5-14.5 0-18z'],
  mountain: ['M2 20l7-12 4 6 2-3 7 9z', dot(17.5, 5.5, 2)],
  tent: ['M12 4L2.5 20h19z', 'M12 12l-3.5 8h7z', 'M12 4V2.2'],
  tree: ['M12 3l6 8h-3l4 6H5l4-6H6z', 'M12 17v4'],
  wave: ['M2 9c2.5-3 5-3 7.5 0s5 3 7.5 0 3.5-2 5-1', 'M2 15.5c2.5-3 5-3 7.5 0s5 3 7.5 0 3.5-2 5-1'],
  sun: [dot(12, 12, 4), 'M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8'],
  moon: ['M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z'],
  snowflake: ['M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8l16.4-9.6', 'M9.5 4l2.5 2 2.5-2M9.5 20l2.5-2 2.5 2'],
  dice: ['M6 3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z', dot(8.5, 8.5, 0.5), dot(15.5, 8.5, 0.5), dot(12, 12, 0.5), dot(8.5, 15.5, 0.5), dot(15.5, 15.5, 0.5)],
  gamepad: ['M7 8h10a5 5 0 0 1 5 5v1a3.5 3.5 0 0 1-6.3 2.1L15 15H9l-.7 1.1A3.5 3.5 0 0 1 2 14v-1a5 5 0 0 1 5-5z', 'M6.5 12h3M8 10.5v3', dot(15.5, 11.2, 0.5), dot(17.5, 13, 0.5)],
  ball: [dot(12, 12, 9), 'M12 3c3 3 3 15 0 18', 'M3 12c3-3 15-3 18 0'],
  bike: [dot(6, 16, 3.5), dot(18, 16, 3.5), 'M6 16l3.5-7h5M18 16l-3.5-7-4.5 7', 'M8 6.5h3M14.5 9l-1-3h2'],
  dumbbell: ['M6.5 7v10M3.5 9.5v5M17.5 7v10M20.5 9.5v5M6.5 12h11'],
  book: ['M12 6c-2-1.5-5-2-8-2v14c3 0 6 .5 8 2 2-1.5 5-2 8-2V4c-3 0-6 .5-8 2z', 'M12 6v14'],
  pencil: ['M4 20l1.2-4.8L16.5 4a2.1 2.1 0 0 1 3 3L8.3 18.3z', 'M14.5 6l3 3'],
  camera: ['M4 7h3l2-3h6l2 3h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z', dot(12, 13, 3.5)],
  bag: ['M5 8h14l1 12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z', 'M9 8V7a3 3 0 0 1 6 0v1'],
  gift: ['M4 11h16v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z', 'M3 7h18v4H3z', 'M12 7v14', 'M12 7c-1.5-4-6-4-5-1 .5 1.2 2.5 1 5 1zm0 0c1.5-4 6-4 5-1-.5 1.2-2.5 1-5 1z'],
  home: ['M3 11l9-8 9 8', 'M5 9.5V20h14V9.5', 'M10 20v-6h4v6'],
  bed: ['M3 18V7M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5', dot(7, 11, 1.8)],
  people: [dot(8.5, 8, 3), 'M3 20a5.5 5.5 0 0 1 11 0', dot(17, 9, 2.5), 'M15.5 14.2A4.5 4.5 0 0 1 21 18.5'],
  heart: ['M12 20.5C5 15.5 3 12 3 8.8A4.8 4.8 0 0 1 12 6.5 4.8 4.8 0 0 1 21 8.8c0 3.2-2 6.7-9 11.7z'],
  star: ['M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8 6.6 19.7l1.1-6.1L3.2 9.4l6.1-.8z'],
  sparkle: ['M12 3l1.8 5.2a3 3 0 0 0 2 2L21 12l-5.2 1.8a3 3 0 0 0-2 2L12 21l-1.8-5.2a3 3 0 0 0-2-2L3 12l5.2-1.8a3 3 0 0 0 2-2z'],
  bulb: ['M9 17.5h6', 'M10 20.5h4', 'M12 3a6 6 0 0 0-3.5 10.9c.4.3.5.7.5 1.1h6c0-.4.1-.8.5-1.1A6 6 0 0 0 12 3z'],
  paw: [dot(6.5, 11, 1.5), dot(10, 7, 1.5), dot(14, 7, 1.5), dot(17.5, 11, 1.5), 'M12 12.5c-2.8 0-5 2.6-5 4.8 0 1.6 1.4 2.2 2.6 2.2 1 0 1.6-.5 2.4-.5s1.4.5 2.4.5c1.2 0 2.6-.6 2.6-2.2 0-2.2-2.2-4.8-5-4.8z'],
  fish: ['M8 12c2.5-4 6-5.5 9-5.5 2 0 3.5 2.5 5 5.5-1.5 3-3 5.5-5 5.5-3 0-6.5-1.5-9-5.5z', 'M8 12L3 8v8z', dot(17.5, 11, 0.5)],
  anchor: [dot(12, 5, 2), 'M12 7v14', 'M8 11h8', 'M4 14a8 8 0 0 0 16 0'],
  flag: ['M5 21V4', 'M5 4.5c3-1.5 5.5 1.5 8.5 0s4-1 5.5-.5v9c-1.5-.5-2.5-1-5.5.5s-5.5-1.5-8.5 0'],
};

const PETALS = [0, 45, 90, 135, 180, 225, 270, 315];

/** One of the list icons, drawn as lines in the colour given. */
export function ListIcon({ name, size = 28, color = '#FFFFFF' }: { name: IconName; size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <G fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
        {name === 'daisy' ? (
          <>
            {PETALS.map((a) => (
              <Ellipse key={a} cx={12} cy={5.6} rx={2.1} ry={3.7} transform={`rotate(${a} 12 12)`} />
            ))}
            <Circle cx={12} cy={12} r={2.4} fill={color} />
          </>
        ) : (
          DRAWINGS[name].map((d, i) => <Path key={i} d={d} />)
        )}
      </G>
    </Svg>
  );
}

/**
 * The square at the start of an idea's card: its list's icon on a blend of the list's colour,
 * with a soft highlight across the top. Decorative, so it is not read out.
 */
export function ListTile({ icon, color, size = 48, flat }: { icon: IconName; color: string; size?: number; flat?: boolean }) {
  const blend = blendFor(color);
  const id = `tile-${color.slice(1)}`;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, flat ? null : shadow]}>
      <Svg width={size} height={size} viewBox="0 0 48 48" style={{ position: 'absolute', top: 0, left: 0 }}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={blend.from} />
            <Stop offset="1" stopColor={blend.to} />
          </LinearGradient>
          <ClipPath id="tile-edge">
            <Rect width={48} height={48} rx={16} />
          </ClipPath>
        </Defs>
        <Rect width={48} height={48} rx={16} fill={`url(#${id})`} />
        <Ellipse cx={14} cy={9} rx={25} ry={13} fill="#FFFFFF" opacity={0.16} clipPath="url(#tile-edge)" />
      </Svg>
      {/* Lifted above the colour, which is placed absolutely and would otherwise cover it on the web. */}
      <View style={{ zIndex: 1 }}>
        <ListIcon name={icon} size={size * 0.56} color={blend.ink} />
      </View>
    </View>
  );
}
