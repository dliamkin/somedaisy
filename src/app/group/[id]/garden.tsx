import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReducedMotion } from '@/components/celebrate';
import { BedPager, CaptionBar, CardSource, CountPills, DoneList, GardenBar, GardenHeader, IdeaSheet, LookSheet, Postcard, Toast, type SheetIdea } from '@/components/garden-chrome';
import GardenView, { type Visit } from '@/components/garden-view';
import { PictureCrop } from '@/components/picture-crop';
import { YouDidIt } from '@/components/together';
import { Button, Card, ErrorNote, Loading, Screen, T } from '@/components/ui';
import type { Chime } from '@/garden/sound';
import { countDone, fetchDone, fetchGroup, markDone, nudgeIdea, saveGardenLook, setIdeaPicture, setReaction, takeChanged, type DoneIdea, type GroupData } from '@/lib/data';
import {
  arrivals,
  bedCount,
  bedOf,
  beePick,
  gardenIdeas,
  holdBack,
  leafMembers,
  MAX_LEAVES,
  newlyPlanted,
  nudgeNames,
  postcardLine,
  rankWords,
  sheetButtons,
  sheetLine,
  shortName,
  stageCounts,
  stageOf,
  tallyWords,
  timeOfDay,
  toFlower,
  voteOf,
  waitingOn,
  withVote,
  type Arrival,
  type Flower,
} from '@/lib/garden';
import { buildWalls, cardFile, creditWords, finishedIdeas, finishedLine, sharedLine, sharedWords, sourceWords, toMemories, toMemory, wallCaption, type Finished } from '@/lib/garden-house';
import { earnedWords, EXTRAS, extrasOut, gardenLook, houseGrew, houseLevel, lockedWords, newlyEarned, seasonFor, type Extra, type GardenLook } from '@/lib/garden-look';
import { readSound, saveSound } from '@/lib/garden-sound';
import { gather, listenToGroup } from '@/lib/live';
import type { CropRect } from '@/lib/picture-crop';
import { cropPicture, pickPhoto, removePicture, uploadPicture, type PickedPhoto } from '@/lib/picture-files';
import { PICTURE_SIDE } from '@/lib/pictures';
import { levelFor, levelUp, TITLES, type Completion, type Level } from '@/lib/points';
import { savePostcard, sharePostcard } from '@/lib/postcard';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import { fetchFreshCompletion, setDoAgain, undoDone } from '@/lib/together';

/** How long to wait for a finished flower to reach the house before carrying on without it. */
const LANDING_WAIT_MS = 4000;
/** How long a friend's vote is held back for their butterfly before it is simply shown. */
const VISIT_WAIT_MS = 30000;
/** The most butterflies kept waiting at once. */
const MOST_VISITS = 3;
/** How long the watering can is out. */
const WATERING_MS = 2600;
/** How long after a thing is done its unlocked extra is announced, so the two messages do not collide. */
const EARNED_AFTER_MS = 1900;
/** How long after a frame is tapped its card comes up, once the camera has leaned in. Longer from the list, where there is a walk to the wall first. */
const CARD_AFTER_MS = 320;
const CARD_AFTER_WALK_MS = 750;
/** The picture on a card is four wide to five tall, and a photo added from a card is cut to that shape. */
const CARD_SHAPE = 4 / 5;

/** A friend's vote that is waiting for their butterfly to land. */
type Held = Arrival & Visit;

/**
 * The garden: another way to look at a group's ideas. Every idea to go and do is a daisy in the
 * yard of a little house, and everything the group has done hangs framed in the hallway inside.
 * It sits beside the list on the group's page and replaces nothing: the way back to the list is
 * the arrow at the top.
 */
