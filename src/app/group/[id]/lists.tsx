import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Daisy } from '@/components/daisy';
import { FIND_FROM, ListRow, RowTile } from '@/components/list-chooser';
import { Button, Card, ErrorNote, Field, Loading, Screen, T, TopBar } from '@/components/ui';
import { fetchGroup, listsByName, openList, type GroupData } from '@/lib/data';
import { kindOf, optionsOf } from '@/lib/list-options';
import { useTheme } from '@/lib/theme';

/**
 * Every list in the group, one under the other in order of name, each with its icon and how many
 * ideas it holds. The row of list tabs on the group page only has room for a few, so this is
 * where to find one among many. Tapping a list shuts the page and shows that list.
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
  const sorted = listsByName(lists);
  const shown = wanted ? sorted.filter((l) => l.name.toLowerCase().includes(wanted)) : sorted;
  const count = (listId: string) => group?.ideas.filter((i) => i.list_id === listId).length ?? 0;
  const ideasLine = (n: number) => (n === 0 ? 'Nothing yet' : n === 1 ? '1 idea' : `${n} ideas`);

  return (
    <Screen footer={<Button label="New list" kind="soft" onPress={() => router.replace(`/group/${id}/new-list` as never)} />}>
      <TopBar title="Lists" subtitle={lists.length === 1 ? '1 list' : `${lists.length} lists`} backTo={`/group/${id}`} close />
      <ErrorNote message={error} />
      {lists.length >= FIND_FROM ? <Field label="Find a list" value={find} onChangeText={setFind} placeholder="Type part of its name" maxLength={40} /> : null}
      <Card style={{ padding: 8, gap: 2 }}>
        {/* "Newest" is every list together, so it stays at the top, out of the order of names. */}
        {wanted ? null : (
          <ListRow
            picture={
              <View style={{ width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
                <Daisy size={28} />
              </View>
            }
            name="Newest"
            about="Every list together, newest first"
            on={!list}
            onPress={() => pick(null)}
          />
        )}
        {shown.map((l) => (
          <ListRow
            key={l.id}
            picture={<RowTile list={l} all={lists} />}
            name={l.name}
            about={kindOf(optionsOf(l)) === 'keep' ? `${ideasLine(count(l.id))} · Just a list` : ideasLine(count(l.id))}
            on={l.id === list}
            onPress={() => pick(l.id)}
          />
        ))}
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
