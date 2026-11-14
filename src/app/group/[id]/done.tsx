import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { Daisy } from '@/components/daisy';
import { Button, Card, Chip, ErrorNote, Loading, Screen, T, TopBar } from '@/components/ui';
import { fetchDone, fetchGroup, markChanged, restoreIdea, type DoneIdea, type GroupData, type List } from '@/lib/data';
import { dayLabel } from '@/lib/plans';
import { colors } from '@/lib/theme';

export default function ThingsWeDid() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [now] = useState(() => new Date());
  const [done, setDone] = useState<DoneIdea[] | null>(null);
  const [lists, setLists] = useState<List[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const show = useCallback(([group, ideas]: [GroupData | null, DoneIdea[]]) => {
    setLists(group?.lists ?? []);
    setDone(ideas);
  }, []);

  useEffect(() => {
    if (!id) return;
    Promise.all([fetchGroup(id), fetchDone(id)]).then(show, (e: Error) => {
      setError(e.message);
      setDone([]);
    });
  }, [id, show]);

  const putBack = async (idea: DoneIdea) => {
    if (!id || busyId) return;
    setBusyId(idea.id);
    setError(null);
    try {
      await restoreIdea(idea.id);
      markChanged(id);
      show(await Promise.all([fetchGroup(id), fetchDone(id)]));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not put it back.');
    } finally {
      setBusyId(null);
    }
  };

  if (done === null) return <Loading />;

  const back = () => (router.canGoBack() ? router.back() : router.replace(`/group/${id}` as never));

  return (
    <Screen>
      <TopBar title="Things we did" subtitle={done.length ? (done.length === 1 ? '1 so far' : `${done.length} so far`) : undefined} backTo={`/group/${id}`} />
      <ErrorNote message={error} />
      {done.length === 0 && !error ? (
        <View style={{ alignItems: 'center', gap: 10, paddingVertical: 32 }}>
          <Daisy size={64} petal={colors.today} />
          <T size={22} weight="black" center>
            Nothing done yet
          </T>
          <T weight="medium" color={colors.muted} center>
            When a plan happens, tap &quot;We did it&quot; and it will be remembered here.
          </T>
          <Button label="Back to the group" kind="soft" small onPress={back} />
        </View>
      ) : null}
      {done.map((idea) => {
        const when = dayLabel(new Date(idea.done_at), now);
        const list = lists.find((l) => l.id === idea.list_id)?.name;
        return (
          <Card key={idea.id}>
            <View style={{ gap: 2 }}>
              <T size={13} weight="extra" color={colors.mintText}>
                Done {when === 'Today' || when === 'Yesterday' ? when.toLowerCase() : when}
              </T>
              <T size={17} weight="extra">
                {idea.title}
              </T>
              {list ? (
                <T size={13} color={colors.muted}>
                  {list}
                </T>
              ) : null}
            </View>
            {idea.note ? (
              <T size={14} weight="medium">
                {idea.note}
              </T>
            ) : null}
            <View style={{ flexDirection: 'row' }}>
              <Chip
                label={busyId === idea.id ? 'Putting it back...' : 'Put it back on the list'}
                accessibilityLabel={`Put ${idea.title} back on the list`}
                onPress={() => putBack(idea)}
              />
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}