export default function GardenScreen() {
  const { colors, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useSession();
  const reduced = useReducedMotion();
  const [group, setGroup] = useState<GroupData | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  /** How many things the group has done, for the number on the book and for what it has earned. */
  const [done, setDone] = useState(0);
  /** Everything the group has done, for the frames in the house. `turn` goes up each time it is read afresh. */
  const [finished, setFinished] = useState<{ ideas: DoneIdea[]; turn: number }>({ ideas: [], turn: 0 });
  const [selected, setSelected] = useState<string | null>(null);
  /** Which twelve flowers are on show, when the group has more than the yard holds. */
  const [bed, setBed] = useState(0);
  const [pick, setPick] = useState<{ id: string; turn: number } | null>(null);
  const [toast, setToast] = useState<{ words: string; turn: number } | null>(null);
  /** The flower on its way into the house, kept here so it finishes its flight after its idea has left the list. */
  const [flying, setFlying] = useState<Flower | null>(null);
  /** How many flowers have landed in the house on this visit. */
  const [landed, setLanded] = useState(0);
  /** True while an answer is being saved. */
  const [busy, setBusy] = useState(false);
  const [didIt, setDidIt] = useState<{ completion: Completion; total: number; reached: Level | null; again: boolean | null } | null>(null);
  const [undoing, setUndoing] = useState(false);
  /** The garden could not be drawn on this device. */
  const [failed, setFailed] = useState(false);
  /** False while another screen is open over this one, so the garden can stop drawing. */
  const [inView, setInView] = useState(true);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  // The house: whether it has been asked for, whether the camera has got inside, the wall it
  // stands at (null is the newest), the frame that is chosen, and whether the list is open.
  const [house, setHouse] = useState(false);
  const [inside, setInside] = useState(false);
  const [wall, setWall] = useState<number | null>(null);
  const [frame, setFrame] = useState<number | null>(null);
  const [listOpen, setListOpen] = useState(false);
  // "Our garden": whether it is open, and a choice that has been made but not yet saved.
  const [lookOpen, setLookOpen] = useState(false);
  const [lookDraft, setLookDraft] = useState<GardenLook | null>(null);
  /** Whether the garden's sounds are on, on this device. */
  const [sound, setSound] = useState(false);
  const [chime, setChime] = useState<{ name: Chime; turn: number } | null>(null);
  // The watering can, and the friends whose butterflies are on their way.
  const [water, setWater] = useState<{ id: string; turn: number } | null>(null);
  const [watering, setWatering] = useState(false);
  const [held, setHeld] = useState<Held[]>([]);
  // The postcard: a count that asks for a picture, the picture, the words on it, and the finished card being made.
  const [snap, setSnap] = useState(0);
  const [postcard, setPostcard] = useState<{ picture: string; line: string } | null>(null);
  const [flash, setFlash] = useState(0);
  const [card, setCard] = useState<{ of: 'garden' | 'memory'; title: string; line: string; credit: string | null; turn: number } | null>(null);
  const [cardBusy, setCardBusy] = useState(false);
  // The card of a finished idea, from its frame in the house: the idea whose picture has been
  // asked for, and the picture once it has come. `photo` is false when it is the pressed flower.
  const [ask, setAsk] = useState<{ id: string; turn: number } | null>(null);
  const [memCard, setMemCard] = useState<{ id: string; picture: string; photo: boolean } | null>(null);
  // A photo being added to a finished idea from its card: the photo, whose it is, and the picture it takes the place of.
  const [adding, setAdding] = useState<{ photo: PickedPhoto; ideaId: string; had: string | null } | null>(null);
  const [addBusy, setAddBusy] = useState(false);
  /** Extras that have just been earned, and anything the house has just gained, waiting to be announced. */
  const [earned, setEarned] = useState<{ words: string }[]>([]);

  // The ideas that were growing at the last load, to notice a new one.
  const knownRef = useRef<Set<string> | null>(null);
  // The answers and the number of things done at the last load, to notice a friend's vote and an extra being earned.
  const votesRef = useRef<GroupData['reactions'] | null>(null);
  const doneRef = useRef<number | null>(null);
  // How far the house had grown at the last load, to notice it growing.
  const houseRef = useRef<number | null>(null);
  const turnRef = useRef(0);
  // The card waiting to come up, and the count that numbers each asking for a card's picture.
  const cardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const artTurnRef = useRef(0);
  const heldRef = useRef<Held[]>([]);
  const tellRef = useRef<() => void>(() => {});
  const finishingRef = useRef(false);
  // Who is waiting to hear that the flying flower has landed.
  const landingRef = useRef<{ id: string; arrived: () => void } | null>(null);
  // What the finished card is wanted for and what goes with it, and the newest change to the garden's look being saved.
  const cardForRef = useRef<{ what: 'share' | 'save'; title: string; text: string; file?: string }>({ what: 'share', title: '', text: '' });
  const lookSaveRef = useRef(0);
  const userRef = useRef(userId);
  useEffect(() => {
    userRef.current = userId;
  }, [userId]);

  const say = useCallback((words: string) => setToast((last) => ({ words, turn: (last?.turn ?? 0) + 1 })), []);
  const ring = useCallback((name: Chime) => setChime((last) => ({ name, turn: (last?.turn ?? 0) + 1 })), []);

  /** Read everything the group has done, for the frames in the house. */
  const loadFinished = useCallback(async () => {
    if (!id) return;
    try {
      const ideas = await fetchDone(id);
      setFinished((last) => ({ ideas, turn: last.turn + 1 }));
    } catch {
      // The house keeps what it had. The next look tries again.
    }
  }, [id]);

  const load = useCallback(async () => {
    if (!id) return null;
    try {
      // The count is only for the badge and the extras, so the garden still opens without it.
      const [g, count] = await Promise.all([fetchGroup(id), countDone(id).catch(() => null)]);
      if (g) {
        const growing = gardenIdeas(g);
        const fresh = newlyPlanted(knownRef.current, growing);
        knownRef.current = new Set(growing.map((i) => i.id));
        if (fresh.length > 0) {
          say(`${fresh[0].title} is planted`);
          ring('add');
          // New ideas come up in the first bed. Whoever added one is taken to see it.
          if (fresh.some((i) => i.added_by === userRef.current)) setBed(0);
        }
        // A friend who has just said "I'm in" arrives as a butterfly, and their leaf waits for it to land.
        const me = userRef.current;
        const came = me ? arrivals(votesRef.current, g.reactions, growing.map((i) => i.id), g.members, me) : [];
        votesRef.current = g.reactions;
        // Only a few butterflies are kept waiting at once. Any more votes than that simply show.
        const waiting = heldRef.current;
        const next = came
          .filter((a) => !waiting.some((h) => h.ideaId === a.ideaId && h.userId === a.userId))
          .slice(0, Math.max(0, MOST_VISITS - waiting.length))
          .map((a): Held => {
            const member = g.members.find((m) => m.user_id === a.userId);
            turnRef.current += 1;
            return { ...a, who: a.userId, id: a.ideaId, color: member?.color ?? colors.card, name: member?.name ?? 'Someone', turn: turnRef.current };
          });
        if (next.length > 0) {
          heldRef.current = [...waiting, ...next];
          setHeld(heldRef.current);
        }
        // A new rank adds to the house. It is said once the part has sprung up.
        const level = houseLevel(g.points);
        const grew = houseRef.current === null ? null : houseGrew(houseRef.current, level);
        houseRef.current = level;
        if (grew) setEarned((waiting) => [...waiting, { words: grew }]);
      }
      setGroup(g);
      if (count !== null) {
        setDone(count);
        const before = doneRef.current;
        if (before !== count) void loadFinished();
        // Finishing things together earns things for the yard.
        if (before !== null && count > before) {
          const won = newlyEarned(before, count);
          if (won.length > 0) setEarned((waiting) => [...waiting, ...won.map((extra) => ({ words: earnedWords(count, extra) }))]);
        }
        doneRef.current = count;
      }
      setNow(new Date());
      setError(null);
      return g;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the group.');
      return null;
    }
  }, [id, say, ring, loadFinished, colors.card]);

  // Live updates, on the channel this screen shares with the group's page underneath it.
  useEffect(() => {
    if (!supabase || !id) return;
    const reload = gather(() => void load());
    const live = listenToGroup(supabase, id, reload.ask);
    tellRef.current = live.tell;
    return () => {
      tellRef.current = () => {};
      reload.cancel();
      live.stop();
    };
  }, [id, load]);

  // Reload when the screen comes back into view, and every 20 seconds as a safety net.
  useFocusEffect(
    useCallback(() => {
      setInView(true);
      void load().then(() => {
        // A screen opened from here (a new idea, a date) may have changed the group.
        if (id && takeChanged(id)) tellRef.current();
      });
      const timer = setInterval(() => void load(), 20000);
      const back = AppState.addEventListener('change', (state) => {
        if (state === 'active') void load();
      });
      return () => {
        setInView(false);
        clearInterval(timer);
        back.remove();
      };
    }, [id, load]),
  );

  // The sounds are off until someone turns them on, and the choice is this device's own.
  useEffect(() => {
    let alive = true;
    void readSound().then((on) => alive && setSound(on));
    return () => {
      alive = false;
    };
  }, []);

  // A friend's vote is not held back for ever: if their butterfly has not landed in good time, it simply shows.
  useEffect(() => {
    if (held.length === 0) return;
    const oldest = held[0];
    const timer = setTimeout(() => {
      heldRef.current = heldRef.current.filter((h) => h.turn !== oldest.turn);
      setHeld(heldRef.current);
    }, VISIT_WAIT_MS);
    return () => clearTimeout(timer);
  }, [held]);

  // An earned extra is announced a moment after the thing that earned it, and not under the "You did it" screen.
  const announcing = didIt === null && earned.length > 0 ? earned[0].words : null;
  useEffect(() => {
    if (!announcing) return;
    const timer = setTimeout(() => {
      say(announcing);
      ring('bloom');
      setEarned((waiting) => waiting.slice(1));
    }, EARNED_AFTER_MS);
    return () => clearTimeout(timer);
  }, [announcing, say, ring]);

  /** Put a finished idea's card away, or stop one that is on its way up. */
  const dropCard = useCallback(() => {
    if (cardTimerRef.current) clearTimeout(cardTimerRef.current);
    cardTimerRef.current = null;
    setAsk(null);
    setMemCard(null);
  }, []);
  useEffect(
    () => () => {
      if (cardTimerRef.current) clearTimeout(cardTimerRef.current);
    },
    [],
  );

  const leaveHouse = useCallback(() => {
    setHouse(false);
    setInside(false);
    setListOpen(false);
    setFrame(null);
    dropCard();
  }, [dropCard]);

  // The phone's back button and the Escape key put away whatever is open before they leave the garden.
  const somethingOpen = postcard !== null || memCard !== null || listOpen || lookOpen || selected !== null || house;
  useEffect(() => {
    if (!somethingOpen) return;
    const putAway = () => {
      if (postcard) setPostcard(null);
      else if (memCard) {
        // Closing a card lets its frame settle back on the wall.
        dropCard();
        setFrame(null);
      } else if (listOpen) setListOpen(false);
      else if (lookOpen) setLookOpen(false);
      else if (selected) setSelected(null);
      else leaveHouse();
    };
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      putAway();
      return true;
    });
    if (Platform.OS !== 'web' || typeof document === 'undefined') return () => back.remove();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') putAway();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      back.remove();
      document.removeEventListener('keydown', onKey);
    };
  }, [somethingOpen, postcard, memCard, listOpen, lookOpen, selected, leaveHouse, dropCard]);

  const backToList = () => (router.canGoBack() ? router.back() : router.replace(`/group/${id}` as never));

  if (group === undefined && !error) return <Loading />;
  if (group === undefined) {
    return (
      <Screen
        footer={
          <>
            <Button label="Try again" onPress={() => void load()} />
            <Button label="Back to the list" kind="ghost" small onPress={backToList} />
          </>
        }>
        <T size={26} weight="black">
          Could not load the garden
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
  if (failed) {
    return (
      <Screen footer={<Button label="Back to the list" onPress={backToList} />}>
        <T size={26} weight="black">
          The garden could not open
        </T>
        <T weight="medium" color={colors.textMuted}>
          It needs a kind of drawing this device or browser did not start. Everything in it is on the list as well.
        </T>
      </Screen>
    );
  }

  const go = (page: string) => router.push(`/group/${group.id}/${page}` as never);
  const ideas = gardenIdeas(group);
  const leaves = leafMembers(group.members, userId);
  // A friend's "I'm in" does not show on its flower until their butterfly has landed on it.
  const shown = { lists: group.lists, members: group.members, reactions: holdBack(group.reactions, held) };
  const all = ideas.map((idea) => toFlower(idea, shown, leaves));
  const beds = bedCount(all.length);
  const onShow = bedOf(all, bed);
  // The flying flower stays in what the garden is told until it lands, whether or not its idea is still on the list.
  const flowers = !flying ? onShow : onShow.some((f) => f.id === flying.id) ? onShow.map((f) => (f.id === flying.id ? flying : f)) : [...onShow, flying];

  // The garden's look. A choice shows at once, and is saved behind it.
  const look = lookDraft ?? gardenLook(group.garden);
  const out = extrasOut(look, done);

  // The house: every finished idea in a frame, hung on walls by month.
  const walls = buildWalls(finishedIdeas(finished.ideas, group.lists));
  const wallNow = Math.max(0, Math.min(wall ?? walls.length - 1, walls.length - 1));
  const caption = wallCaption(walls, wallNow, frame, now);
  // The finished idea whose frame is chosen, and that idea again once the picture for its card has come.
  const framed: Finished | null = house && frame !== null ? (walls[wallNow]?.items[frame] ?? null) : null;
  const carded = framed && memCard && memCard.id === framed.id ? framed : null;

  // The sheet is for the chosen flower while it is one of those on show.
  const chosen = selected && onShow.some((f) => f.id === selected) ? (ideas.find((i) => i.id === selected) ?? null) : null;
  const votes = chosen ? group.members.map((m) => voteOf(chosen.id, m.user_id, group.reactions)) : [];
  const listed = group.members.length <= MAX_LEAVES;
  const waiting = chosen ? waitingOn(chosen, group.members, group.reactions, userId) : [];
  const sheet: SheetIdea | null = chosen
    ? {
        id: chosen.id,
        title: chosen.title,
        line: sheetLine(chosen, group.members, group.reactions, userId, now),
        members: listed ? group.members.map((m, i) => ({ id: m.user_id, name: m.name, color: m.color, vote: votes[i], me: m.user_id === userId })) : null,
        tally: listed ? null : tallyWords(votes),
        buttons: sheetButtons(stageOf(chosen, group.members, group.reactions), voteOf(chosen.id, userId, group.reactions)),
        nudge: waiting.length > 0 ? nudgeNames(waiting.map((m) => m.name)) : null,
      }
    : null;

  // A tap on a flower, or on the empty ground.
  const select = (flowerId: string | null) => {
    // Either one puts "Our garden" away.
    if (lookOpen) setLookOpen(false);
    if (flowerId) ring('tap');
    setSelected(flowerId);
  };

  // "I'm in" or "Eh". The flower answers at once, and the answer is saved behind it.
  const vote = async (answer: 1 | 2) => {
    if (!chosen || busy) return;
    setBusy(true);
    const after = withVote(group.reactions, chosen.id, userId, answer);
    // A rising run of notes when that answer brings the flower into bloom.
    ring(stageOf(chosen, group.members, after) === 3 ? 'bloom' : 'in');
    setGroup({ ...group, reactions: after });
    try {
      await setReaction(group.id, chosen.id, userId, answer === 1 ? '👍' : '👎', true);
      await load();
      tellRef.current();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your answer.');
      // Back to what is really saved.
      void load();
    } finally {
      setBusy(false);
    }
  };

  // "We did it!": the flower flies into the house while the idea is marked as done, then the
  // "You did it" screen shows what it earned, where a mistaken tap can be undone.
  const finish = async () => {
    if (!chosen || finishingRef.current) return;
    finishingRef.current = true;
    const idea = chosen;
    const before = group.points;
    const flower = all.find((f) => f.id === idea.id);
    setSelected(null);
    if (flower) setFlying({ ...flower, fly: true });
    const landing = new Promise<void>((arrived) => {
      landingRef.current = { id: idea.id, arrived };
      setTimeout(arrived, LANDING_WAIT_MS);
    });
    try {
      await markDone(idea.id);
      // The database has just worked out what this earned. Nothing comes back when points are not set up yet.
      const completion = await fetchFreshCompletion(idea.id).catch(() => null);
      const fresh = await load();
      tellRef.current();
      await landing;
      if (completion) {
        const total = fresh?.points ?? (before ?? 0) + completion.points;
        setDidIt({ completion, total, reached: before === null ? null : levelUp(before, total), again: null });
      }
    } catch (e) {
      // It was not marked as done. The flower grows back where it stood once its flight is over.
      landingRef.current = null;
      setError(e instanceof Error ? e.message : 'Could not mark it as done.');
      void load();
    } finally {
      setFlying(null);
      finishingRef.current = false;
    }
  };

  // "We did it" was tapped by mistake: the idea goes back on its list, and its flower comes up again.
  const undoDidIt = async () => {
    const ideaId = didIt?.completion.idea_id;
    if (!ideaId || undoing) return;
    setUndoing(true);
    try {
      const undone = await undoDone(ideaId);
      setDidIt(null);
      if (!undone) setError('It is too late to undo that one, so it stays done.');
      await load();
      tellRef.current();
    } catch (e) {
      setDidIt(null);
      setError(e instanceof Error ? e.message : 'Could not undo that.');
    } finally {
      setUndoing(false);
    }
  };

  const answerAgain = async (ideaId: string, again: boolean) => {
    try {
      await setDoAgain(group.id, ideaId, userId, again);
      tellRef.current();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your answer.');
    }
  };

  // The bee picks among the flowers on show, and not the same one twice running while there is another.
  // What it picked is said at once. The bee itself flies in after, to circle the flower.
  const pickForUs = () => {
    const next = beePick(onShow, pick?.id ?? null);
    if (!next) return;
    setLookOpen(false);
    setSelected(null);
    setPick({ id: next, turn: (pick?.turn ?? 0) + 1 });
    ring('tap');
    const title = ideas.find((i) => i.id === next)?.title;
    if (title) say(`How about ${title}?`);
  };

  const changeBed = (next: number) => {
    setSelected(null);
    setBed(next);
  };

  // "Water to nudge": the can tips over the flower, and as it pours the people who have not voted get a push.
  const startWatering = () => {
    if (!chosen || watering) return;
    setWatering(true);
    setWater({ id: chosen.id, turn: (water?.turn ?? 0) + 1 });
    ring('water');
    setTimeout(() => setWatering(false), WATERING_MS);
  };
  const poured = async (ideaId: string) => {
    const idea = ideas.find((i) => i.id === ideaId);
    if (!idea) return;
    try {
      const nudged = await nudgeIdea(ideaId);
      if (nudged === null) return say('Watered. Nudges cannot be sent yet.');
      const names = group.members.filter((m) => nudged.includes(m.user_id)).map((m) => m.name);
      if (names.length > 0) return say(`${nudgeNames(names)} got a nudge`);
      // Nobody new to nudge: everyone left was already nudged about this one today.
      const still = waitingOn(idea, group.members, group.reactions, userId).map((m) => m.name);
      say(still.length > 0 ? `${nudgeNames(still)} already got a nudge today` : `${shortName(idea.title)} is watered`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the nudge.');
    }
  };

  // A friend's butterfly has landed, or could not come. Either way their vote now shows.
  const visited = (who: string, ideaId: string) => {
    const visit = held.find((h) => h.userId === who && h.ideaId === ideaId);
    heldRef.current = heldRef.current.filter((h) => !(h.userId === who && h.ideaId === ideaId));
    setHeld(heldRef.current);
    const idea = ideas.find((i) => i.id === ideaId);
    if (!visit || !idea) return;
    ring('visit');
    say(`${visit.name} is in on ${shortName(idea.title)}`);
  };

  // Going into the house. You always walk in at the newest wall.
  const enterHouse = () => {
    if (house) return;
    setSelected(null);
    setLookOpen(false);
    setPostcard(null);
    setWall(null);
    setFrame(null);
    setHouse(true);
    ring('door');
    // The frames are read afresh, in case something was done, undone or renamed elsewhere.
    void loadFinished();
  };
  // A finished idea's card comes up a moment after its frame is chosen: first its picture is asked for.
  const cardSoon = (idea: Finished | undefined, after: number) => {
    dropCard();
    if (!idea) return;
    cardTimerRef.current = setTimeout(() => setAsk({ id: idea.id, turn: ++artTurnRef.current }), after);
  };
  const closeCard = () => {
    dropCard();
    setFrame(null);
  };
  const walkTo = (toWall: number, toFrame: number | null = null) => {
    if (!walls[toWall]) return;
    setListOpen(false);
    setWall(toWall);
    setFrame(toFrame);
    ring('tap');
    cardSoon(toFrame === null ? undefined : walls[toWall].items[toFrame], CARD_AFTER_WALK_MS);
  };

  // "Add our photo" on a card: the person picks a photo and chooses the part of it the card shows.
  // It becomes the idea's own picture, and takes the frame over at once.
  const addPhoto = async () => {
    if (!carded || addBusy) return;
    try {
      const photo = await pickPhoto();
      if (photo) setAdding({ photo, ideaId: carded.id, had: carded.kept });
    } catch {
      say('That file is not a picture');
    }
  };
  const keepPhoto = async (part: CropRect) => {
    if (!adding || addBusy) return;
    const { photo, ideaId, had } = adding;
    setAddBusy(true);
    try {
      // Taller than wide, so it is the height that is kept within what the app keeps of any picture.
      const chosen = await cropPicture(photo, part, Math.round(PICTURE_SIDE * CARD_SHAPE));
      const kept = await uploadPicture(group.id, chosen);
      try {
        await setIdeaPicture(ideaId, kept);
      } catch (e) {
        void removePicture(kept);
        throw e;
      }
      // Nothing shows the picture it had before any more.
      if (had) void removePicture(had);
      setAdding(null);
      await loadFinished();
      tellRef.current();
      // The frames have been hung again with it. The card asks for it too.
      setAsk({ id: ideaId, turn: ++artTurnRef.current });
      say('Your photo is in the frame');
    } catch (e) {
      // The screen for choosing covers everything, so it goes before anything is said.
      setAdding(null);
      say(e instanceof Error ? e.message : 'Could not keep the picture.');
    } finally {
      setAddBusy(false);
    }
  };

  // "Our garden": a choice shows at once and is saved for the whole group behind it.
  const changeLook = (next: GardenLook) => {
    ring('tap');
    setLookDraft(next);
    const turn = ++lookSaveRef.current;
    saveGardenLook(group.id, next).then(
      () => {
        tellRef.current();
        // Only the newest of several quick choices settles what is shown.
        if (turn !== lookSaveRef.current) return;
        setGroup((g) => (g ? { ...g, garden: next } : g));
        setLookDraft(null);
      },
      (e: unknown) => {
        if (turn !== lookSaveRef.current) return;
        setLookDraft(null);
        setError(e instanceof Error ? e.message : 'Could not save the garden.');
      },
    );
  };
  const lockedExtra = (key: Extra) => {
    const extra = EXTRAS.find((e) => e.key === key);
    if (extra) say(lockedWords(done, extra));
  };
  const changeSound = (on: boolean) => {
    setSound(on);
    saveSound(on);
    ring('tap');
  };

  // The finished card has been made, a postcard of the garden or one finished idea's: hand it over.
  const sendCard = async (picture: string | null) => {
    const { what, title, text, file } = cardForRef.current;
    try {
      if (!picture) return say('Could not make the picture here');
      if (what === 'save') {
        if ((await savePostcard(picture, title, file)) === 'saved') say('Saved. Ready for the group chat');
      } else {
        const outcome = await sharePostcard(picture, title, text, file);
        if (outcome === 'shared') say('Sent');
        else if (outcome === 'saved') say('No share sheet in this browser, so the picture was saved');
      }
    } catch {
      say(what === 'save' ? 'Could not save here' : 'Could not share here');
    } finally {
      setCardBusy(false);
    }
  };
  const makeCard = (what: 'share' | 'save') => {
    if (cardBusy) return;
    const turn = (card?.turn ?? 0) + 1;
    if (carded && memCard) {
      // One finished idea: its title, then the group, its list and the day. A found photo carries its credit.
      cardForRef.current = { what, title: carded.title, text: sharedWords(carded.title, group.name), file: cardFile(carded.title) };
      setCardBusy(true);
      setCard({ of: 'memory', title: carded.title, line: sharedLine(group.name, carded, now), credit: memCard.photo ? creditWords(carded.credit) : null, turn });
    } else if (postcard) {
      cardForRef.current = { what, title: group.name, text: 'Our garden today' };
      setCardBusy(true);
      setCard({ of: 'garden', title: group.name, line: postcard.line, credit: null, turn });
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center' }}>
      {/* A phone-width column, like every other page. The garden fills it, edge to edge and under the clock and battery. */}
      <View style={{ flex: 1, width: '100%', maxWidth: 480, overflow: 'hidden' }} onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}>
        {size && reduced !== null ? (
          <GardenView
            flowers={flowers}
            bed={Math.min(bed, beds - 1)}
            selected={chosen?.id ?? null}
            pick={pick}
            time={timeOfDay(dark, now)}
            still={reduced}
            // One petal for each rank the group has reached. Without points, the whole daisy.
            earned={group.points !== null ? levelFor(group.points).index + 1 : TITLES.length}
            leaves={leaves.map((m) => m.color)}
            season={seasonFor(now)}
            lawn={look.lawn}
            roof={look.roof}
            walls={look.walls}
            door={look.door}
            bench={out.bench}
            bath={out.bath}
            lights={out.lights}
            picnic={out.picnic}
            wood={out.wood}
            fire={out.fire}
            pond={out.pond}
            level={houseLevel(group.points)}
            memories={toMemories(walls)}
            hung={finished.turn}
            house={house}
            wall={wallNow}
            frame={frame}
            overview={lookOpen}
            water={water}
            visits={held}
            snap={snap}
            art={ask && framed && framed.id === ask.id && inside ? { memory: toMemory(framed), turn: ask.turn } : null}
            card={card}
            sound={sound}
            chime={chime}
            paused={!inView || didIt !== null}
            tag={{ card: colors.card, ink: colors.text }}
            onSelect={async (flowerId) => select(flowerId)}
            onLanded={async (flowerId) => {
              if (landingRef.current?.id !== flowerId) return;
              landingRef.current.arrived();
              landingRef.current = null;
              setLanded((n) => n + 1);
              ring('done');
              say('Pressed and framed in the house');
            }}
            onDoor={async () => enterHouse()}
            onInside={async (arrived) => setInside(arrived)}
            onWall={async (index) => {
              if (index === wallNow) return;
              setWall(index);
              setFrame(null);
              dropCard();
            }}
            onFrame={async (slot) => {
              // A second tap on the chosen frame, or a tap on the wallpaper, steps back from it.
              const next = slot === frame ? null : slot;
              setFrame(next);
              if (next !== null) ring('tap');
              cardSoon(next === null ? undefined : walls[wallNow]?.items[next], CARD_AFTER_MS);
            }}
            onWatered={async (flowerId) => poured(flowerId)}
            onVisit={async (who, flowerId) => visited(who, flowerId)}
            onSnapshot={async (picture) => {
              if (!picture) return say('The camera did not work here');
              setPostcard({ picture, line: postcardLine(new Date(), all.length) });
              setFlash((n) => n + 1);
              ring('snap');
            }}
            onArt={async (picture, photo, turn) => {
              // Only the newest asking is answered, and only while its frame is still the chosen one.
              if (!ask || turn !== ask.turn) return;
              if (!picture) return say('Could not make the picture here');
              setMemCard({ id: ask.id, picture, photo });
            }}
            onCard={async (picture) => sendCard(picture)}
            onFailed={async () => setFailed(true)}
            // In the phone app the garden is a web view, which is given the column's exact size and does not scroll.
            dom={{ style: { width: size.width, height: size.height }, scrollEnabled: false }}
          />
        ) : null}

        <GardenHeader
          title={group.name}
          line={rankWords(group.points) ?? (group.members.length === 1 ? "It's just you" : `${group.members.length} people`)}
          done={done}
          landed={landed}
          inHouse={house}
          onBack={() => (listOpen ? setListOpen(false) : house ? leaveHouse() : backToList())}
          onSnap={() => setSnap((n) => n + 1)}
          onBook={() => (!house ? enterHouse() : inside ? setListOpen(!listOpen) : undefined)}
        />
        <CountPills counts={stageCounts(all)} hidden={house || lookOpen} />
        {error ? (
          <View style={{ position: 'absolute', left: 16, right: 16, top: insets.top + 166 }}>
            <ErrorNote message={error} />
          </View>
        ) : all.length === 0 && !house && !lookOpen ? (
          <View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 16, top: insets.top + 120 }}>
            <Card style={{ gap: 2 }}>
              <T size={16} weight="black">
                Nothing growing yet
              </T>
              <T size={13} color={colors.textMuted}>
                Add an idea of something to do and it comes up here as a bud.
              </T>
            </Card>
          </View>
        ) : null}

        <GardenBar
          canPick={onShow.length > 1}
          away={house}
          onLook={() => {
            if (!lookOpen) setSelected(null);
            setLookOpen(!lookOpen);
          }}
          onPick={pickForUs}
          onAdd={() => {
            setLookOpen(false);
            go('add');
          }}
          above={<BedPager bed={Math.min(bed, beds - 1)} beds={beds} onChange={changeBed} />}
        />
        <IdeaSheet
          idea={house || lookOpen ? null : sheet}
          busy={busy}
          watering={watering}
          onVote={(answer) => void vote(answer)}
          onPlan={() => {
            if (!chosen) return;
            ring('plan');
            go(`plan?idea=${chosen.id}`);
          }}
          onDone={() => void finish()}
          onWater={startWatering}
          onOpen={() => {
            if (chosen) go(`comments?idea=${chosen.id}`);
          }}
          onClose={() => setSelected(null)}
        />
        <LookSheet open={lookOpen && !house} group={group.name} look={look} level={houseLevel(group.points)} done={done} sound={sound} onChange={changeLook} onLocked={lockedExtra} onSound={changeSound} onClose={() => setLookOpen(false)} />
        <CaptionBar open={house && inside && !listOpen} title={caption.title} line={caption.line} walls={walls.length} wall={wallNow} onWall={(to) => walkTo(to)} onList={() => setListOpen(true)} />
        <DoneList
          open={house && inside && listOpen}
          walls={walls}
          total={finished.ideas.length}
          now={now}
          onWall={(to) => walkTo(to)}
          onIdea={(toWall, toFrame) => walkTo(toWall, toFrame)}
          onMore={() => go('done')}
          onClose={() => setListOpen(false)}
        />
        {/* One overlay for both: a postcard of the garden, and the card of the finished idea whose frame was tapped. */}
        <Postcard
          picture={carded && memCard ? memCard.picture : (postcard?.picture ?? null)}
          title={carded ? carded.title : group.name}
          line={carded ? finishedLine(carded, now) : (postcard?.line ?? '')}
          alt={carded && memCard ? `${carded.title}. ${sourceWords(carded, memCard.photo)}` : 'Postcard of the garden'}
          whole={carded !== null}
          below={carded && memCard ? <CardSource idea={carded} shown={memCard.photo} busy={cardBusy || addBusy} onAdd={() => void addPhoto()} /> : null}
          flash={flash}
          busy={cardBusy}
          onShare={() => makeCard('share')}
          onSave={() => makeCard('save')}
          onClose={() => (carded ? closeCard() : setPostcard(null))}
        />
        {adding ? <PictureCrop photo={adding.photo} busy={addBusy} shape={CARD_SHAPE} shows="the card shows" onUse={(part) => void keepPhoto(part)} onCancel={() => setAdding(null)} /> : null}
        {/* After the postcard, so that what it says shows over it. */}
        <Toast words={toast?.words ?? null} turn={toast?.turn ?? 0} />

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
            onClose={() => setDidIt(null)}
          />
        ) : null}
      </View>
    </View>
  );
}
