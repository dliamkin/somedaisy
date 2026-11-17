import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Switch, View } from 'react-native';

import { PopIn, useReducedMotion } from '@/components/celebrate';
import { Daisy } from '@/components/daisy';
import { ListTile } from '@/components/list-tile';
import { Button, Card, Chip, ErrorNote, Loading, Screen, T, TopBar } from '@/components/ui';
import { fetchGroup, type GroupData, type Idea } from '@/lib/data';
import { optionsOf } from '@/lib/list-options';
import { lookFor } from '@/lib/looks';
import { ANY, pickOne, pickPool, SETTINGS, tagLine, TAKES, type PickFilter } from '@/lib/pick';
import { colors } from '@/lib/theme';

// How the pick is drawn out: a different idea's name flashes by every so often, for a moment.
const FLASH_MS = 90;
const FLASHES = 14;

/** Pick for us: say what time there is, and the app picks one of the ideas everyone is in on. */
export default function PickForUs() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const reduced = useReducedMotion();
  const [group, setGroup] = useState<GroupData | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<PickFilter>(ANY);
  // The idea picked, by id, and how many picks there have been (so each one pops in afresh).
  const [picked, setPicked] = useState<{ id: string; turn: number } | null>(null);
  // While the pick is being drawn out: the name flashing by right now.
  const [flash, setFlash] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      let alive = true;
      fetchGroup(id).then(
        (g) => alive && setGroup(g),
        (e: Error) => {
          if (!alive) return;
          setError(e.message);
          setGroup(null);
        },
      );
      return () => {
        alive = false;
      };
    }, [id]),
  );

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
    },
    [],
  );

  const back = () => (router.canGoBack() ? router.back() : router.replace(`/group/${id}` as never));

  if (group === undefined) return <Loading />;
  if (!group) {
    return (
      <Screen footer={<Button label="Back to the group" kind="soft" onPress={back} />}>
        <TopBar title="Pick for us" backTo={`/group/${id}`} />
        <ErrorNote message={error} />
        <T weight="medium" color={colors.muted}>
          {error ? 'The ideas could not be loaded. Check your connection, then try again.' : 'That group could not be found.'}
        </T>
      </Screen>
    );
  }

  const pool = pickPool(group, filter);
  // Something picked earlier may have been given a date or removed since. Then it is no longer shown.
  const chosen: Idea | null = picked ? (pool.find((i) => i.id === picked.id) ?? null) : null;
  const spinning = flash !== null;
  const alone = group.members.length === 1;

  const change = (next: Partial<PickFilter>) => {
    if (spinning) return;
    setFilter({ ...filter, ...next });
    setPicked(null);
  };

  const spin = () => {
    if (spinning) return;
    const winner = pickOne(pool, picked?.id ?? null);
    if (!winner) return;
    const land = () => setPicked({ id: winner.id, turn: (picked?.turn ?? 0) + 1 });
    // With one idea, or for people who have asked for less motion, the answer simply appears.
    if (reduced !== false || pool.length < 2) {
      land();
      return;
    }
    let left = FLASHES;
    let last = '';
    setPicked(null);
    setFlash(winner.title);
    timer.current = setInterval(() => {
      left -= 1;
      if (left <= 0) {
        if (timer.current) clearInterval(timer.current);
        timer.current = null;
        setFlash(null);
        land();
        return;
      }
      const others = pool.filter((i) => i.title !== last);
      last = others[Math.floor(Math.random() * others.length)]?.title ?? winner.title;
      setFlash(last);
    }, FLASH_MS);
  };

  const place = chosen ? group.lists.findIndex((l) => l.id === chosen.list_id) : -1;
  const list = place === -1 ? null : group.lists[place];
  const look = lookFor(list, Math.max(0, place));
  const details = chosen ? [list?.name, tagLine(chosen)].filter(Boolean).join(' · ') : '';

  return (
    <Screen footer={<Button label={chosen ? 'Pick another' : 'Pick for us'} onPress={spin} disabled={pool.length === 0 || (Boolean(chosen) && pool.length < 2)} busy={spinning} />}>
      <TopBar title="Pick for us" subtitle="Can't decide? Let the daisy choose." backTo={`/group/${id}`} />

      <View style={{ gap: 8 }}>
        <T size={16} weight="extra">
          How much time do you have?
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Chip label="Any" selected={filter.time === null} onPress={() => change({ time: null })} />
          {TAKES.map((t) => (
            <Chip key={t.value} label={t.label} selected={filter.time === t.value} onPress={() => change({ time: t.value })} />
          ))}
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <T size={16} weight="extra">
          Staying in or going out?
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Chip label="Either" selected={filter.setting === null} onPress={() => change({ setting: null })} />
          {SETTINGS.map((s) => (
            <Chip key={s.value} label={s.label} selected={filter.setting === s.value} onPress={() => change({ setting: s.value })} />
          ))}
        </View>
      </View>

      {group.lists.length > 1 ? (
        <View style={{ gap: 8 }}>
          <T size={16} weight="extra">
            From which list?
          </T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Chip label="Any list" selected={filter.listId === null} onPress={() => change({ listId: null })} />
            {group.lists.map((l) => (
              <Chip key={l.id} label={l.name} selected={filter.listId === l.id} onPress={() => change({ listId: l.id })} />
            ))}
          </View>
        </View>
      ) : null}

      {alone ? null : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <T size={16} weight="extra">
              Include ideas still waiting on someone
            </T>
            <T size={14} color={colors.muted}>
              Never one that somebody said &quot;Eh&quot; to
            </T>
          </View>
          <Switch
            accessibilityLabel="Include ideas still waiting on someone"
            value={filter.undecided}
            onValueChange={(undecided) => change({ undecided })}
            trackColor={{ true: colors.grape, false: '#8E80A3' }}
            thumbColor={colors.white}
          />
        </View>
      )}

      <ErrorNote message={error} />

      {spinning ? (
        <Card style={{ padding: 22, alignItems: 'center', gap: 10 }}>
          <Daisy size={48} petal={colors.today} />
          <T size={20} weight="black" center lines={2}>
            {flash}
          </T>
        </Card>
      ) : chosen ? (
        <PopIn key={picked?.turn}>
          <Card style={{ padding: 18, gap: 14 }}>
            <T size={13} weight="extra" color={colors.pink}>
              THE DAISY SAYS
            </T>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <ListTile icon={look.icon} color={look.color} size={56} />
              <View style={{ flex: 1, gap: 2 }}>
                <T size={22} weight="black">
                  {chosen.title}
                </T>
                {details ? (
                  <T size={13} color={colors.muted}>
                    {details}
                  </T>
                ) : null}
              </View>
            </View>
            {chosen.note ? (
              <T size={14} weight="medium">
                {chosen.note}
              </T>
            ) : null}
            {/* Not on a list whose ideas have no dates, such as one of song titles. */}
            {optionsOf(list).dates ? <Button label="Pick a date" small onPress={() => router.push(`/group/${group.id}/plan?idea=${chosen.id}` as never)} /> : null}
          </Card>
        </PopIn>
      ) : pool.length === 0 ? (
        <View style={{ alignItems: 'center', gap: 10, paddingVertical: 20 }}>
          <Daisy size={56} petal={colors.today} />
          <T size={20} weight="black" center>
            Nothing to pick from
          </T>
          <T weight="medium" color={colors.muted} center>
            {alone
              ? 'The daisy picks among ideas you gave an "I\'m down" that have no date yet. Try a wider choice above, or add some ideas.'
              : filter.undecided
                ? 'No idea without a date fits. Try a wider choice above.'
                : 'The daisy picks among ideas everyone is in on that have no date yet. Try a wider choice above, or include ideas still waiting on someone.'}
          </T>
        </View>
      ) : (
        <T weight="medium" color={colors.muted} center>
          {pool.length === 1 ? '1 idea to pick from' : `${pool.length} ideas to pick from`}
        </T>
      )}
    </Screen>
  );
}
