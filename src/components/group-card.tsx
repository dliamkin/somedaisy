import { Pressable, View } from 'react-native';

import { coverOf } from '@/lib/covers';
import type { GroupSummary } from '@/lib/data';
import { useTheme } from '@/lib/theme';

import { AvatarStack } from './avatar-stack';
import { Cover } from './cover';
import { Card, T } from './ui';

// The card's corners. The cover inside is cut to them.
const RADIUS = 26;

/**
 * A group on Home: its cover with its name on it, and one line under it with the group's rank,
 * what it has planned next, and who is in it. The whole card opens the group.
 *
 * `rank` and `next` are left out until they have loaded: the card shows without them. `next` is
 * the line about the next plan, or null when nothing is planned.
 */
export function GroupCard({
  group,
  rank,
  petals,
  next,
  onPress,
}: {
  group: GroupSummary;
  /** The name of the rank the group has reached. */
  rank?: string | null;
  /** How many of the daisy's eight petals are filled in. */
  petals: number;
  next?: string | null;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const plan = next === undefined ? null : (next ?? 'Nothing planned yet');
  const said = [group.name, rank, plan].filter(Boolean).join('. ');
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${said}`} onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}>
      {/* The card carries the shadow. The box inside it cuts the cover to the card's rounded corners. */}
      <Card style={{ padding: 0, gap: 0, borderRadius: RADIUS }}>
        <View style={{ borderRadius: RADIUS, overflow: 'hidden' }}>
          <Cover cover={coverOf(group)} place="card" name={group.name} earned={petals} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 10, paddingRight: 14, paddingBottom: 12, paddingLeft: 16, minHeight: 48 }}>
            {/* One line only: the rank, then what is next. Whatever does not fit is cut off. */}
            <T size={13} color={colors.textMuted} lines={1} style={{ flex: 1, minWidth: 0 }}>
              {rank ? (
                <T size={13} weight="extra" color={colors.accentText}>
                  {rank}
                </T>
              ) : null}
              {rank && plan ? ' · ' : ''}
              {plan ?? ''}
            </T>
            <AvatarStack members={group.members} />
          </View>
        </View>
      </Card>
    </Pressable>
  );
}
