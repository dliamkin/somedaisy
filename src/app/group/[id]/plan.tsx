import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Button, Card, Chip, ErrorNote, Loading, Screen, T, TopBar } from '@/components/ui';
import { fetchGroup, markChanged, planIdea, type Idea } from '@/lib/data';
import { combine, dayLabel, dayOptions, daysFromToday, formatPlan, slotOf, TIME_SLOTS } from '@/lib/plans';
import { colors } from '@/lib/theme';

export default function PlanIdea() {
  const { id, idea: ideaId } = useLocalSearchParams<{ id: string; idea?: string }>();
  const [now] = useState(() => new Date());
  const [days] = useState(() => dayOptions(now));
  const [idea, setIdea] = useState<Idea | null | undefined>(undefined);
  const [dayIndex, setDayIndex] = useState<number | null>(null);
  const [slotKey, setSlotKey] = useState('evening');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchGroup(id)
      .then((g) => {
        const found = g?.ideas.find((i) => i.id === ideaId) ?? null;
        setIdea(found);
        // Changing an existing plan starts from the date it already has.
        if (found?.planned_for) {
          const current = new Date(found.planned_for);
          const index = daysFromToday(current, now);
          if (index >= 0 && index < days.length) setDayIndex(index);
          const slot = slotOf(current);
          if (slot) setSlotKey(slot.key);
        }
      })
      .catch((e: Error) => {
        setError(e.message);
        setIdea(null);
      });
  }, [id, ideaId, now, days]);

  const back = () => (router.canGoBack() ? router.back() : router.replace(`/group/${id}` as never));

  const save = async (when: Date | null) => {
    if (!id || !idea || busy) return;
    setBusy(true);
    setError(null);
    try {
      await planIdea(idea.id, when);
      markChanged(id);
      back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the plan.');
      setBusy(false);
    }
  };

  if (idea === undefined) return <Loading />;
  if (!idea) {
    return (
      <Screen footer={<Button label="Back to the group" kind="soft" onPress={back} />}>
        <TopBar title="Pick a date" backTo={`/group/${id}`} />
        <ErrorNote message={error} />
        <T weight="medium" color={colors.muted}>
          That idea is no longer in the group.
        </T>
      </Screen>
    );
  }

  const slot = TIME_SLOTS.find((s) => s.key === slotKey) ?? TIME_SLOTS[0];
  const when = dayIndex === null ? null : combine(days[dayIndex], slot);
  const passed = when !== null && when.getTime() < now.getTime();

  return (
    <Screen
      footer={
        <>
          <Button label="Save the plan" onPress={() => save(when)} disabled={!when || passed} busy={busy} />
          {idea.planned_for ? <Button label="Remove the date" kind="ghost" small onPress={() => save(null)} disabled={busy} /> : null}
        </>
      }>
      <TopBar title="Pick a date" backTo={`/group/${id}`} />
      <Card>
        <T size={17} weight="extra">
          {idea.title}
        </T>
        {idea.planned_for ? (
          <T size={14} color={colors.muted}>
            Currently planned for {formatPlan(idea.planned_for, now)}
          </T>
        ) : null}
      </Card>

      <View style={{ gap: 8 }}>
        <T size={16} weight="extra">
          Which day?
        </T>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }} style={{ flexGrow: 0 }}>
          {days.map((d, i) => (
            <Chip key={d.getTime()} label={dayLabel(d, now)} selected={i === dayIndex} onPress={() => setDayIndex(i)} />
          ))}
        </ScrollView>
      </View>

      <View style={{ gap: 8 }}>
        <T size={16} weight="extra">
          What time?
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {TIME_SLOTS.map((s) => (
            <Chip key={s.key} label={s.label} selected={s.key === slotKey} onPress={() => setSlotKey(s.key)} />
          ))}
        </View>
      </View>

      {when ? (
        <T size={15} weight="extra" color={passed ? colors.danger : colors.link}>
          {passed ? 'That time has already passed. Pick a later one.' : formatPlan(when.toISOString(), now)}
        </T>
      ) : (
        <T size={14} weight="medium" color={colors.muted}>
          Everyone in the group will see the date.
        </T>
      )}
      <ErrorNote message={error} />
    </Screen>
  );
}
