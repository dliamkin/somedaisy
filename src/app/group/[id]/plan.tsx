import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { MonthGrid } from '@/components/month-grid';
import { Button, Card, Chip, ErrorNote, Loading, Screen, T, TopBar } from '@/components/ui';
import { byDay, dayKey, monthOf, shiftMonth, type Month } from '@/lib/calendar';
import { fetchGroup, markChanged, planIdea, type Idea } from '@/lib/data';
import { atTime, daysFromToday, formatPlan, minutesLabel, minutesOf, plannedIdeas, shiftTime, slotFor, slotMinutes, TIME_SLOTS, TIME_STEP } from '@/lib/plans';
import { colors } from '@/lib/theme';

export default function PlanIdea() {
  const { id, idea: ideaId } = useLocalSearchParams<{ id: string; idea?: string }>();
  const [now] = useState(() => new Date());
  const [idea, setIdea] = useState<Idea | null | undefined>(undefined);
  // The group's other plans, so the calendar can show which days are already taken.
  const [others, setOthers] = useState<Idea[]>([]);
  const [day, setDay] = useState<Date | null>(null);
  const [month, setMonth] = useState<Month>(() => monthOf(new Date()));
  // The time of day, as minutes after midnight. Starts at 7 PM.
  const [minutes, setMinutes] = useState(19 * 60);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchGroup(id)
      .then((g) => {
        const found = g?.ideas.find((i) => i.id === ideaId) ?? null;
        setIdea(found);
        setOthers((g?.ideas ?? []).filter((i) => i.id !== ideaId));
        // Changing an existing plan starts from the date it already has, if that is still to come.
        if (found?.planned_for) {
          const current = new Date(found.planned_for);
          if (daysFromToday(current, now) >= 0) {
            setDay(new Date(current.getFullYear(), current.getMonth(), current.getDate()));
            setMonth(monthOf(current));
          }
          setMinutes(minutesOf(current));
        }
      })
      .catch((e: Error) => {
        setError(e.message);
        setIdea(null);
      });
  }, [id, ideaId, now]);

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

  const when = day === null ? null : atTime(day, minutes);
  const part = slotFor(minutes);
  const passed = when !== null && when.getTime() < now.getTime();
  const taken = byDay(plannedIdeas(others), (i) => i.planned_for);
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const isDay = (d: Date) => day !== null && dayKey(day) === dayKey(d);

  // Pick a day, and bring its month into view.
  const pick = (d: Date) => {
    setDay(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
    setMonth(monthOf(d));
  };

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
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Chip label="Today" selected={isDay(now)} onPress={() => pick(now)} />
          <Chip label="Tomorrow" selected={isDay(tomorrow)} onPress={() => pick(tomorrow)} />
        </View>
        <Card style={{ padding: 14 }}>
          <MonthGrid
            month={month}
            onTurn={(by) => setMonth(shiftMonth(month, by))}
            picked={day}
            today={now}
            onPick={pick}
            earliest={now}
            marks={(key) => ({ plans: taken[key]?.length })}
          />
          <T size={12} color={colors.muted} center>
            A dot marks a day the group already has a plan.
          </T>
        </Card>
      </View>

      <View style={{ gap: 8 }}>
        <T size={16} weight="extra">
          What time?
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {TIME_SLOTS.map((s) => (
            <Chip key={s.key} label={s.label} selected={s.key === part.key} onPress={() => setMinutes(slotMinutes(s))} />
          ))}
        </View>
        {/* The shortcuts above set a usual time; this sets the exact one. */}
        <Card style={{ padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Chip label="−" outlined accessibilityLabel={`${TIME_STEP} minutes earlier`} onPress={() => setMinutes(shiftTime(minutes, -1))} />
          <View style={{ alignItems: 'center' }} accessibilityLiveRegion="polite">
            <T size={24} weight="black">
              {minutesLabel(minutes)}
            </T>
            <T size={12} color={colors.muted}>
              Tap − or + to change the time
            </T>
          </View>
          <Chip label="+" outlined accessibilityLabel={`${TIME_STEP} minutes later`} onPress={() => setMinutes(shiftTime(minutes, 1))} />
        </Card>
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
