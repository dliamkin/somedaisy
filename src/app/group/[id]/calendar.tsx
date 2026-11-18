import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { MonthGrid } from '@/components/month-grid';
import { Button, Card, Chip, ErrorNote, FlowerCard, Loading, Screen, T, TopBar } from '@/components/ui';
import { byDay, dayKey, longDayLabel, monthOf, shiftMonth, type Month } from '@/lib/calendar';
import { fetchDone, fetchGroup, type DoneIdea, type GroupData } from '@/lib/data';
import { dayLabel, plannedIdeas, timeLabel } from '@/lib/plans';
import { colors } from '@/lib/theme';

/** The group's calendar: a month at a time, with its plans and the things it has done on their days. */
export default function GroupCalendar() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [now, setNow] = useState(() => new Date());
  const [month, setMonth] = useState<Month>(() => monthOf(new Date()));
  const [picked, setPicked] = useState<Date>(() => new Date());
  const [group, setGroup] = useState<GroupData | null | undefined>(undefined);
  const [done, setDone] = useState<DoneIdea[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Reload whenever the screen comes back into view, for example after changing a date.
  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      let alive = true;
      Promise.all([fetchGroup(id), fetchDone(id)]).then(
        ([g, d]) => {
          if (!alive) return;
          setGroup(g);
          setDone(d);
          setNow(new Date());
          setError(null);
        },
        (e: Error) => {
          if (!alive) return;
          setError(e.message);
          setGroup((current) => current ?? null);
        },
      );
      return () => {
        alive = false;
      };
    }, [id]),
  );

  if (group === undefined) return <Loading />;
  if (!group) {
    return (
      <Screen footer={<Button label="Back to groups" kind="soft" onPress={() => router.replace('/')} />}>
        <TopBar title="Calendar" backTo={`/group/${id}`} />
        <ErrorNote message={error} />
        <T weight="medium" color={colors.muted}>
          That group is not available.
        </T>
      </Screen>
    );
  }

  const plansByDay = byDay(plannedIdeas(group.ideas), (i) => i.planned_for);
  const doneByDay = byDay(done, (i) => i.done_at);
  const pickedKey = dayKey(picked);
  const plans = plansByDay[pickedKey] ?? [];
  const finished = doneByDay[pickedKey] ?? [];
  const listName = (listId: string) => group.lists.find((l) => l.id === listId)?.name;

  const turn = (by: number) => {
    const next = shiftMonth(month, by);
    setMonth(next);
    // Keep a day picked in the month on show: today if it is this month, otherwise the 1st.
    const today = monthOf(now);
    setPicked(today.year === next.year && today.month === next.month ? now : new Date(next.year, next.month, 1));
  };

  return (
    <Screen>
      <TopBar title="Calendar" subtitle={group.name} backTo={`/group/${id}`} />
      <ErrorNote message={error} />

      <Card style={{ padding: 14, gap: 10 }}>
        <MonthGrid
          month={month}
          onTurn={turn}
          picked={picked}
          today={now}
          onPick={setPicked}
          marks={(key) => ({ plans: plansByDay[key]?.length, done: doneByDay[key]?.length })}
        />
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16 }}>
          <Legend color={colors.grape} label="Planned" />
          <Legend color={colors.mintText} label="Done" />
        </View>
      </Card>

      <T size={16} weight="black">
        {dayLabel(picked, now) === longDayLabel(picked) ? longDayLabel(picked) : `${dayLabel(picked, now)}, ${longDayLabel(picked)}`}
      </T>

      {plans.length === 0 && finished.length === 0 ? (
        <T weight="medium" color={colors.muted}>
          Nothing on this day. To plan something, open an idea in the group and pick a date.
        </T>
      ) : null}

      {plans.map((plan) => (
        <FlowerCard key={plan.id}>
          <View style={{ gap: 2 }}>
            <T size={13} weight="extra" color={colors.link}>
              {timeLabel(new Date(plan.planned_for))}
            </T>
            <T size={17} weight="extra">
              {plan.title}
            </T>
            {listName(plan.list_id) ? (
              <T size={13} color={colors.muted}>
                {listName(plan.list_id)}
              </T>
            ) : null}
          </View>
          <View style={{ flexDirection: 'row' }}>
            <Chip outlined label="Change date" accessibilityLabel={`Change the date of ${plan.title}`} onPress={() => router.push(`/group/${id}/plan?idea=${plan.id}` as never)} />
          </View>
        </FlowerCard>
      ))}

      {finished.map((idea) => (
        <Card key={idea.id}>
          <View style={{ gap: 2 }}>
            <T size={13} weight="extra" color={colors.mintText}>
              Done
            </T>
            <T size={17} weight="extra">
              {idea.title}
            </T>
            {listName(idea.list_id) ? (
              <T size={13} color={colors.muted}>
                {listName(idea.list_id)}
              </T>
            ) : null}
          </View>
        </Card>
      ))}
    </Screen>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <T size={12} color={colors.muted}>
        {label}
      </T>
    </View>
  );
}
