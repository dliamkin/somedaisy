import { View } from 'react-native';

import { useTheme } from '@/lib/theme';

import { Avatar, T } from './ui';

// How far each circle sits over the one before it.
const OVERLAP = 8;
// The ring round each circle, which is what keeps two that overlap apart.
const RING = 2;

/**
 * A group's members as a short row of circles that overlap, with "+2" for the ones there is no
 * room for. `ring` is the colour of the edge round each circle: the colour of whatever the row
 * sits on. `ink` is the colour of the "+2".
 */
export function AvatarStack({
  members,
  size = 26,
  most = 3,
  ring,
  ink,
}: {
  members: { user_id: string; name: string; color: string; photo?: string | null }[];
  /** The width of a circle, its ring included. */
  size?: number;
  /** How many circles are shown before the rest become a number. */
  most?: number;
  ring?: string;
  ink?: string;
}) {
  const { colors } = useTheme();
  const shown = members.slice(0, most);
  const more = members.length - shown.length;
  if (shown.length === 0) return null;
  return (
    <View
      accessible
      accessibilityLabel={members.length === 1 ? '1 person' : `${members.length} people`}
      style={{ flexDirection: 'row', alignItems: 'center' }}>
      {shown.map((member, i) => (
        <View
          key={member.user_id}
          style={{ width: size, height: size, borderRadius: size / 2, borderWidth: RING, borderColor: ring ?? colors.card, marginLeft: i === 0 ? 0 : -OVERLAP, overflow: 'hidden' }}>
          <Avatar name={member.name} color={member.color} photo={member.photo} size={size - RING * 2} />
        </View>
      ))}
      {more > 0 ? (
        <T size={12} weight="extra" color={ink ?? colors.textMuted} style={{ marginLeft: 4 }}>
          +{more}
        </T>
      ) : null}
    </View>
  );
}
