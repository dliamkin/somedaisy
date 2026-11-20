import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, View } from 'react-native';

import { ActionIcon, IconAction } from '@/components/action-icons';
import { ComingUpCard, DoneButtons } from '@/components/coming-up';
import { Daisy } from '@/components/daisy';
import { Emoji } from '@/components/emoji';
import { AgainChoice, EveryonesIn, NewTitle, RankLine, YouDidIt } from '@/components/together';
import { SlideIn } from '@/components/celebrate';
import { ListStrip } from '@/components/list-strip';
import { ListIcon, ListTile } from '@/components/list-tile';
import { PreviewPicture } from '@/components/preview-picture';
import { Avatar, Button, Card, Chip, CircleButton, ErrorNote, Loading, Screen, T, TopBar } from '@/components/ui';
import { everyoneIn, fetchGroup, markDone, newlyAllIn, onLateChange, setReaction, takeChanged, takeListToOpen, type GroupData, type Idea } from '@/lib/data';
import { openLink } from '@/lib/links';
import { countdown, formatPlan, plannedIdeas } from '@/lib/plans';
import { timeAgo } from '@/lib/comments';
import { isToDo, optionsOf } from '@/lib/list-options';
import { gather } from '@/lib/live';
import { lookFor } from '@/lib/looks';
import { cardPicture } from '@/lib/pictures';
import { levelUp, type Completion, type Level } from '@/lib/points';
import { useSession } from '@/lib/session';
import { somedayLabel } from '@/lib/someday';
import { supabase } from '@/lib/supabase';
import { MORE_REACTIONS, useTheme } from '@/lib/theme';
import { fetchAgainPrompts, fetchFreshCompletion, setDoAgain, undoDone, type AgainPrompt } from '@/lib/together';

