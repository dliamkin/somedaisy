import { Platform, Pressable, ScrollView, View } from 'react-native';

import { countdown, formatPlan, WEEKDAYS } from '@/lib/plans';
import { useTheme } from '@/lib/theme';

import { MorphChip } from './morph-chip';
import { Sheet } from './sheet';
import { FlowerCard, GUTTER, T } from './ui';

/**
 * The buttons that finish a plan. Before the start time the way to finish is a quiet "Did it
 * early", so nobody taps it by accident before the plan happens. From the start time on it is a
 * filled "We did it!". Both lead to the same confirmation, which the buttons turn into in place,
 * so the one to tap next is under the same finger. The note goes underneath.
 *
 * With `onChangeDate` the way out of the confirmation doubles as "Change date" the rest of the
 * time. Without it there is one button, at the right, until the confirmation is asked for.
 */
export function DoneButtons({
  started,
  confirming,
  onAskDone,
  onDone,
  onNotYet,
  onChangeDate,
}: {
  /** Whether the plan's start time has come. */
  started: boolean;
  /** True once "We did it!" or "Did it early" has been tapped, while the app asks to be sure. */
  confirming: boolean;
  onAskDone: () => void;
  onDone: () => void;
  onNotYet: () => void;
  onChangeDate?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: onChangeDate || confirming ? 'space-between' : 'flex-end', gap: 6 }}>
        {onChangeDate ? (
          <MorphChip tone="quiet" label={confirming ? 'Not yet' : 'Change date'} onPress={confirming ? onNotYet : onChangeDate} />
        ) : confirming ? (
          <MorphChip tone="quiet" label="Not yet" onPress={onNotYet} />
        ) : null}
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
    </>
  );
}

type Plan = { id: string; title: string; planned_for: string };

/**
 * What a plan is and when: the day in a box, its name and time, and how long there is to go.
 * Before the start time the pill counts down. From the start time on it reads "Now". `small` is
 * for a card in the row of plans, where the name keeps to one line.
 */
function PlanSummary({ title, plannedFor, now, small }: { title: string; plannedFor: string; now: Date; small?: boolean }) {
  const { colors } = useTheme();
  const when = new Date(plannedFor);
  const left = countdown(plannedFor, now);
  const started = left === null;
  const box = small ? 48 : 56;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: small ? 10 : 12 }}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ width: box, height: box, borderRadius: small ? 16 : 18, backgroundColor: colors.selected, alignItems: 'center', justifyContent: 'center' }}>
        <T size={small ? 11 : 12} weight="extra" color={colors.accentText} style={{ lineHeight: small ? 13 : 14 }}>
          {WEEKDAYS[when.getDay()].toUpperCase()}
        </T>
        <T size={small ? 19 : 22} weight="black" style={{ lineHeight: small ? 22 : 25 }}>
          {when.getDate()}
        </T>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T size={small ? 15 : 17} weight="extra" lines={small ? 1 : undefined}>
          {title}
        </T>
        <T size={small ? 12 : 13} color={colors.textMuted} lines={small ? 1 : undefined}>
          {formatPlan(plannedFor, now)}
        </T>
      </View>
      <View style={{ paddingHorizontal: small ? 9 : 10, paddingVertical: small ? 5 : 6, borderRadius: 12, backgroundColor: started ? colors.mint : colors.selected }}>
        <T size={small ? 12 : 13} weight="extra" color={started ? colors.mintText : colors.text} lines={1}>
          {started ? 'Now' : left}
        </T>
      </View>
    </View>
  );
}

type Finishing = {
  /** True once "We did it!" or "Did it early" has been tapped, while the app asks to be sure. */
  confirming: boolean;
  onAskDone: () => void;
  onDone: () => void;
  onNotYet: () => void;
  onChangeDate: () => void;
};

/**
 * A plan that is coming up, as a card of its own with its buttons on it (see `DoneButtons`). This
 * is how a group's one plan is shown. With more than one they go in a row (`ComingUpRow`).
 */
export function ComingUpCard({ title, plannedFor, now, ...finishing }: { title: string; /** When the plan is for, as the database gives it. */ plannedFor: string; now: Date } & Finishing) {
  return (
    <FlowerCard>
      <PlanSummary title={title} plannedFor={plannedFor} now={now} />
      <DoneButtons started={countdown(plannedFor, now) === null} {...finishing} />
    </FlowerCard>
  );
}

/** The words over the plans: "Coming up", how many there are, and the way to the calendar. */
export function ComingUpHeading({ count, onSeeAll }: { count: number; onSeeAll: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <T size={15} weight="black">
        Coming up
      </T>
      <View accessibilityLabel={count === 1 ? '1 plan' : `${count} plans`} style={{ paddingHorizontal: 8, paddingVertical: 1, borderRadius: 10, backgroundColor: colors.today }}>
        <T size={12} weight="extra">
          {count}
        </T>
      </View>
      <View style={{ flex: 1 }} />
      <Pressable accessibilityRole="link" accessibilityLabel="See all plans on the calendar" onPress={onSeeAll} hitSlop={8} style={{ minHeight: 32, justifyContent: 'center' }}>
        <T size={14} weight="extra" color={colors.link} style={{ textDecorationLine: 'underline' }}>
          See all
        </T>
      </Pressable>
    </View>
  );
}

// A card in the row is narrower than the screen, so the next one shows at the edge and says there are more.
const ROW_CARD = 286;

/**
 * Every plan that is coming up, soonest first, in one row that slides sideways. Tapping a plan
 * opens it (`PlanSheet`), which is where its buttons are. The row reaches both edges of the
 * screen, so a card slides off the edge and not off an invisible line.
 */
export function ComingUpRow({ plans, now, onOpen }: { plans: Plan[]; now: Date; onOpen: (plan: Plan) => void }) {
  const { colors } = useTheme();
  return (
    <ScrollView
      horizontal
      // A mouse has no other way to slide the row. A finger does not need the bar.
      showsHorizontalScrollIndicator={Platform.OS === 'web'}
      style={{ marginHorizontal: -GUTTER, flexGrow: 0 }}
      contentContainerStyle={{ paddingHorizontal: GUTTER, paddingBottom: 8, gap: 10 }}>
      {plans.map((plan) => (
        <Pressable
          key={plan.id}
          accessibilityRole="button"
          accessibilityLabel={`${plan.title}, ${formatPlan(plan.planned_for, now)}. Open this plan`}
          onPress={() => onOpen(plan)}
          style={({ pressed }) => ({
            width: ROW_CARD,
            padding: 10,
            borderRadius: 22,
            backgroundColor: colors.card,
            boxShadow: `0 4px 10px ${colors.shadow}`,
            opacity: pressed ? 0.85 : 1,
          })}>
          <PlanSummary small title={plan.title} plannedFor={plan.planned_for} now={now} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

/** One plan, opened from the row: the same card, on a sheet that slides up, with its buttons. */
export function PlanSheet({ plan, now, onClose, ...finishing }: { plan: Plan; now: Date; onClose: () => void } & Finishing) {
  return (
    <Sheet onClose={onClose}>
      <View style={{ gap: 12, paddingHorizontal: 4, paddingTop: 4 }}>
        <PlanSummary title={plan.title} plannedFor={plan.planned_for} now={now} />
        <DoneButtons started={countdown(plan.planned_for, now) === null} {...finishing} />
      </View>
    </Sheet>
  );
}
