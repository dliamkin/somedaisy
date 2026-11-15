import { Pressable, View } from 'react-native';

import { dayKey, longDayLabel, monthGrid, monthLabel, WEEKDAY_LETTERS, WEEKDAY_NAMES, type Month } from '@/lib/calendar';
import { colors } from '@/lib/theme';

import { Chip, T } from './ui';

/** What to show under a day's number: how many plans and done things fall on it. */
export type DayMarks = { plans?: number; done?: number };

/**
 * One month as a grid of days, with arrows to page to the months either side. Used to look at a
 * group's calendar and to pick the day for a plan.
 */
export function MonthGrid({
  month,
  onTurn,
  picked,
  today,
  onPick,
  marks,
  earliest,
}: {
  month: Month;
  /** Page back (-1) or forward (1) a month. */
  onTurn: (by: number) => void;
  /** The chosen day, if there is one. */
  picked: Date | null;
  today: Date;
  onPick: (day: Date) => void;
  /** Dots for a day, by its `dayKey`. */
  marks?: (key: string) => DayMarks | undefined;
  /** Days before this one cannot be picked, and the grid will not page back past its month. */
  earliest?: Date;
}) {
  const todayKey = dayKey(today);
  const pickedKey = picked ? dayKey(picked) : null;
  const earliestKey = earliest ? dayKey(earliest) : null;
  const atEarliestMonth = earliest ? month.year === earliest.getFullYear() && month.month === earliest.getMonth() : false;

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {atEarliestMonth ? <View style={{ width: 44, height: 44 }} /> : <Chip label="‹" accessibilityLabel="Previous month" onPress={() => onTurn(-1)} />}
        <T size={18} weight="black">
          {monthLabel(month)}
        </T>
        <Chip label="›" accessibilityLabel="Next month" onPress={() => onTurn(1)} />
      </View>
      <View style={{ flexDirection: 'row' }}>
        {WEEKDAY_LETTERS.map((letter, i) => (
          <View key={WEEKDAY_NAMES[i]} style={{ flex: 1, alignItems: 'center' }}>
            <T size={12} weight="extra" color={colors.muted}>
              {letter}
            </T>
          </View>
        ))}
      </View>
      {monthGrid(month).map((week, w) => (
        <View key={w} style={{ flexDirection: 'row' }}>
          {week.map((day, d) => {
            if (!day) return <View key={d} style={{ flex: 1 }} />;
            const key = dayKey(day);
            const { plans = 0, done = 0 } = marks?.(key) ?? {};
            const isPicked = key === pickedKey;
            const isToday = key === todayKey;
            // Day keys sort like dates, so comparing them compares the days.
            const tooEarly = earliestKey !== null && key < earliestKey;
            const says = [
              longDayLabel(day),
              isToday ? 'today' : null,
              plans ? (plans === 1 ? '1 plan' : `${plans} plans`) : null,
              done ? `${done} done` : null,
            ].filter(Boolean);
            return (
              <Pressable
                key={d}
                accessibilityRole="button"
                accessibilityLabel={says.join(', ')}
                accessibilityState={{ selected: isPicked, disabled: tooEarly }}
                disabled={tooEarly}
                onPress={() => onPick(day)}
                style={{ flex: 1, alignItems: 'center', paddingVertical: 2 }}>
                <View
                  style={{
                    width: 40,
                    height: 44,
                    borderRadius: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 2,
                    borderWidth: 2,
                    borderColor: isPicked ? colors.pink : 'transparent',
                    backgroundColor: isPicked ? colors.pinkTint : isToday ? colors.today : 'transparent',
                    opacity: tooEarly ? 0.35 : 1,
                  }}>
                  <T size={15} weight={isToday || isPicked ? 'black' : 'bold'}>
                    {day.getDate()}
                  </T>
                  <View style={{ flexDirection: 'row', gap: 3, height: 6 }}>
                    {plans ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.grape }} /> : null}
                    {done ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.mintText }} /> : null}
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}