export default function GroupScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useSession();
  const [group, setGroup] = useState<GroupData | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [listId, setListId] = useState<string | null>(null);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [undoing, setUndoing] = useState(false);
  const [slideFrom, setSlideFrom] = useState<1 | -1>(1);
  const [celebrate, setCelebrate] = useState<Idea | null>(null);
  // Which "mark as done" is asking to be sure: a plan's id for its card at the top, or "card:" and
  // the id for the idea's own card, so only the one that was tapped changes.
  const [confirmDone, setConfirmDone] = useState<string | null>(null);
  // The "you did it" screen for the person who tapped "We did it", with their do-again answer.
  const [didIt, setDidIt] = useState<{ completion: Completion; total: number; reached: Level | null; again: boolean | null } | null>(null);
  // A new title the group reached while this person was looking, thanks to someone else.
  const [newTitle, setNewTitle] = useState<Level | null>(null);
  // Things the group did lately that this person has not said they would do again or not.
  const [prompts, setPrompts] = useState<AgainPrompt[]>([]);
  const pointsRef = useRef<number | null>(null);
  // True while a "mark as done" is being saved, so a second tap does nothing.
  const finishingRef = useRef(false);
  // Who is signed in, for `load` to read without being rebuilt when it becomes known. Rebuilding
  // `load` would restart the live-updates channel below, and a channel restarted at once can go quiet.
  const userRef = useRef(userId);
  useEffect(() => {
    userRef.current = userId;
  }, [userId]);
  const [now, setNow] = useState(() => new Date());
  const notifyRef = useRef<() => void>(() => {});
  // The ideas still waiting on someone at the last load, to notice when one of them gets everyone in.
  const allInRef = useRef<Set<string> | null>(null);

  const load = useCallback(async () => {
    if (!id) return null;
    try {
      const g = await fetchGroup(id);
      if (g) {
        // Whoever gives the last thumbs up, every member with the group open sees the celebration.
        // Nothing is celebrated on the first load, and nothing for an idea that arrives already
        // agreed on (one brought back to be done again): those got there before this visit.
        // Only for things to go and do. A thumbs up from everyone on a list that is just for keeping
        // things, such as names for a band, is not a plan coming together.
        const before = allInRef.current;
        const next = newlyAllIn({ ...g, ideas: g.ideas.filter((i) => isToDo(g.lists.find((l) => l.id === i.list_id), i.planned_for)) }, before);
        allInRef.current = new Set(g.ideas.filter((i) => !everyoneIn(i.id, g.members, g.reactions)).map((i) => i.id));
        if (before && next) setCelebrate(next);
        // The same for points: notice when they carry the group past a new title.
        if (g.points !== null) {
          const had = pointsRef.current;
          pointsRef.current = g.points;
          const reached = had === null ? null : levelUp(had, g.points);
          if (reached) setNewTitle(reached);
        }
        const me = userRef.current;
        if (me) void fetchAgainPrompts(id, me).then(setPrompts, () => {});
      }
      setGroup(g);
      setNow(new Date());
      setError(null);
      return g;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the group.');
      return null;
    }
  }, [id]);

  // Live updates: a "something changed" signal arrives on the group's channel, and the group is
  // loaded again. The database sends one with every change (update 016), whoever made it. The
  // phone that made the change sends one too, which is all there is before that update is run.
  // Signals that arrive together are answered with one load.
  useEffect(() => {
    if (!supabase || !id) return;
    const client = supabase;
    const reload = gather(() => void load());
    const channel = client.channel(`group:${id}`, { config: { broadcast: { self: false } } });
    channel.on('broadcast', { event: 'changed' }, reload.ask);
    channel.subscribe();
    notifyRef.current = () => {
      void channel.send({ type: 'broadcast', event: 'changed', payload: {} });
    };
    return () => {
      notifyRef.current = () => {};
      reload.cancel();
      void client.removeChannel(channel);
    };
  }, [id, load]);

  // A change that lands just after its screen closed, such as a preview picture being found:
  // show it straight away and tell the other members.
  useEffect(() => {
    if (!id) return;
    return onLateChange(id, () => {
      void load().then(() => notifyRef.current());
    });
  }, [id, load]);

  // Reload when the screen comes back into view, and every 20 seconds as a safety net.
  useFocusEffect(
    useCallback(() => {
      // The page of every list, or the page that makes one, may have left word of which list to show.
      const open = id ? takeListToOpen(id) : null;
      if (open && 'id' in open) {
        setSlideFrom(1);
        setListId(open.id);
      }
      void load().then((g) => {
        if (id && takeChanged(id)) notifyRef.current();
        if (open && 'name' in open) {
          // A list that was just made is known by its name. The last of that name, should there be two.
          const made = [...(g?.lists ?? [])].reverse().find((l) => l.name === open.name);
          if (made) {
            setSlideFrom(1);
            setListId(made.id);
          }
        }
      });
      const timer = setInterval(() => void load(), 20000);
      // The countdown on a plan that is coming up moves on once a minute, whether or not a load gets through.
      const tick = setInterval(() => setNow(new Date()), 60000);
      // And when the person comes back to the app, or to this browser tab, from somewhere else.
      // A phone stops listening while the app is in the background, so anything that changed
      // in the meantime was missed.
      const back = AppState.addEventListener('change', (state) => {
        if (state === 'active') void load();
      });
      return () => {
        clearInterval(timer);
        clearInterval(tick);
        back.remove();
      };
    }, [id, load]),
  );

  // No list picked means "Newest": every list's ideas together, most recent first.
  const activeList = useMemo(() => {
    if (!group || !listId) return null;
    return group.lists.find((l) => l.id === listId) ?? null;
  }, [group, listId]);

  if (group === undefined && !error) return <Loading />;
  if (group === undefined) {
    // The group may well exist: it just could not be fetched, for example with no connection.
    return (
      <Screen
        footer={
          <>
            <Button label="Try again" onPress={() => void load()} />
            <Button label="Back to groups" kind="ghost" small onPress={() => router.replace('/')} />
          </>
        }>
        <T size={26} weight="black">
          Could not load this group
        </T>
        <ErrorNote message={error} />
        <T weight="medium" color={colors.textMuted}>
          Check your connection, then try again.
        </T>
      </Screen>
    );
  }
  if (!group || !userId) {
    return (
      <Screen footer={<Button label="Back to groups" kind="soft" onPress={() => router.replace('/')} />}>
        <T size={26} weight="black">
          Group not found
        </T>
        <ErrorNote message={error} />
        <T weight="medium" color={colors.textMuted}>
          You may need an invite link to see this group.
        </T>
      </Screen>
    );
  }

  const react = async (idea: Idea, emoji: string) => {
    const mine = group.reactions.some((r) => r.idea_id === idea.id && r.user_id === userId && r.emoji === emoji);
    setPickerFor(null);
    try {
      await setReaction(group.id, idea.id, userId, emoji, !mine);
      // Loading notices when this was the thumbs up that got everyone in.
      await load();
      notifyRef.current();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your reaction.');
    }
  };

  const finish = async (idea: Idea) => {
    // The confirmation stays as it is while this is saved: the card goes when the idea is done,
    // and the "You did it" screen takes over. Turning the buttons back first would only flicker.
    if (finishingRef.current) return;
    finishingRef.current = true;
    const before = group.points;
    try {
      await markDone(idea.id);
      // The database has just worked out what this earned. Nothing comes back when points are
      // not set up yet, and then the idea is simply done, as before.
      const completion = await fetchFreshCompletion(idea.id).catch(() => null);
      const fresh = await load();
      notifyRef.current();
      if (completion) {
        const total = fresh?.points ?? (before ?? 0) + completion.points;
        setDidIt({ completion, total, reached: before === null ? null : levelUp(before, total), again: null });
      }
      setConfirmDone(null);
    } catch (e) {
      // It was not marked as done, so the buttons go back to how they were.
      setConfirmDone(null);
      setError(e instanceof Error ? e.message : 'Could not mark it as done.');
    } finally {
      finishingRef.current = false;
    }
  };

  // "We did it" was tapped by mistake: the idea goes back on its list and its points and stamp go.
  const undoDidIt = async () => {
    const ideaId = didIt?.completion.idea_id;
    if (!ideaId || undoing) return;
    setUndoing(true);
    try {
      const undone = await undoDone(ideaId);
      setDidIt(null);
      setNewTitle(null);
      if (!undone) setError('It is too late to undo that one, so it stays done.');
      await load();
      notifyRef.current();
    } catch (e) {
      setDidIt(null);
      setError(e instanceof Error ? e.message : 'Could not undo that.');
    } finally {
      setUndoing(false);
    }
  };

  // Save this person's answer to "would you do it again?" and let the others know.
  const answerAgain = async (ideaId: string, again: boolean) => {
    try {
      await setDoAgain(group.id, ideaId, userId, again);
      setPrompts((current) => current.filter((p) => p.id !== ideaId));
      notifyRef.current();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your answer.');
    }
  };
  // One question at a time, and not the one already being asked on the "you did it" screen.
  const prompt = prompts.find((p) => p.id !== didIt?.completion.idea_id) ?? null;

  // Which side the ideas slide in from: the right when moving to a tab further along, else the left.
  const pickList = (next: string | null) => {
    const placeOf = (listKey: string | null) => (listKey ? group.lists.findIndex((l) => l.id === listKey) + 1 : 0);
    setSlideFrom(placeOf(next) >= placeOf(activeList?.id ?? null) ? 1 : -1);
    setListId(next);
  };

  const openPlan = (idea: Idea) => router.push(`/group/${group.id}/plan?idea=${idea.id}` as never);
  const openComments = (idea: Idea) => router.push(`/group/${group.id}/comments?idea=${idea.id}` as never);
  const openEdit = (idea: Idea) => router.push(`/group/${group.id}/edit?idea=${idea.id}` as never);
  // A list is made on a page of its own, so its form is never mixed up with the ideas under it.
  const openNewList = () => router.push(`/group/${group.id}/new-list` as never);

  const plans = plannedIdeas(group.ideas);
  const newestFirst = [...group.ideas].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const ideas = activeList ? newestFirst.filter((i) => i.list_id === activeList.id) : newestFirst;
  // Whether the ideas on a list can be given a date. A list such as "Song titles" may say no.
  const canDate = (idea: Idea) => optionsOf(group.lists.find((l) => l.id === idea.list_id)).dates;
  const nameOf = (uid: string | null) => (uid === userId ? 'you' : (group.members.find((m) => m.user_id === uid)?.name ?? 'someone'));

  return (
    <View style={{ flex: 1 }}>
      <Screen
        flowers
        footer={
          group.lists.length > 0 ? (
            // "Pick for us" appears once there is something to choose between.
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {group.ideas.length > 1 ? <Button label="Pick for us" kind="soft" onPress={() => router.push(`/group/${group.id}/pick` as never)} style={{ flex: 1 }} /> : null}
              <Button label="Add an idea" onPress={() => router.push(`/group/${group.id}/add${activeList ? `?list=${activeList.id}` : ''}` as never)} style={{ flex: 1 }} />
            </View>
          ) : null
        }>
        <TopBar
          title={group.name}
          subtitle={group.members.length === 1 ? "It's just you" : `${group.members.length} people`}
          backTo="/"
          right={
            <CircleButton label="Invite people" onPress={() => router.push(`/group/${group.id}/invite` as never)}>
              <ActionIcon name="invite" color={colors.text} />
            </CircleButton>
          }
        />
        {/* A group of one has nobody to plan with. Until someone joins, the way to invite them stays in
            plain sight here, for anyone who skipped past it when the group was made. */}
        {group.members.length === 1 ? (
          <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1, gap: 2 }}>
              <T size={16} weight="black">
                It is just you in here
              </T>
              <T size={13} color={colors.textMuted}>
                Send your people the invite link so they can join in.
              </T>
            </View>
            <Button label="Invite" small onPress={() => router.push(`/group/${group.id}/invite` as never)} />
          </Card>
        ) : null}
        {/* The group's rank, and its other pages as three round buttons beside it, kept at the top so
            nobody has to scroll past every idea to reach them. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {group.points !== null ? <RankLine points={group.points} onPress={() => router.push(`/group/${group.id}/stamps` as never)} /> : <View style={{ flex: 1 }} />}
          <CircleButton flat label="Calendar" onPress={() => router.push(`/group/${group.id}/calendar` as never)}>
            <ListIcon name="calendar" size={22} color={colors.link} />
          </CircleButton>
          <CircleButton flat label="Things we did" onPress={() => router.push(`/group/${group.id}/done` as never)}>
            <ListIcon name="trophy" size={22} color={colors.link} />
          </CircleButton>
          <CircleButton flat label="Group settings" onPress={() => router.push(`/group/${group.id}/settings` as never)}>
            <ListIcon name="sliders" size={22} color={colors.link} />
          </CircleButton>
        </View>
        <ErrorNote message={error} />

        {prompt && !didIt ? (
          <Card style={{ padding: 16, gap: 10 }}>
            <View style={{ gap: 2 }}>
              <T size={13} weight="extra" color={colors.good}>
                You did it
              </T>
              <T size={17} weight="extra">
                {prompt.title}
              </T>
              <T size={14} weight="medium" color={colors.textMuted}>
                Would you do it again?
              </T>
            </View>
            <AgainChoice answer={null} onAnswer={(again) => void answerAgain(prompt.id, again)} />
          </Card>
        ) : null}

        {plans.map((plan) => (
          <ComingUpCard
            key={plan.id}
            title={plan.title}
            plannedFor={plan.planned_for}
            now={now}
            confirming={confirmDone === plan.id}
            onAskDone={() => setConfirmDone(plan.id)}
            onDone={() => void finish(plan)}
            onNotYet={() => setConfirmDone(null)}
            onChangeDate={() => openPlan(plan)}
          />
        ))}

        <ListStrip
          lists={group.lists}
          activeId={activeList?.id ?? null}
          onPick={pickList}
          onAll={() => router.push(`/group/${group.id}/lists${activeList ? `?list=${activeList.id}` : ''}` as never)}
          onNew={openNewList}
        />

        {group.lists.length === 0 ? (
          <Card style={{ flexDirection: 'row', alignItems: 'center', padding: 18 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <T size={18} weight="extra">
                Add your first list
              </T>
              <T weight="medium" color={colors.textMuted}>
                Lists are categories like Movies or Places.
              </T>
            </View>
            <Button label="Add a list" small onPress={openNewList} />
          </Card>
        ) : null}

        {/* The ideas slide in afresh each time a different list is picked, from the side that list's tab is on. */}
        <SlideIn key={activeList?.id ?? 'newest'} from={slideFrom} style={{ gap: 18 }}>
        {group.lists.length > 0 && ideas.length === 0 ? (
          <View style={{ alignItems: 'center', gap: 10, paddingVertical: 32 }}>
            <Daisy size={64} petal={colors.today} />
            <T size={22} weight="black" center>
              {activeList ? `Nothing in ${activeList.name} yet` : 'No ideas yet'}
            </T>
            <T weight="medium" color={colors.textMuted} center>
              Add the first idea and see who else is in.
            </T>
          </View>
        ) : null}

        {ideas.map((idea) => {
          const place = group.lists.findIndex((l) => l.id === idea.list_id);
          const ideaList = place === -1 ? null : group.lists[place];
          const look = lookFor(ideaList, Math.max(0, place));
          const rs = group.reactions.filter((r) => r.idea_id === idea.id);
          const count = (e: string) => rs.filter((r) => r.emoji === e).length;
          const mine = (e: string) => rs.some((r) => r.emoji === e && r.user_id === userId);
          const allIn = everyoneIn(idea.id, group.members, group.reactions);
          const waiting = group.members.filter((m) => !rs.some((r) => r.user_id === m.user_id && (r.emoji === '👍' || r.emoji === '👎')));
          // Every other emoji someone has used on this idea, in the order they were first used.
          const extras = [...new Set(rs.map((r) => r.emoji))].filter((e) => e !== '👍' && e !== '👎');
          const comments = group.commentCounts[idea.id] ?? 0;
          const latest = group.latestComments[idea.id] ?? [];
          // The clock stops once the idea has a date.
          const clock = idea.planned_for ? null : somedayLabel(idea.created_at, now);
          const dated = canDate(idea);
          // Something to go and do is answered with "I'm in" and can be planned. Something that is only
          // kept on a list, such as a name for a band, gets a thumbs up or down beside the other icons.
          const toDo = isToDo(ideaList, idea.planned_for);
          const ups = count('👍');
          const downs = count('👎');
          const pickEmoji = () => setPickerFor(pickerFor === idea.id ? null : idea.id);
          // The idea's own picture if it has one, otherwise the picture of the page it links to.
          const shown = cardPicture(idea);
          return (
            <Card key={idea.id}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                {/* Every idea gets a picture, so no card is bare: its list's icon on the list's colour. */}
                <ListTile icon={look.icon} color={look.color} />
                <View style={{ flex: 1, gap: 2 }}>
                  <T size={17} weight="extra">
                    {idea.title}
                  </T>
                  <T size={13} color={colors.textMuted}>
                    {/* Under "Newest" the lists are mixed together, so each card says which it is from. */}
                    {!activeList && ideaList ? `${ideaList.name} · ` : ''}
                    Added by {nameOf(idea.added_by)}
                    {clock ? ` · ${clock}` : ''}
                  </T>
                </View>
                {allIn && toDo ? (
                  <View style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: colors.mint }}>
                    <T size={12} weight="extra" color={colors.mintText}>
                      {group.members.length === 2 ? 'Both in' : "Everyone's in"}
                    </T>
                  </View>
                ) : null}
              </View>
              {/* The picture runs from one edge of the card to the other, so it does not read as a card inside a card. */}
              {shown ? <PreviewPicture uri={shown} label={idea.title} bleed={14} onPress={idea.link ? () => openLink(idea.link as string) : undefined} /> : null}
              {idea.note ? (
                <T size={14} weight="medium">
                  {idea.note}
                </T>
              ) : null}
              {idea.link ? (
                <Pressable accessibilityRole="link" onPress={() => openLink(idea.link as string)}>
                  <T size={14} color={colors.link} lines={1} style={{ textDecorationLine: 'underline' }}>
                    {idea.link}
                  </T>
                </Pressable>
              ) : null}
              {/* The votes are small, so the card stays about the idea. A list that is only for keeping
                  things has no row of votes: its thumbs and emoji sit with the icons further down. */}
              {toDo ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                  <Chip soft small label={ups ? `I'm in · ${ups}` : "I'm in"} accessibilityLabel={`I'm in, ${ups}`} selected={mine('👍')} onPress={() => react(idea, '👍')} />
                  <Chip soft small label={downs ? `Eh · ${downs}` : 'Eh'} accessibilityLabel={`Eh, ${downs}`} selected={mine('👎')} onPress={() => react(idea, '👎')} />
                  {extras.map((e) => (
                    <Chip soft small key={e} before={<Emoji char={e} size={18} />} label={String(count(e))} accessibilityLabel={`${e}, ${count(e)}`} selected={mine(e)} onPress={() => react(idea, e)} />
                  ))}
                  <Chip soft small label="+ emoji" accessibilityLabel="Add a reaction" onPress={pickEmoji} />
                </View>
              ) : null}
              {pickerFor === idea.id ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                  {MORE_REACTIONS.map((e) => (
                    <Pressable
                      key={e}
                      accessibilityRole="button"
                      accessibilityLabel={`React with ${e}`}
                      accessibilityState={{ selected: mine(e) }}
                      onPress={() => react(idea, e)}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 2,
                        borderColor: mine(e) ? colors.button : 'transparent',
                        backgroundColor: mine(e) ? colors.voteOn : colors.background,
                      }}>
                      <Emoji char={e} size={26} />
                    </Pressable>
                  ))}
                </View>
              ) : null}
              {/* What you can do with the idea, kept apart from the votes above. The three icons each
                  say what they do to a screen reader, and on a computer when the pointer is over them.
                  Giving the idea a date is the main thing to do with it, so it alone has its name on show. */}
              <View style={{ flexDirection: 'row', alignItems: toDo ? 'center' : 'flex-start', justifyContent: 'space-between', gap: toDo ? 8 : 4 }}>
                {toDo ? null : (
                  // The thumbs, then each emoji people have used, then the way to add one: all on the one
                  // line with the other icons. Only when there are more than fit do they run on to a second.
                  <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 2 }}>
                    <IconAction tip="start" icon="up" label={ups === 0 ? 'Thumbs up' : ups === 1 ? 'Thumbs up, 1 person' : `Thumbs up, ${ups} people`} text={ups ? String(ups) : null} on={mine('👍')} onPress={() => react(idea, '👍')} />
                    <IconAction tip="start" icon="down" label={downs === 0 ? 'Thumbs down' : downs === 1 ? 'Thumbs down, 1 person' : `Thumbs down, ${downs} people`} text={downs ? String(downs) : null} on={mine('👎')} onPress={() => react(idea, '👎')} />
                    {extras.map((e) => (
                      <IconAction
                        key={e}
                        noTip
                        icon="emoji"
                        picture={<Emoji char={e} size={22} />}
                        label={count(e) === 1 ? `${e}, 1 person` : `${e}, ${count(e)} people`}
                        text={String(count(e))}
                        on={mine(e)}
                        onPress={() => react(idea, e)}
                      />
                    ))}
                    <IconAction tip="start" icon="emoji" label="Add a reaction" onPress={pickEmoji} />
                  </View>
                )}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: toDo ? 6 : 2 }}>
                  {/* These three sit at the left of the row beside "Plan it", and at the right beside the thumbs. */}
                  <IconAction
                    tip={toDo ? 'start' : 'end'}
                    icon="comment"
                    label={comments === 1 ? '1 comment' : comments ? `${comments} comments` : 'Add a comment'}
                    text={comments ? String(comments) : null}
                    onPress={() => openComments(idea)}
                  />
                  <IconAction tip={toDo ? 'start' : 'end'} icon="share" label={`Share ${idea.title} as a picture`} onPress={() => router.push(`/group/${group.id}/share?idea=${idea.id}` as never)} />
                  <IconAction tip={toDo ? 'start' : 'end'} icon="edit" label={`Edit ${idea.title}`} onPress={() => openEdit(idea)} />
                </View>
                {/* A date already set always shows, and can be changed or taken off, even on a list that no longer has dates. */}
                {idea.planned_for ? (
                  <IconAction tip="end" icon="date" strong label={`Planned for ${formatPlan(idea.planned_for, now)}. Change date`} text={formatPlan(idea.planned_for, now)} onPress={() => openPlan(idea)} />
                ) : dated ? (
                  <Button label="Plan it" small onPress={() => openPlan(idea)} />
                ) : null}
              </View>
              {/* A plan can be finished from here as well as from its card at the top of the page. Whoever
                  just gave the idea a date comes back to this card, often with that one scrolled out of sight. */}
              {idea.planned_for ? (
                <DoneButtons
                  started={countdown(idea.planned_for, now) === null}
                  confirming={confirmDone === `card:${idea.id}`}
                  onAskDone={() => setConfirmDone(`card:${idea.id}`)}
                  onDone={() => void finish(idea)}
                  onNotYet={() => setConfirmDone(null)}
                />
              ) : null}
              {/* The newest two comments, right on the card. Tapping them opens the whole conversation. */}
              {latest.length > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={comments > latest.length ? `See all ${comments} comments` : 'Open the comments'}
                  onPress={() => openComments(idea)}
                  style={{ gap: 8 }}>
                  {comments > latest.length ? (
                    <T size={13} weight="extra" color={colors.textMuted}>
                      See all {comments} comments
                    </T>
                  ) : null}
                  {latest.map((comment) => {
                    const by = group.members.find((m) => m.user_id === comment.user_id);
                    return (
                      <View key={comment.id} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                        <Avatar name={by?.name ?? 'Someone'} color={by?.color ?? colors.sky} photo={by?.photo} size={26} />
                        <View style={{ flex: 1, backgroundColor: colors.background, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 }}>
                          <T size={13} weight="extra">
                            {comment.user_id === userId ? 'You' : (by?.name ?? 'Someone')}
                            <T size={12} color={colors.textMuted}>
                              {'  '}
                              {timeAgo(comment.created_at, now)}
                            </T>
                          </T>
                          <T size={14} weight="medium" lines={3}>
                            {comment.body}
                          </T>
                        </View>
                      </View>
                    );
                  })}
                </Pressable>
              ) : null}
              {toDo && !allIn && waiting.length > 0 && group.members.length > 1 ? (
                <T size={13} color={colors.textMuted}>
                  Waiting on {waiting.map((m) => (m.user_id === userId ? 'you' : m.name)).join(', ')}
                </T>
              ) : null}
            </Card>
          );
        })}
        </SlideIn>

        <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center', paddingTop: 4 }}>
          {group.members.map((m) => (
            <Avatar key={m.user_id} name={m.name} color={m.color} photo={m.photo} />
          ))}
        </View>

      </Screen>

      {didIt ? (
        <YouDidIt
          completion={didIt.completion}
          lists={group.lists}
          total={didIt.total}
          reached={didIt.reached}
          answer={didIt.completion.idea_id ? didIt.again : undefined}
          onAnswer={(again) => {
            const ideaId = didIt.completion.idea_id;
            if (!ideaId) return;
            setDidIt({ ...didIt, again });
            void answerAgain(ideaId, again);
          }}
          onUndo={didIt.completion.idea_id ? () => void undoDidIt() : undefined}
          undoing={undoing}
          onClose={() => {
            // This screen already announced any new title.
            setDidIt(null);
            setNewTitle(null);
          }}
        />
      ) : newTitle ? (
        <NewTitle level={newTitle} onClose={() => setNewTitle(null)} />
      ) : celebrate ? (
        <EveryonesIn
          title={celebrate.title}
          onPlan={
            celebrate.planned_for || !canDate(celebrate)
              ? undefined
              : () => {
                  const idea = celebrate;
                  setCelebrate(null);
                  openPlan(idea);
                }
          }
          onClose={() => setCelebrate(null)}
        />
      ) : null}
    </View>
  );
}
