import { View } from 'react-native';

import { countdown, formatPlan, WEEKDAYS } from '@/lib/plans';
import { useTheme } from '@/lib/theme';

import { MorphChip } from './morph-chip';
import { FlowerCard, T } from './ui';

/**
 * A plan that is coming up: the day in a box, what it is and when, and how long there is to go.
 *
 * It has two states. Before the start time the pill counts down and the way to finish is a quiet
 * "Did it early", so nobody taps it by accident before the plan happens. From the start time on
 * the pill reads "Now" and the button is a filled "We did it!". Both lead to the same
 * confirmation, which the buttons turn into in place.
 */
export function ComingUpCard({
  title,
  plannedFor,
  now,
  confirming,
  onAskDone,
  onDone,
  onNotYet,
  onChangeDate,
}: {
  title: string;
  /** When the plan is for, as the database gives it. */
  plannedFor: string;
  now: Date;
  /** True once "We did it!" or "Did it early" has been tapped, while the app asks to be sure. */
  confirming: boolean;
  onAskDone: () => void;
  onDone: () => void;
  onNotYet: () => void;
  onChangeDate: () => void;
}) {
  const { colors } = useTheme();
  const when = new Date(plannedFor);
  const left = countdown(plannedFor, now);
  const started = left === null;
  return (
    <FlowerCard>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: colors.selected, alignItems: 'center', justifyContent: 'center' }}>
          <T size={12} weight="extra" color={colors.accentText} style={{ lineHeight: 14 }}>
            {WEEKDAYS[when.getDay()].toUpperCase()}
          </T>
          <T size={22} weight="black" style={{ lineHeight: 25 }}>
            {when.getDate()}
          </T>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T size={17} weight="extra">
            {title}
          </T>
          <T size={13} color={colors.textMuted}>
            {formatPlan(plannedFor, now)}
          </T>
        </View>
        <View style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: started ? colors.mint : colors.selected }}>
          <T size={13} weight="extra" color={started ? colors.mintText : colors.text} lines={1}>
            {started ? 'Now' : left}
          </T>
        </View>
      </View>
      {/* The buttons stay where they are and turn into the confirmation in place, so the one to
          tap next is under the same finger. The note goes underneath. */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <MorphChip tone="quiet" label={confirming ? 'Not yet' : 'Change date'} onPress={confirming ? onNotYet : onChangeDate} />
        <MorphChip
          tone={started ? 'primary' : 'outline'}
          label={confirming ? 'Yes, mark as done' : started ? 'We did it!' : 'Did it early'}
          selected={confirming}
          onPress={confirming ? onDone : onAskDone}
        />
      </View>
      {confirming ? (
        <T size={13} color={colors.textMuted}>
          It moves from the list to &quot;Things we did&quot; for everyone.
        </T>
      ) : null}
    </FlowerCard>
  );
}
