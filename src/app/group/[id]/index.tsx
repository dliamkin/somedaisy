import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';

import { Daisy, PlusIcon } from '@/components/daisy';
import { Avatar, Button, Card, Chip, CircleButton, ErrorNote, Field, Loading, Screen, T, TopBar } from '@/components/ui';
import { addList, everyoneIn, fetchGroup, markDone, setReaction, takeChanged, type GroupData, type Idea } from '@/lib/data';
import { formatPlan, isPast, plannedIdeas } from '@/lib/plans';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { colors, REACTIONS } from '@/lib/theme';

export default function GroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useSession();
  const [group, setGroup] = useState<GroupData | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [listId, setListId] = useState<string | null>(null);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [newList, setNewList] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState<Idea | null>(null);
  const [confirmDone, setConfirmDone] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const notifyRef = useRef<() => void>(() => {});

  const load = useCallback(async () => {
    if (!id) return null;
    try {
      const g = await fetchGroup(id);
      setGroup(g);
      setNow(new Date());
      setError(null);
      return g;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the group.');
      return null;
    }
  }, [id]);

  // Live updates: members ping each other on a shared channel, and everyone reloads.
  useEffect(() => {
    if (!supabase || !id) return;
    const client = supabase;
    const channel = client.channel(`group:${id}`, { config: { broadcast: { self: false } } });
    channel.on('broadcast', { event: 'changed' }, () => {
      void load();
    });
    channel.subscribe();
    notifyRef.current = () => {
      void channel.send({ type: 'broadcast', event: 'changed', payload: {} });
    };
    return () => {
      notifyRef.current = () => {};
      void client.removeChannel(channel);
    };
  }, [id, load]);

  // Reload when the screen comes back into view, and every 20 seconds as a safety net.
  useFocusEffect(
    useCallback(() => {
      void load().then(() => {
        if (id && takeChanged(id)) notifyRef.current();
      });
      const timer = setInterval(() => void load(), 20000);
      return () => clearInterval(timer);
    }, [id, load]),
  );

  const activeList = useMemo(() => {
    if (!group) return null;
    return group.lists.find((l) => l.id === listId) ?? group.lists[0] ?? null;
  }, [group, listId]);

  if (group === undefined && !error) return <Loading />;
  if (!group || !userId) {
    return (
      <Screen footer={<Button label="Back to groups" kind="soft" onPress={() => router.replace('/')} />}>
        <T size={26} weight="black">
          Group not found
        </T>
        <ErrorNote message={error} />
        <T weight="medium" color={colors.muted}>
          You may need an invite link to see this group.
        </T>
      </Screen>
    );
  }

  const react = async (idea: Idea, emoji: string) => {
    const mine = group.reactions.some((r) => r.idea_id === idea.id && r.user_id === userId && r.emoji === emoji);
    const wasIn = everyoneIn(idea.id, group.members, group.reactions);
    setPickerFor(null);
    try {
      await setReaction(group.id, idea.id, userId, emoji, !mine);
      const fresh = await load();
      notifyRef.current();
      if (fresh && !wasIn && everyoneIn(idea.id, fresh.members, fresh.reactions)) setCelebrate(idea);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your reaction.');
    }
  };

  const saveList = async () => {
    const name = (newList ?? '').trim();
    if (!name) return;
    try {
      await addList(group.id, name, group.lists.length + 1);
      setNewList(null);
      const fresh = await load();
      notifyRef.current();
      const created = fresh?.lists.find((l) => l.name === name);
      if (created) setListId(created.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add the list.');
    }
  };

  const finish = async (idea: Idea) => {
    setConfirmDone(null);
    try {
      await markDone(idea.id);
      await load();
      notifyRef.current();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not mark it as done.');
    }
  };

  const openPlan = (idea: Idea) => router.push(`/group/${group.id}/plan?idea=${idea.id}` as never);
  const openComments = (idea: Idea) => router.push(`/group/${group.id}/comments?idea=${idea.id}` as never);

  const plans = plannedIdeas(group.ideas);
  const ideas = activeList ? group.ideas.filter((i) => i.list_id === activeList.id) : [];
  const nameOf = (uid: string | null) => (uid === userId ? 'you' : (group.members.find((m) => m.user_id === uid)?.name ?? 'someone'));

  return (
    <View style={{ flex: 1 }}>
      <Screen
        footer={
          activeList ? (
            <Button label="Add an idea" onPress={() => router.push(`/group/${group.id}/add?list=${activeList.id}` as never)} />
          ) : null
        }>
        <TopBar
          title={group.name}
          subtitle={group.members.length === 1 ? 'Just you so far' : `${group.members.length} people`}
          backTo="/"
          right={
            <CircleButton label="Invite people" onPress={() => router.push(`/group/${group.id}/invite` as never)}>
              <PlusIcon />
            </CircleButton>
          }
        />
        <ErrorNote message={error} />

        {plans.length > 0 ? (
          <View style={{ gap: 10 }}>
            <T size={16} weight="black">
              Coming up
            </T>
            {plans.map((plan) => {
              const past = isPast(plan.planned_for, now);
              return (
                <Card key={plan.id} style={{ backgroundColor: colors.today }}>
                  <View style={{ gap: 2 }}>
                    <T size={13} weight="extra" color={colors.link}>
                      {formatPlan(plan.planned_for, now)}
                    </T>
                    <T size={17} weight="extra">
                      {plan.title}
                    </T>
                    <T size={13} color={colors.muted}>
                      {past ? 'Did it happen?' : (group.lists.find((l) => l.id === plan.list_id)?.name ?? '')}
                    </T>
                  </View>
                  {confirmDone === plan.id ? (
                    <View style={{ gap: 8 }}>
                      <T size={13} color={colors.muted}>
                        It moves from the list to &quot;Things we did&quot; for everyone.
                      </T>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                        <Chip label="Yes, we did it" selected onPress={() => finish(plan)} />
                        <Chip label="Not yet" onPress={() => setConfirmDone(null)} />
                      </View>
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      <Chip label="We did it" onPress={() => setConfirmDone(plan.id)} />
                      <Chip label="Change date" onPress={() => openPlan(plan)} />
                    </View>
                  )}
                </Card>
              );
            })}
          </View>
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }} style={{ flexGrow: 0 }}>
          {group.lists.map((l) => (
            <Chip key={l.id} label={l.name} dark selected={l.id === activeList?.id} onPress={() => setListId(l.id)} />
          ))}
          <Chip label="+ List" dashed accessibilityLabel="Add a list" onPress={() => setNewList(newList === null ? '' : null)} />
        </ScrollView>

        {newList !== null ? (
          <Card>
            <Field label="New list name" value={newList} onChangeText={setNewList} placeholder="Shows, Games, Trips..." maxLength={40} autoFocus onSubmit={saveList} />
            <Button label="Add list" small onPress={saveList} disabled={!newList.trim()} />
          </Card>
        ) : null}

        {group.lists.length === 0 ? (
          <Card style={{ padding: 18 }}>
            <T size={18} weight="extra">
              Add your first list
            </T>
            <T weight="medium" color={colors.muted}>
              Lists are categories like Movies or Places.
            </T>
          </Card>
        ) : null}

        {activeList && ideas.length === 0 ? (
          <View style={{ alignItems: 'center', gap: 10, paddingVertical: 32 }}>
            <Daisy size={64} petal={colors.today} />
            <T size={22} weight="black" center>
              Nothing in {activeList.name} yet
            </T>
            <T weight="medium" color={colors.muted} center>
              Add the first idea and see who else is in.
            </T>
          </View>
        ) : null}

        {ideas.map((idea) => {
          const rs = group.reactions.filter((r) => r.idea_id === idea.id);
          const count = (e: string) => rs.filter((r) => r.emoji === e).length;
          const mine = (e: string) => rs.some((r) => r.emoji === e && r.user_id === userId);
          const allIn = everyoneIn(idea.id, group.members, group.reactions);
          const waiting = group.members.filter((m) => !rs.some((r) => r.user_id === m.user_id && (r.emoji === '👍' || r.emoji === '👎')));
          const extras = REACTIONS.filter((e) => e !== '👍' && e !== '👎' && count(e) > 0);
          const comments = group.commentCounts[idea.id] ?? 0;
          return (
            <Card key={idea.id}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <T size={17} weight="extra">
                    {idea.title}
                  </T>
                  <T size={13} color={colors.muted}>
                    Added by {nameOf(idea.added_by)}
                  </T>
                </View>
                {allIn ? (
                  <View style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: colors.mint }}>
                    <T size={12} weight="extra" color={colors.mintText}>
                      {group.members.length === 2 ? 'Both in' : "Everyone's in"}
                    </T>
                  </View>
                ) : null}
              </View>
              {idea.note ? (
                <T size={14} weight="medium">
                  {idea.note}
                </T>
              ) : null}
              {idea.link ? (
                <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(idea.link as string)}>
                  <T size={14} color={colors.link} lines={1} style={{ textDecorationLine: 'underline' }}>
                    {idea.link}
                  </T>
                </Pressable>
              ) : null}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                <Chip label={count('👍') ? `👍 ${count('👍')}` : '👍'} accessibilityLabel={`Thumbs up, ${count('👍')}`} selected={mine('👍')} onPress={() => react(idea, '👍')} />
                <Chip label={count('👎') ? `👎 ${count('👎')}` : '👎'} accessibilityLabel={`Thumbs down, ${count('👎')}`} selected={mine('👎')} onPress={() => react(idea, '👎')} />
                {extras.map((e) => (
                  <Chip key={e} label={`${e} ${count(e)}`} selected={mine(e)} onPress={() => react(idea, e)} />
                ))}
                <Chip label="+ emoji" accessibilityLabel="Add a reaction" onPress={() => setPickerFor(pickerFor === idea.id ? null : idea.id)} />
                <Chip
                  label={comments ? `💬 ${comments}` : '💬'}
                  accessibilityLabel={comments === 1 ? '1 comment' : comments ? `${comments} comments` : 'Add a comment'}
                  onPress={() => openComments(idea)}
                />
                {idea.planned_for ? (
                  <Chip
                    label={`📅 ${formatPlan(idea.planned_for, now)}`}
                    accessibilityLabel={`Planned for ${formatPlan(idea.planned_for, now)}. Change date`}
                    selected
                    onPress={() => openPlan(idea)}
                  />
                ) : allIn ? null : (
                  <Chip label="📅 Plan it" accessibilityLabel="Pick a date" onPress={() => openPlan(idea)} />
                )}
              </View>
              {allIn && !idea.planned_for ? <Button label="Pick a date" small onPress={() => openPlan(idea)} /> : null}
              {pickerFor === idea.id ? (
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {REACTIONS.filter((e) => e !== '👍' && e !== '👎').map((e) => (
                    <Chip key={e} label={e} selected={mine(e)} onPress={() => react(idea, e)} />
                  ))}
                </View>
              ) : null}
              {!allIn && waiting.length > 0 && group.members.length > 1 ? (
                <T size={13} color={colors.muted}>
                  Waiting on {waiting.map((m) => (m.user_id === userId ? 'you' : m.name)).join(', ')}
                </T>
              ) : null}
            </Card>
          );
        })}

        <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center', paddingTop: 4 }}>
          {group.members.map((m) => (
            <Avatar key={m.user_id} name={m.name} color={m.color} />
          ))}
        </View>
        <Button label="Things we did" kind="ghost" small onPress={() => router.push(`/group/${group.id}/done` as never)} />
      </Screen>

      {celebrate ? (
        <View
          accessibilityViewIsModal
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.grape, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 20 }}>
          <Daisy size={96} petal={colors.white} />
          <T size={40} weight="black" color={colors.white} center>
            Everyone&apos;s in!
          </T>
          <Card style={{ alignSelf: 'stretch', maxWidth: 420, padding: 16 }}>
            <T size={18} weight="extra">
              {celebrate.title}
            </T>
            <T size={14} color={colors.muted}>
              The whole group said yes.
            </T>
          </Card>
          <View style={{ alignSelf: 'stretch', maxWidth: 420, gap: 10 }}>
            {celebrate.planned_for ? null : (
              <Button
                label="Pick a date"
                kind="soft"
                onPress={() => {
                  const idea = celebrate;
                  setCelebrate(null);
                  openPlan(idea);
                }}
              />
            )}
            <Button label={celebrate.planned_for ? 'Nice' : 'Later'} kind="outline" onPress={() => setCelebrate(null)} />
          </View>
        </View>
      ) : null}
    </View>
  );
}
