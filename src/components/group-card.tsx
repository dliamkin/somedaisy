import { Pressable, View } from 'react-native';

import { coverOf } from '@/lib/covers';
import type { GroupSummary } from '@/lib/data';
import { useTheme } from '@/lib/theme';

import { ActionIcon } from './action-icons';
import { AvatarStack } from './avatar-stack';
import { Cover } from './cover';
import { CoverCredit } from './cover-credit';
import { Card, T } from './ui';

// The card's corners. The cover inside is cut to them.
const RADIUS = 26;

/**
 * A group on Home: its cover with its name on it, and one line under it with the group's rank,
 * what it has planned next, and who is in it. The whole card opens the group, except the small
 * round button at its top left, which opens a menu of things to do with the group.
 *
 * `rank` and `next` are left out until they have loaded: the card shows without them. `next` is
 * the line about the next plan, or null when nothing is planned.
 */
export function GroupCard({
  group,
  rank,
  petals,
  next,
  photo,
  onPress,
  onMenu,
}: {
  group: GroupSummary;
  /** The name of the rank the group has reached. */
  rank?: string | null;
  /** How many of the daisy's eight petals are filled in. */
  petals: number;
  next?: string | null;
  /** Where the cover's photo loads from, when it has one (see `useCoverPhotos`). */
  photo?: { uri: string; key?: string } | null;
  onPress: () => void;
  /** Opens the group's menu. Left out, the card has no menu button. */
  onMenu?: () => void;
}) {
  const { colors } = useTheme();
  const plan = next === undefined ? null : (next ?? 'Nothing planned yet');
  const said = [group.name, rank, plan].filter(Boolean).join('. ');
  const cover = coverOf(group);
  return (
    <View>
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${said}`} onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}>
      {/* The card carries the shadow. The box inside it cuts the cover to the card's rounded corners. */}
      <Card style={{ padding: 0, gap: 0, borderRadius: RADIUS }}>
        <View style={{ borderRadius: RADIUS, overflow: 'hidden' }}>
          <Cover cover={cover} place="card" name={group.name} earned={petals} photo={photo} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 10, paddingRight: 14, paddingBottom: 12, paddingLeft: 16, minHeight: 48 }}>
            {/* One line only: the rank, then what is next. Whatever does not fit is cut off. */}
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <T size={13} color={colors.textMuted} lines={1}>
                {rank ? (
                  <T size={13} weight="extra" color={colors.accentText}>
                    {rank}
                  </T>
                ) : null}
                {rank && plan ? ' · ' : ''}
                {plan ?? ''}
              </T>
              {/* Who took the photo, when the cover is one found by search. Its links open on their own, not the group. */}
              <CoverCredit cover={cover} size={11} lines={1} />
            </View>
            <AvatarStack members={group.members} />
          </View>
        </View>
      </Card>
    </Pressable>
      {/* Beside the card, not inside it, so it is a button of its own and never opens the group. It is
          white in both modes, like the buttons on a group's page, since a cover does not change with the mode. */}
      {onMenu ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Menu for ${group.name}: share, delete or leave`}
          onPress={onMenu}
          hitSlop={8}
          style={({ pressed }) => ({
            position: 'absolute',
            left: 10,
            top: 8,
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.white,
            boxShadow: `0 4px 10px ${colors.shadow}`,
            opacity: pressed ? 0.7 : 1,
          })}>
          <ActionIcon name="menu" size={18} color={colors.ink} />
        </Pressable>
      ) : null}
    </View>
  );
}
