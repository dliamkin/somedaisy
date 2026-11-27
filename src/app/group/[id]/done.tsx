import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Daisy } from '@/components/daisy';
import { DeleteDoneDialog, DeleteDoneLink } from '@/components/delete-done';
import { AgainChoice, PointsBar } from '@/components/together';
import { Button, Card, Chip, ErrorNote, FlowerCard, Loading, Screen, SHOW_AT_ONCE, ShowMore, T, TopBar } from '@/components/ui';
import { fetchDone, fetchGroup, markChanged, restoreIdea, type DoneIdea, type GroupData } from '@/lib/data';
import { dayLabel } from '@/lib/plans';
import { answersFor, myAnswer, onShelf, type DoAgainVote } from '@/lib/points';
import { useSession } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import { canUndoDone, doItAgain, fetchDoAgainVotes, setDoAgain, undoDone, UNDO_MINUTES } from '@/lib/together';

type Loaded = { group: GroupData | null; done: DoneIdea[]; votes: DoAgainVote[] | null };

/** Things we did: the do-again shelf, and everything the group has done with the do-again question. */
export default function ThingsWeDid() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useSession();
  const [now] = useState(() => new Date());
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // A group that has done a great deal shows its latest first. "Show more" brings the next few.
  const [most, setMost] = useState(SHOW_AT_ONCE);
  // The thing whose "Delete" was tapped, while the app asks to be sure.
  const [deleting, setDeleting] = useState<DoneIdea | null>(null);

  const read = useCallback(async (groupId: string): Promise<Loaded> => {
    const [group, done, votes] = await Promise.all([fetchGroup(groupId), fetchDone(groupId), fetchDoAgainVotes(groupId)]);
    return { group, done, votes };
  }, []);

  useEffect(() => {
    if (!id) return;
    read(id).then(setLoaded, (e: Error) => {
      setError(e.message);
      setLoaded({ group: null, done: [], votes: null });
    });
  }, [id, read]);

  // Run one change to an idea, then show the screen as it now stands.
  const change = async (ideaId: string, what: () => Promise<void>, failed: string) => {
    if (!id || busyId) return;
    setBusyId(ideaId);
    setError(null);
    try {
      await what();
      markChanged(id);
      setLoaded(await read(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : failed);
    } finally {
      setBusyId(null);
    }
  };

  if (loaded === null) return <Loading />;

  const { group, done, votes } = loaded;
  const back = () => (router.canGoBack() ? router.back() : router.replace(`/group/${id}` as never));
  const memberIds = (group?.members ?? []).map((m) => m.user_id);
  const listName = (listId: string) => group?.lists.find((l) => l.id === listId)?.name;
  const shelf = votes ? done.filter((idea) => onShelf(idea.id, memberIds, votes)) : [];
  const everyone = memberIds.length;

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <TopBar title="Things we did" subtitle={done.length ? (done.length === 1 ? '1 so far' : `${done.length} so far`) : undefined} backTo={`/group/${id}`} />
        <ErrorNote message={error} />

        {group && group.points !== null ? (
          <Card style={{ padding: 16, gap: 10 }}>
            <PointsBar points={group.points} />
            <Button label="See your stamps" kind="outline" small onPress={() => router.push(`/group/${id}/stamps` as never)} />
          </Card>
        ) : null}

        {done.length === 0 && !error ? (
          <View style={{ alignItems: 'center', gap: 10, paddingVertical: 32 }}>
            <Daisy size={64} petal={colors.today} />
            <T size={22} weight="black" center>
              Nothing done yet
            </T>
            <T weight="medium" color={colors.textMuted} center>
              When a plan happens, tap &quot;We did it&quot; and it will be remembered here.
            </T>
            <Button label="Back to the group" kind="soft" small onPress={back} />
          </View>
        ) : null}

        {votes && done.length > 0 ? (
          <View style={{ gap: 10 }}>
            <T size={16} weight="black">
              Do-again shelf
            </T>
            {shelf.length === 0 ? (
              <T size={14} weight="medium" color={colors.textMuted}>
                Nothing here yet. When everyone says they would do something again, it lands on this shelf for the nights nobody has an idea.
              </T>
            ) : null}
            {shelf.map((idea) => (
              <FlowerCard key={idea.id}>
                <View style={{ gap: 2 }}>
                  <T size={17} weight="extra">
                    {idea.title}
                  </T>
                  <T size={13} color={colors.textMuted}>
                    {everyone === 2 ? 'You would both do it again' : 'Everyone would do it again'}
                  </T>
                </View>
                <Button
                  label="Do it again"
                  small
                  busy={busyId === idea.id}
                  onPress={() => change(idea.id, () => doItAgain(idea.id), 'Could not put it back on the list.')}
                />
              </FlowerCard>
            ))}
          </View>
        ) : null}

        {done.length > 0 ? (
          <T size={16} weight="black">
            Everything you did
          </T>
        ) : null}

        {done.slice(0, most).map((idea) => {
          const when = dayLabel(new Date(idea.done_at), now);
          const list = listName(idea.list_id);
          const answers = votes ? answersFor(idea.id, memberIds, votes) : null;
          return (
            <Card key={idea.id}>
              <View style={{ gap: 2 }}>
                <T size={13} weight="extra" color={colors.good}>
                  Done {when === 'Today' || when === 'Yesterday' ? when.toLowerCase() : when}
                </T>
                <T size={17} weight="extra">
                  {idea.title}
                </T>
                {list ? (
                  <T size={13} color={colors.textMuted}>
                    {list}
                  </T>
                ) : null}
              </View>
              {idea.note ? (
                <T size={14} weight="medium">
                  {idea.note}
                </T>
              ) : null}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Share ${idea.title} as a picture`}
                  onPress={() => router.push(`/group/${id}/share?idea=${idea.id}` as never)}
                  style={{ minHeight: 44, justifyContent: 'center' }}>
                  <T size={14} weight="extra" color={colors.link}>
                    Share as a picture
                  </T>
                </Pressable>
                {/* For something the group would rather not keep. It asks to be sure first. */}
                <DeleteDoneLink title={idea.title} disabled={busyId !== null} onPress={() => setDeleting(idea)} />
              </View>
              {/* Only while the mark is fresh, and only once undo is set up alongside points. */}
              {votes && canUndoDone(idea.done_at, now) ? (
                <View style={{ gap: 6, alignItems: 'flex-start' }}>
                  <Chip
                    soft
                    label={busyId === idea.id ? 'Undoing...' : 'Marked by mistake? Undo'}
                    accessibilityLabel={`Undo, we have not done ${idea.title}`}
                    onPress={() =>
                      change(
                        idea.id,
                        async () => {
                          if (!(await undoDone(idea.id))) throw new Error('It is too late to undo that one, so it stays done.');
                        },
                        'Could not undo that.',
                      )
                    }
                  />
                  <T size={13} color={colors.textMuted}>
                    For {UNDO_MINUTES} minutes after marking. It goes back on its list and its points and stamp are taken back.
                  </T>
                </View>
              ) : null}
              {votes && answers && userId ? (
                <View style={{ gap: 6 }}>
                  <T size={14} weight="extra">
                    Would you do it again?
                  </T>
                  <AgainChoice
                    answer={myAnswer(idea.id, userId, votes)}
                    disabled={busyId !== null}
                    onAnswer={(again) => change(idea.id, () => setDoAgain(id as string, idea.id, userId, again), 'Could not save your answer.')}
                  />
                  {everyone > 1 ? (
                    <T size={13} color={colors.textMuted}>
                      {answers.yes} of {everyone} said yes
                      {answers.waiting > 0 ? `, ${answers.waiting} still to answer` : ''}
                    </T>
                  ) : null}
                </View>
              ) : (
                // Before the do-again shelf is set up in the database, a done idea can simply be put back.
                <View style={{ flexDirection: 'row' }}>
                  <Chip
                    label={busyId === idea.id ? 'Putting it back...' : 'Put it back on the list'}
                    accessibilityLabel={`Put ${idea.title} back on the list`}
                    onPress={() => change(idea.id, () => restoreIdea(idea.id), 'Could not put it back.')}
                  />
                </View>
              )}
            </Card>
          );
        })}
        <ShowMore shown={Math.min(most, done.length)} total={done.length} onMore={() => setMost(most + SHOW_AT_ONCE)} />
      </Screen>
      {deleting && id ? (
        <DeleteDoneDialog
          groupId={id}
          idea={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={async () => {
            // The page is read afresh first, so the thing is gone from behind the question as it shuts.
            const fresh = await read(id).catch(() => null);
            if (fresh) setLoaded(fresh);
            setDeleting(null);
          }}
        />
      ) : null}
    </View>
  );
}
