import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { PopIn } from '@/components/celebrate';
import { Daisy, CheckIcon } from '@/components/daisy';
import { barSays, StampMark, ThinBar } from '@/components/together';
import { Button, Card, ErrorNote, Loading, Screen, T, TopBar } from '@/components/ui';
import { fetchLists, type List } from '@/lib/data';
import { TILE_COLORS } from '@/lib/looks';
import { dayLabel } from '@/lib/plans';
import { levelFor, stampsFor, TITLES, totalPoints, type Completion, type Stamp } from '@/lib/points';
import { useTheme } from '@/lib/theme';
import { fetchCompletions } from '@/lib/together';


/** The group's passport: its title and points, and a stamp for everything it has done. */
export default function Stamps() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [now, setNow] = useState(() => new Date());
  const [completions, setCompletions] = useState<Completion[] | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  // The group's lists, for each stamp's icon and colour. Without them the stamps still show, guessed from list names.
  const [lists, setLists] = useState<List[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      let alive = true;
      Promise.all([fetchCompletions(id), fetchLists(id).catch(() => [] as List[])]).then(
        ([c, l]) => {
          if (!alive) return;
          setLists(l);
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
        <T weight="medium" color={colors.textMuted}>
          {error ? 'Your stamps could not be loaded. Check your connection, then try again.' : 'Stamps are not available yet. Try again later.'}
        </T>
      </Screen>
    );
  }

  const points = totalPoints(completions);
  const level = levelFor(points);
  const { special, ordinary } = stampsFor(completions, lists);
  const listsTried = new Set(ordinary.map((s) => s.list)).size;

  return (
    <Screen>
      <TopBar title="Stamps" subtitle={completions.length === 1 ? '1 thing done together' : `${completions.length} things done together`} backTo={`/group/${id}`} />

      <Card style={{ padding: 18, gap: 14 }}>
        <View>
          <T size={14} color={colors.textMuted}>
            Your group is
          </T>
          <T size={32} weight="black" style={{ lineHeight: 36 }}>
            {level.title}
          </T>
        </View>
        {/* The points so far, and how far it is to the next rank. There is room to name it here. */}
        <View accessible accessibilityLabel={barSays(level)} style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <T size={15} weight="black" lines={1} style={{ flex: 1 }}>
              {points} {points === 1 ? 'point' : 'points'}
            </T>
            <T size={13} color={colors.textMuted} lines={1}>
              {level.next ? `${level.toNext} to ${level.next.title}` : 'Top rank'}
            </T>
          </View>
          <ThinBar progress={level.progress} />
        </View>
        {/* The ladder: every rank, the highest at the top. */}
        <View style={{ gap: 2 }}>
          {TITLES.map((t, i) => ({ ...t, i }))
            .reverse()
            .map(({ title, at, i }) => {
              const here = i === level.index;
              const passed = i < level.index;
              return (
                <View
                  key={title}
                  accessible
                  accessibilityLabel={`${title}, ${at} points${here ? ', you are here' : passed ? ', reached' : ''}`}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    minHeight: 38,
                    paddingHorizontal: 10,
                    borderRadius: 14,
                    borderWidth: 2,
                    borderColor: here ? colors.accent : 'transparent',
                    backgroundColor: here ? colors.selected : 'transparent',
                  }}>
                  <View style={{ width: 28, alignItems: 'center', justifyContent: 'center' }}>
                    {here ? (
                      <Daisy size={28} petal={colors.button} />
                    ) : passed ? (
                      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.button, alignItems: 'center', justifyContent: 'center' }}>
                        <CheckIcon />
                      </View>
                    ) : (
                      <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.outline }} />
                    )}
                  </View>
                  <T size={here ? 17 : 15} weight={here ? 'black' : passed ? 'extra' : 'bold'} color={here || passed ? colors.text : colors.textMuted} lines={1} style={{ flex: 1 }}>
                    {title}
                  </T>
                  {here ? (
                    <T size={13} color={colors.textMuted}>
                      You are here
                    </T>
                  ) : null}
                </View>
              );
            })}
        </View>
        <T size={13} weight="medium" color={colors.textMuted}>
          Points come from doing things together, not from adding ideas or voting. They never go down.
        </T>
      </Card>

      {completions.length > 0 ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Tally count={ordinary.length} label={ordinary.length === 1 ? 'stamp' : 'stamps'} />
          <Tally count={special.length} label={special.length === 1 ? 'special stamp' : 'special stamps'} />
          <Tally count={listsTried} label={listsTried === 1 ? 'list tried' : 'lists tried'} />
        </View>
      ) : null}

      {completions.length === 0 ? (
        <View style={{ alignItems: 'center', gap: 10, paddingVertical: 24 }}>
          <StampMark icon="daisy" color={TILE_COLORS[0]} size={72} tilt={-6} />
          <T size={20} weight="black" center>
            No stamps yet
          </T>
          <T weight="medium" color={colors.textMuted} center>
            Do something from your lists, tap &quot;We did it&quot;, and your first stamp lands here.
          </T>
        </View>
      ) : null}

      {special.length > 0 ? <StampGrid title="Special stamps" stamps={special} now={now} big /> : null}
      {ordinary.length > 0 ? <StampGrid title="Everything you did" stamps={ordinary} now={now} /> : null}
    </Screen>
  );
}

/** One number from the page's tally, on a small white tile. */
function Tally({ count, label }: { count: number; label: string }) {
  const { colors } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${count} ${label}`}
      style={{ flex: 1, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4, borderRadius: 20, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.line }}>
      <T size={26} weight="black" color={colors.button}>
        {count}
      </T>
      <T size={13} weight="extra" center>
        {label}
      </T>
    </View>
  );
}

// Each stamp sits a little crooked, as if pressed on by hand. The turns repeat down the page.
const TILTS = [-7, 5, -3, 8, -5, 3];

function StampGrid({ title, stamps, now, big }: { title: string; stamps: Stamp[]; now: Date; big?: boolean }) {
  const { colors } = useTheme();
  return (
    <Card style={{ padding: 18, gap: 14 }}>
      <T size={16} weight="black">
        {title}
      </T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {stamps.map((stamp, i) => (
          <View key={stamp.key} style={{ width: '33.33%', alignItems: 'center', gap: 4, paddingHorizontal: 4, paddingBottom: 16 }}>
            {/* The stamps land one after another. Only the first dozen wait their turn, so a long page is not slow. */}
            <PopIn delay={Math.min(i, 12) * 70}>
              <StampMark icon={stamp.icon} color={stamp.color} size={big ? 72 : 60} special={stamp.special} tilt={TILTS[i % TILTS.length]} />
            </PopIn>
            <T size={13} weight="extra" center lines={2}>
              {stamp.title}
            </T>
            <T size={11} color={colors.textMuted} center lines={2}>
              {stamp.caption}
            </T>
            <T size={11} color={colors.textMuted} center>
              {dayLabel(new Date(stamp.done_at), now)}
            </T>
          </View>
        ))}
      </View>
    </Card>
  );
}
