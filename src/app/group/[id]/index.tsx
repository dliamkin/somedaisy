import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, View } from 'react-native';

import { ActionIcon } from '@/components/action-icons';
import { AvatarStack } from '@/components/avatar-stack';
import { ComingUpCard, ComingUpHeading, ComingUpRow, PlanSheet } from '@/components/coming-up';
import { CoverPage } from '@/components/cover-page';
import { Daisy } from '@/components/daisy';
import { IdeaCard } from '@/components/idea-card';
import { AgainChoice, EveryonesIn, NewTitle, RankLine, YouDidIt } from '@/components/together';
import { SlideIn } from '@/components/celebrate';
import { ListStrip } from '@/components/list-strip';
import { ListIcon } from '@/components/list-tile';
import { Sheet, SheetRow } from '@/components/sheet';
import { Button, Card, CircleButton, ErrorNote, Loading, Screen, T } from '@/components/ui';
import { everyoneIn, fetchGroup, markDone, newlyAllIn, onLateChange, setReaction, takeChanged, takeListToOpen, type GroupData, type Idea } from '@/lib/data';
import { useCoverPhotos } from '@/lib/cover-addresses';
import { coverOf } from '@/lib/covers';
import { openLink } from '@/lib/links';
import { plannedIdeas } from '@/lib/plans';
import { isToDo, optionsOf } from '@/lib/list-options';
import { gather } from '@/lib/live';
import { lookFor } from '@/lib/looks';
import { levelFor, levelUp, TITLES, type Completion, type Level } from '@/lib/points';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
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
  // The plan opened from the row of plans, and the idea whose "..." was tapped: each shows on a sheet.
  const [planOpen, setPlanOpen] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
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

  // Where the cover's photo loads from, when the group has one.
  const photoOf = useCoverPhotos(group ? [coverOf(group)] : []);

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

  const cover = coverOf(group);
  // One petal for each rank the group has reached. Without points, the whole daisy.
  const petals = group.points !== null ? levelFor(group.points).index + 1 : TITLES.length;
  // How many ideas each list holds, for its tab.
  const counts: Record<string, number> = {};
  for (const idea of group.ideas) counts[idea.list_id] = (counts[idea.list_id] ?? 0) + 1;
  const go = (page: string) => router.push(`/group/${group.id}/${page}` as never);
  // The plan opened from the row, and the idea whose "..." was tapped. Each goes when its idea does.
  const planShown = plans.find((plan) => plan.id === planOpen) ?? null;
  const menuIdea = group.ideas.find((idea) => idea.id === menuFor) ?? null;
  const closePlan = () => {
    setPlanOpen(null);
    setConfirmDone(null);
  };

  return (
    <View style={{ flex: 1 }}>
      <CoverPage
        cover={cover}
        name={group.name}
        earned={petals}
        photo={photoOf(cover)}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        actions={[
          { label: 'Invite people', icon: (color) => <ActionIcon name="invite" color={color} />, onPress: () => go('invite') },
          { label: 'Group settings', icon: (color) => <ListIcon name="sliders" size={22} color={color} />, onPress: () => go('settings') },
        ]}
        under={(ink) => (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <AvatarStack members={group.members} size={30} most={4} ring={colors.white} ink={ink} />
            <T size={14} weight="extra" color={ink}>
              {group.members.length === 1 ? "It's just you" : `${group.members.length} people`}
            </T>
          </View>
        )}
        footer={
          group.lists.length > 0 ? (
            // "Pick for us" appears once there is something to choose between. Adding is the main thing, so its button is the wider one.
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {group.ideas.length > 1 ? <Button label="Pick for us" kind="outline" onPress={() => go('pick')} style={{ flex: 1 }} /> : null}
              <Button label="Add an idea" onPress={() => go(`add${activeList ? `?list=${activeList.id}` : ''}`)} style={{ flex: 1.25 }} />
            </View>
          ) : null
        }>
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
            <Button label="Invite" small onPress={() => go('invite')} />
          </Card>
        ) : null}
        {/* The group's rank, which opens its stamps, and its two other pages as round buttons beside it,
            kept at the top so nobody has to scroll past every idea to reach them. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {group.points !== null ? <RankLine points={group.points} onPress={() => go('stamps')} /> : <View style={{ flex: 1 }} />}
          <CircleButton label="Calendar" onPress={() => go('calendar')}>
            <ListIcon name="calendar" size={22} color={colors.link} />
          </CircleButton>
          <CircleButton label="Things we did" onPress={() => go('done')}>
            <ListIcon name="trophy" size={22} color={colors.link} />
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

        {/* Every plan that is coming up. One plan is a card with its buttons on it. More than one go in a
            row that slides sideways, and tapping one opens it. With none, there is nothing here at all. */}
        {plans.length > 0 ? (
          <View style={{ gap: 10 }}>
            <ComingUpHeading count={plans.length} onSeeAll={() => go('calendar')} />
            {plans.length === 1 ? (
              <ComingUpCard
                title={plans[0].title}
                plannedFor={plans[0].planned_for}
                now={now}
                confirming={confirmDone === plans[0].id}
                onAskDone={() => setConfirmDone(plans[0].id)}
                onDone={() => void finish(plans[0])}
                onNotYet={() => setConfirmDone(null)}
                onChangeDate={() => openPlan(plans[0])}
              />
            ) : (
              <ComingUpRow
                plans={plans}
                now={now}
                onOpen={(plan) => {
                  setConfirmDone(null);
                  setPlanOpen(plan.id);
                }}
              />
            )}
          </View>
        ) : null}

        <ListStrip
          lists={group.lists}
          counts={counts}
          total={group.ideas.length}
          activeId={activeList?.id ?? null}
          onPick={pickList}
          onAll={() => go(`lists${activeList ? `?list=${activeList.id}` : ''}`)}
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
        <SlideIn key={activeList?.id ?? 'newest'} from={slideFrom} style={{ gap: 14 }}>
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
            const latest = group.latestComments[idea.id] ?? [];
            return (
              <IdeaCard
                key={idea.id}
                idea={idea}
                listName={ideaList?.name ?? null}
                look={lookFor(ideaList, Math.max(0, place))}
                members={group.members}
                reactions={group.reactions.filter((r) => r.idea_id === idea.id)}
                userId={userId}
                now={now}
                // Something to go and do is answered with "I'm in" and can be planned. Something that is only
                // kept on a list, such as a name for a band, gets a thumbs up or down.
                toDo={isToDo(ideaList, idea.planned_for)}
                canDate={canDate(idea)}
                allIn={everyoneIn(idea.id, group.members, group.reactions)}
                comments={group.commentCounts[idea.id] ?? 0}
                latest={latest[latest.length - 1] ?? null}
                pickerOpen={pickerFor === idea.id}
                confirming={confirmDone === `card:${idea.id}`}
                onReact={(emoji) => void react(idea, emoji)}
                onPickEmoji={() => setPickerFor(pickerFor === idea.id ? null : idea.id)}
                onPlan={() => openPlan(idea)}
                onComments={() => openComments(idea)}
                onMore={() => setMenuFor(idea.id)}
                onOpenLink={() => idea.link && openLink(idea.link)}
                onAskDone={() => setConfirmDone(`card:${idea.id}`)}
                onDone={() => void finish(idea)}
                onNotYet={() => setConfirmDone(null)}
              />
            );
          })}
        </SlideIn>
      </CoverPage>

      {/* A plan opened from the row of plans, with the buttons that change its date or finish it. */}
      {planShown && !didIt ? (
        <PlanSheet
          plan={planShown}
          now={now}
          onClose={closePlan}
          confirming={confirmDone === planShown.id}
          onAskDone={() => setConfirmDone(planShown.id)}
          // The sheet is put away once the plan is done, so undoing "done" does not bring it back up.
          onDone={() => void finish(planShown).then(() => setPlanOpen(null))}
          onNotYet={() => setConfirmDone(null)}
          onChangeDate={() => {
            closePlan();
            openPlan(planShown);
          }}
        />
      ) : null}

      {/* What else can be done with an idea, behind its "..." button. */}
      {menuIdea ? (
        <Sheet title={menuIdea.title} onClose={() => setMenuFor(null)}>
          <View style={{ gap: 2 }}>
            {menuIdea.link ? (
              <SheetRow
                icon={<ActionIcon name="link" />}
                label="Open the link"
                onPress={() => {
                  setMenuFor(null);
                  openLink(menuIdea.link as string);
                }}
              />
            ) : null}
            <SheetRow
              icon={<ActionIcon name="share" />}
              label="Share as a picture"
              onPress={() => {
                setMenuFor(null);
                go(`share?idea=${menuIdea.id}`);
              }}
            />
            <SheetRow
              icon={<ActionIcon name="edit" />}
              label="Edit"
              onPress={() => {
                setMenuFor(null);
                openEdit(menuIdea);
              }}
            />
          </View>
        </Sheet>
      ) : null}

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
