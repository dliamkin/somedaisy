import type { ReactNode } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';

import { countdown, formatPlan, WEEKDAYS } from '@/lib/plans';
import { useTheme } from '@/lib/theme';

import { ListIcon } from './list-tile';
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
 * What a plan is and when, as the button that opens the idea's own page. It is the one a keyboard
 * and a screen reader find. The card or sheet round it takes the same tap anywhere else on it.
 */
function OpenSummary({ title, plannedFor, now, onOpen }: { title: string; plannedFor: string; now: Date; onOpen: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}, ${formatPlan(plannedFor, now)}. Open this idea`} onPress={onOpen} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      <PlanSummary title={title} plannedFor={plannedFor} now={now} />
    </Pressable>
  );
}

/**
 * A plan that is coming up, as a card of its own with its buttons on it (see `DoneButtons`). This
 * is how a group's one plan is shown. With more than one they go in a row (`ComingUpRow`).
 *
 * Tapping the card anywhere but on its buttons opens the idea's own page, as tapping an idea's
 * card further down the page does.
 */
export function ComingUpCard({
  title,
  plannedFor,
  now,
  onOpen,
  ...finishing
}: { title: string; /** When the plan is for, as the database gives it. */ plannedFor: string; now: Date; /** Open the idea's own page. */ onOpen: () => void } & Finishing) {
  return (
    // The whole card can be tapped. It is left out of what a keyboard and a screen reader step
    // through, since a button must not hold other buttons: for them the summary is the button.
    <Pressable accessible={false} focusable={false} tabIndex={-1} onPress={onOpen} style={Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null}>
      <FlowerCard>
        <OpenSummary title={title} plannedFor={plannedFor} now={now} onOpen={onOpen} />
        <DoneButtons started={countdown(plannedFor, now) === null} {...finishing} />
      </FlowerCard>
    </Pressable>
  );
}

// The Calendar pill is as tall as the heading's row has always been, and a finger gets this much
// more above and below it. The row is made that much taller to hold the whole tap target, and the
// block takes the same amount back from the space around the row, so nothing else moves. (A tap
// target that only hung out past its row would not be felt there on Android.)
const PILL = 32;
const PILL_REACH = 6;
// The space between the heading's row and the plans under it, as it looks.
const UNDER_HEADING = 10;

/**
 * The plans that are coming up, under their heading. `children` are the plans: one card, or the
 * row of them. With none there is only the heading, which then says so and keeps the way to the
 * calendar, since the calendar also shows what the group has done.
 */
export function ComingUp({ count, onCalendar, children }: { count: number; onCalendar: () => void; children?: ReactNode }) {
  return (
    <View style={{ marginTop: -PILL_REACH, marginBottom: children ? 0 : -PILL_REACH, gap: UNDER_HEADING - PILL_REACH }}>
      <ComingUpHeading count={count} onCalendar={onCalendar} />
      {children}
    </View>
  );
}

/** The words over the plans: "Coming up", how many there are, and the Calendar pill at the right. */
function ComingUpHeading({ count, onCalendar }: { count: number; onCalendar: () => void }) {
  const { colors, shadow } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: PILL + PILL_REACH * 2 }}>
      {count > 0 ? (
        <>
          <T size={15} weight="black">
            Coming up
          </T>
          <View accessibilityLabel={count === 1 ? '1 plan' : `${count} plans`} style={{ paddingHorizontal: 8, paddingVertical: 1, borderRadius: 10, backgroundColor: colors.today }}>
            <T size={12} weight="extra">
              {count}
            </T>
          </View>
        </>
      ) : (
        <T size={15} weight="black" color={colors.textMuted}>
          Nothing coming up
        </T>
      )}
      <View style={{ flex: 1 }} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={count > 0 ? 'Calendar. See all plans' : 'Calendar'}
        onPress={onCalendar}
        style={({ pressed }) => ({ height: PILL + PILL_REACH * 2, justifyContent: 'center', opacity: pressed ? 0.85 : 1 })}>
        <View style={[{ height: PILL, borderRadius: PILL / 2, paddingLeft: 10, paddingRight: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.card }, shadow]}>
          <ListIcon name="calendar" size={17} color={colors.link} />
          <T size={13} weight="extra">
            Calendar
          </T>
        </View>
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

/**
 * One plan, opened from the row: the same card, on a sheet that slides up, with its buttons.
 * Tapping what the plan is opens the idea's own page.
 */
export function PlanSheet({ plan, now, onClose, onOpen, ...finishing }: { plan: Plan; now: Date; onClose: () => void; /** Open the idea's own page. */ onOpen: () => void } & Finishing) {
  return (
    <Sheet onClose={onClose}>
      <View style={{ gap: 12, paddingHorizontal: 4, paddingTop: 4 }}>
        <OpenSummary title={plan.title} plannedFor={plan.planned_for} now={now} onOpen={onOpen} />
        <DoneButtons started={countdown(plan.planned_for, now) === null} {...finishing} />
      </View>
    </Sheet>
  );
}
