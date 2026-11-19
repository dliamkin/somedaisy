import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { CheckIcon, Daisy } from '@/components/daisy';
import { ListTile } from '@/components/list-tile';
import { Button, Card, ErrorNote, Field, Loading, Screen, T, TopBar } from '@/components/ui';
import { fetchGroup, openList, type GroupData } from '@/lib/data';
import { kindOf, optionsOf } from '@/lib/list-options';
import { lookFor } from '@/lib/looks';
import { useTheme } from '@/lib/theme';

// From this many lists up, there is a box to type part of a name in.
const FIND_FROM = 8;

/**
 * Every list in the group, one under the other, each with its icon and how many ideas it holds.
 * The row of list tabs on the group page only has room for a few, so this is where to find one
 * among many. Tapping a list shuts the page and shows that list.
 */
export default function AllLists() {
  const { colors } = useTheme();
  const { id, list } = useLocalSearchParams<{ id: string; list?: string }>();
  const [group, setGroup] = useState<GroupData | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [find, setFind] = useState('');

  useEffect(() => {
    if (!id) return;
    fetchGroup(id).then(setGroup, (e: Error) => {
      setError(e.message);
      setGroup(null);
    });
  }, [id]);

  const back = () => (router.canGoBack() ? router.back() : router.replace(`/group/${id}` as never));
  const pick = (listId: string | null) => {
    if (id) openList(id, { id: listId });
    back();
  };

  if (group === undefined) return <Loading />;

  const lists = group?.lists ?? [];
  const wanted = find.trim().toLowerCase();
  const shown = wanted ? lists.filter((l) => l.name.toLowerCase().includes(wanted)) : lists;
  const count = (listId: string) => group?.ideas.filter((i) => i.list_id === listId).length ?? 0;
  const ideasLine = (n: number) => (n === 0 ? 'Nothing yet' : n === 1 ? '1 idea' : `${n} ideas`);

  const row = (key: string, picture: ReactNode, name: string, about: string, on: boolean, onPress: () => void) => (
    <Pressable
      key={key}
      accessibilityRole="button"
      accessibilityLabel={`${name}. ${about}`}
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minHeight: 60,
        padding: 8,
        borderRadius: 18,
        borderWidth: 2,
        borderColor: on ? colors.button : 'transparent',
        backgroundColor: on ? colors.voteOn : 'transparent',
        opacity: pressed ? 0.6 : 1,
      })}>
      {picture}
      <View style={{ flex: 1 }}>
        <T size={16} weight="extra" lines={1}>
          {name}
        </T>
        <T size={13} color={colors.textMuted} lines={1}>
          {about}
        </T>
      </View>
      {on ? <CheckIcon color={colors.link} size={18} /> : null}
    </Pressable>
  );

  return (
    <Screen footer={<Button label="New list" kind="soft" onPress={() => router.replace(`/group/${id}/new-list` as never)} />}>
      <TopBar title="Lists" subtitle={lists.length === 1 ? '1 list' : `${lists.length} lists`} backTo={`/group/${id}`} close />
      <ErrorNote message={error} />
      {lists.length >= FIND_FROM ? <Field label="Find a list" value={find} onChangeText={setFind} placeholder="Type part of its name" maxLength={40} /> : null}
      <Card style={{ padding: 8, gap: 2 }}>
        {wanted
          ? null
          : row(
              'newest',
              <View style={{ width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
                <Daisy size={28} />
              </View>,
              'Newest',
              'Every list together, newest first',
              !list,
              () => pick(null),
            )}
        {shown.map((l) => {
          const look = lookFor(l, Math.max(0, lists.indexOf(l)));
          const about = kindOf(optionsOf(l)) === 'keep' ? `${ideasLine(count(l.id))} · Just a list` : ideasLine(count(l.id));
          return row(l.id, <ListTile flat icon={look.icon} color={look.color} size={44} />, l.name, about, l.id === list, () => pick(l.id));
        })}
        {wanted && shown.length === 0 ? (
          <View style={{ padding: 12 }}>
            <T size={14} weight="medium" color={colors.textMuted}>
              No list has that in its name.
            </T>
          </View>
        ) : null}
      </Card>
    </Screen>
  );
}
