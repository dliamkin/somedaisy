import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { PointsBar, StampMark } from '@/components/together';
import { Button, Card, ErrorNote, Loading, Screen, T, TopBar } from '@/components/ui';
import { dayLabel } from '@/lib/plans';
import { levelFor, stampsFor, TITLES, totalPoints, type Completion, type Stamp } from '@/lib/points';
import { colors } from '@/lib/theme';
import { fetchCompletions } from '@/lib/together';

const PASTELS = [colors.sky, colors.peach, colors.mint, colors.yellow];

/** The group's passport: its title and points, and a stamp for everything it has done. */
export default function Stamps() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [now, setNow] = useState(() => new Date());
  const [completions, setCompletions] = useState<Completion[] | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      let alive = true;
      fetchCompletions(id).then(
        (c) => {
          if (!alive) return;
          setCompletions(c);
          setNow(new Date());
        },
        (e: Error) => {
          if (!alive) return;
          setError(e.message);
          setCompletions(null);
        },
      );
      return () => {
        alive = false;
      };
    }, [id]),
  );

  const back = () => (router.canGoBack() ? router.back() : router.replace(`/group/${id}` as never));

  if (completions === undefined) return <Loading />;
  if (completions === null) {
    return (
      <Screen footer={<Button label="Back to the group" kind="soft" onPress={back} />}>
        <TopBar title="Stamps" backTo={`/group/${id}`} />
        <ErrorNote message={error} />
        <T weight="medium" color={colors.muted}>
          {error ? 'Your stamps could not be loaded. Check your connection, then try again.' : 'Stamps are not available yet. Try again later.'}
        </T>
      </Screen>
    );
  }

  const points = totalPoints(completions);
  const level = levelFor(points);
  const { special, ordinary } = stampsFor(completions);

  return (
    <Screen>
      <TopBar title="Stamps" subtitle={completions.length === 1 ? '1 thing done together' : `${completions.length} things done together`} backTo={`/group/${id}`} />

      <Card style={{ padding: 18, gap: 14 }}>
        <View style={{ gap: 2 }}>
          <T size={13} color={colors.muted}>
            Your group is
          </T>
          <T size={28} weight="black">
            {level.title}
          </T>
        </View>
        <PointsBar points={points} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {TITLES.map((t, i) => (
            <View
              key={t.title}
              accessibilityLabel={`${t.title}, ${t.at} points${i === level.index ? ', your title now' : i < level.index ? ', reached' : ''}`}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 12,
                backgroundColor: i === level.index ? colors.pinkTint : i < level.index ? colors.mint : colors.ground,
                borderWidth: 2,
                borderColor: i === level.index ? colors.pink : 'transparent',
              }}>
              <T size={12} weight="extra" color={i > level.index ? colors.muted : colors.text}>
                {t.title}
              </T>
            </View>
          ))}
        </View>
        <T size={13} weight="medium" color={colors.muted}>
          Points come from doing things together, not from adding ideas or voting. They never go down.
        </T>
      </Card>

      {completions.length === 0 ? (
        <View style={{ alignItems: 'center', gap: 10, paddingVertical: 24 }}>
          <StampMark emoji="🌼" color={colors.today} size={72} />
          <T size={20} weight="black" center>
            No stamps yet
          </T>
          <T weight="medium" color={colors.muted} center>
            Do something from your lists, tap &quot;We did it&quot;, and your first stamp lands here.
          </T>
        </View>
      ) : null}

      {special.length > 0 ? <StampGrid title="Special stamps" stamps={special} now={now} /> : null}
      {ordinary.length > 0 ? <StampGrid title="Everything you did" stamps={ordinary} now={now} /> : null}
    </Screen>
  );
}

function StampGrid({ title, stamps, now }: { title: string; stamps: Stamp[]; now: Date }) {
  return (
    <View style={{ gap: 10 }}>
      <T size={16} weight="black">
        {title}
      </T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {stamps.map((stamp, i) => (
          <View key={stamp.key} style={{ width: '33.33%', alignItems: 'center', gap: 4, paddingHorizontal: 4, paddingBottom: 16 }}>
            <StampMark emoji={stamp.emoji} color={PASTELS[i % PASTELS.length]} size={64} special={stamp.special} />
            <T size={13} weight="extra" center lines={2}>
              {stamp.title}
            </T>
            <T size={11} color={colors.muted} center lines={2}>
              {stamp.caption}
            </T>
            <T size={11} color={colors.muted} center>
              {dayLabel(new Date(stamp.done_at), now)}
            </T>
          </View>
        ))}
      </View>
    </View>
  );
}
