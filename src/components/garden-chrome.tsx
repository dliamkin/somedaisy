// What floats over the garden: the header, the count pills, the toast, the bar of buttons at the
// bottom, the sheet for the flower that was tapped, the "Our garden" sheet, the postcard, and,
// inside the house, the bar under the wall, the list of everything the group has done and the card
// of one finished idea. The garden itself is drawn underneath, in src/components/garden-view.tsx.
//
// Sizes, spacing and timings are the design handoffs' (design_handoff_garden_a_v3/README.md is
// the newest) and are final, which is why the buttons here are their own and not the ones in ui.tsx.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Image, Platform, Pressable, ScrollView, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { HOUSE_PAINTS, POSTCARD } from '@/garden/palette';
import { STAGE_NAMES, voteWords, type Stage, type Vote } from '@/lib/garden';
import { finishedLine, sourceWords, thingsWords, type Finished, type HouseWall } from '@/lib/garden-house';
import { EXTRAS, houseWords, LAWNS, PAINT_NAMES, type Extra, type GardenLook } from '@/lib/garden-look';
import { light, useTheme } from '@/lib/theme';

import { useReducedMotion } from './celebrate';
import { PhotoCredit } from './cover-credit';
import { BackIcon } from './daisy';
import { T } from './ui';

// Moving and fading can run off the main thread on phones. The web has no such thing.
const NATIVE = Platform.OS !== 'web';
/** The space between the side of the screen and what is on it. */
const EDGE = 16;
/** How a sheet slides: it overshoots a touch and settles. */
const SHEET_EASE = Easing.bezier(0.3, 1.1, 0.4, 1);
const SHEET_MS = 380;
/** The plain easing a browser gives a change that names none. */
const EASE = Easing.bezier(0.25, 0.1, 0.25, 1);
/** How the postcard comes up: it springs a little past where it rests. */
const CARD_EASE = Easing.bezier(0.3, 1.3, 0.4, 1);

/**
 * A number that runs from 0 to 1 as something opens, and back as it closes. With reduced motion it
 * simply changes. It starts where it is asked to be, without moving there. `away` is a style for
 * the thing once it has finished closing, which takes it out of reach of a keyboard and a screen
 * reader on the website. (On a phone the accessibility props on each of them do that.)
 */
function useOpening(open: boolean, duration: number, easing: (t: number) => number = EASE): { shown: Animated.Value; away: ViewStyle | null } {
  const reduced = useReducedMotion();
  const [shown] = useState(() => new Animated.Value(open ? 1 : 0));
  // True once a closing has run to its end. Opening again takes it back.
  const [closed, setClosed] = useState(!open);
  if (open && closed) setClosed(false);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduced !== false) {
      shown.setValue(open ? 1 : 0);
      return;
    }
    const run = Animated.timing(shown, { toValue: open ? 1 : 0, duration, easing, useNativeDriver: NATIVE });
    run.start(({ finished }) => {
      if (finished && !open) setClosed(true);
    });
    return () => run.stop();
  }, [open, reduced, shown, duration, easing]);
  // It keeps its place and its size while it is away, so it can slide back from where it went.
  const gone = !open && (closed || reduced !== false);
  return { shown, away: gone && !NATIVE ? ({ visibility: 'hidden' } as ViewStyle) : null };
}

type PillKind = 'primary' | 'outline' | 'soft' | 'text';

/**
 * A button over the garden: filled, outlined in the button colour, outlined faintly, or words
 * alone. `pad` is the space either side of its words, and `ink` colours an outlined or plain one,
 * its outline included, for when it sits on something dark.
 */
export function Pill({
  label,
  onPress,
  kind = 'primary',
  disabled,
  pad,
  ink,
  style,
}: {
  label: string;
  onPress: () => void;
  kind?: PillKind;
  disabled?: boolean;
  pad?: number;
  ink?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const words = kind === 'primary' ? colors.onButton : (ink ?? (kind === 'soft' ? colors.text : colors.link));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          height: 44,
          paddingHorizontal: pad ?? (kind === 'text' ? 14 : 22),
          borderRadius: 22,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: kind === 'primary' ? colors.button : 'transparent',
          borderWidth: kind === 'outline' ? 2 : kind === 'soft' ? 1.5 : 0,
          borderColor: ink ?? (kind === 'outline' ? colors.button : colors.outline),
          opacity: disabled ? 0.45 : 1,
          transform: [{ scale: pressed ? 0.96 : 1 }],
        },
        style,
      ]}>
      <T size={15} weight="extra" color={words} lines={1}>
        {label}
      </T>
    </Pressable>
  );
}

/** A round button over the garden. `outline` gives it a faint ring, for where it sits on the bar. */
function Round({ label, onPress, outline, children }: { label: string; onPress: () => void; outline?: boolean; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', borderWidth: outline ? 1.5 : 0, borderColor: colors.outline }}>
      {children}
    </Pressable>
  );
}

/**
 * The top of the garden: the way back, the group's name and rank, the camera that takes a
 * postcard, and the book that opens the house, with how many things the group has done. Inside
 * the house the words say so, the arrow leads back out, and the book becomes a list. `landed` goes
 * up by one each time a finished flower lands in the house, and the number on the book pops.
 */
export function GardenHeader({
  title,
  line,
  done,
  landed,
  inHouse,
  onBack,
  onSnap,
  onBook,
}: {
  title: string;
  line: string | null;
  done: number;
  landed: number;
  inHouse: boolean;
  onBack: () => void;
  onSnap: () => void;
  onBook: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [pop] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (landed === 0 || reduced !== false) return;
    const run = Animated.sequence([
      Animated.timing(pop, { toValue: 1.3, duration: 210, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }),
      Animated.timing(pop, { toValue: 1, duration: 390, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }),
    ]);
    run.start();
    return () => run.stop();
  }, [landed, reduced, pop]);
  const soFar = done === 1 ? '1 so far' : `${done} so far`;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: EDGE, right: EDGE, top: insets.top + 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Round label={inHouse ? 'Back to the garden' : 'Back to the list'} onPress={onBack}>
        <BackIcon />
      </Round>
      <View pointerEvents="none" style={{ flex: 1, minWidth: 0 }}>
        <T size={20} weight="black" lines={1} style={{ lineHeight: 22 }}>
          {inHouse ? 'Things we did' : title}
        </T>
        {inHouse || line ? (
          <T size={12.5} weight="extra" lines={1}>
            {inHouse ? soFar : line}
          </T>
        ) : null}
      </View>
      <Round label="Send a postcard" onPress={onSnap}>
        <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
          <Path d="M3 7.5h3l1.5-2.5h7L16 7.5h3v10H3z" stroke={colors.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Circle cx={11} cy={12} r={3.2} stroke={colors.text} strokeWidth={2} />
        </Svg>
      </Round>
      <Animated.View style={{ transform: [{ scale: pop }] }}>
        <Round label={inHouse ? 'See everything you did as a list' : `Go into the house. Things we did, ${soFar}`} onPress={onBook}>
          {inHouse ? (
            <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
              <Path d="M8 6h10M8 11h10M8 16h10M4 6h.01M4 11h.01M4 16h.01" stroke={colors.text} strokeWidth={2.2} strokeLinecap="round" />
            </Svg>
          ) : (
            <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
              <Path d="M11 5v13M11 5C9 3.5 6 3.5 3 4v13c3-.5 6-.5 8 1M11 5c2-1.5 5-1.5 8-1v13c-3-.5-6-.5-8 1" stroke={colors.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          )}
          {done > 0 ? (
            // The badge is the same pink in both modes, with white on it.
            <View pointerEvents="none" style={{ position: 'absolute', right: -4, top: -4, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: light.accent, alignItems: 'center', justifyContent: 'center' }}>
              <T size={11.5} weight="black" color={colors.white}>
                {done}
              </T>
            </View>
          ) : null}
        </Round>
      </Animated.View>
    </View>
  );
}

/** How many flowers are at each stage, as four small pills under the header. They fade away inside the house and while "Our garden" is open. */
export function CountPills({ counts, hidden }: { counts: Record<Stage, number>; hidden?: boolean }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { shown, away } = useOpening(!hidden, 300);
  const stages: Stage[] = [1, 2, 3, 4];
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden={hidden}
      importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
      style={[{ position: 'absolute', left: EDGE, right: EDGE, top: insets.top + 74, flexDirection: 'row', flexWrap: 'wrap', gap: 6, opacity: shown }, away]}>
      {stages.map((stage) => (
        <View key={stage} accessible accessibilityLabel={`${STAGE_NAMES[stage]}: ${counts[stage]}`} style={{ height: 32, paddingHorizontal: 10, borderRadius: 16, backgroundColor: colors.card, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <T size={12.5} weight="extra">
            {STAGE_NAMES[stage]}
          </T>
          <T size={12.5} weight="black">
            {counts[stage]}
          </T>
        </View>
      ))}
    </Animated.View>
  );
}

/**
 * A few words that fade in under the count pills and go again after three seconds. `turn` goes up
 * with each new message, so the same words said twice still show twice.
 */
export function Toast({ words, turn }: { words: string | null; turn: number }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [shown] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!words) return;
    const run = Animated.sequence([
      Animated.timing(shown, { toValue: 1, duration: 400, useNativeDriver: NATIVE }),
      Animated.delay(2600),
      Animated.timing(shown, { toValue: 0, duration: 400, useNativeDriver: NATIVE }),
    ]);
    run.start();
    return () => run.stop();
  }, [words, turn, shown]);
  if (!words) return null;
  return (
    <Animated.View pointerEvents="none" accessibilityLiveRegion="polite" style={{ position: 'absolute', left: 0, right: 0, top: insets.top + 120, alignItems: 'center', opacity: shown }}>
      <View style={{ paddingVertical: 9, paddingHorizontal: 16, borderRadius: 20, backgroundColor: colors.ink, maxWidth: 330 }}>
        <T size={13.5} weight="extra" color={colors.white} center>
          {words}
        </T>
      </View>
    </Animated.View>
  );
}

/**
 * The buttons along the bottom of the garden: the round one that opens "Our garden", then "Pick
 * for us" and "Add an idea". `above` floats over them, clear of the bar. `away` slides the whole
 * bar down out of sight, for inside the house.
 */
export function GardenBar({ onPick, onAdd, onLook, canPick, above, away }: { onPick: () => void; onAdd: () => void; onLook: () => void; canPick: boolean; above?: ReactNode; away?: boolean }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [height, setHeight] = useState(120);
  const { shown, away: gone } = useOpening(!away, 400);
  return (
    <Animated.View
      pointerEvents={away ? 'none' : 'box-none'}
      accessibilityElementsHidden={away}
      importantForAccessibility={away ? 'no-hide-descendants' : 'auto'}
      onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
      style={[{ position: 'absolute', left: 0, right: 0, bottom: 0, transform: [{ translateY: shown.interpolate({ inputRange: [0, 1], outputRange: [height * 1.1, 0] }) }] }, gone]}>
      {above}
      <View style={{ flexDirection: 'row', gap: 10, paddingTop: 12, paddingHorizontal: EDGE, paddingBottom: Math.max(20, insets.bottom + 8), backgroundColor: colors.background, borderTopWidth: 1, borderColor: colors.line }}>
        <Round label="Our garden: paint the house, choose the lawn and more" outline onPress={onLook}>
          <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
            <Path d="M4 6h14M4 11h14M4 16h14" stroke={colors.text} strokeWidth={2} strokeLinecap="round" />
            <Circle cx={8} cy={6} r={2.2} fill={colors.card} stroke={colors.text} strokeWidth={2} />
            <Circle cx={14} cy={11} r={2.2} fill={colors.card} stroke={colors.text} strokeWidth={2} />
            <Circle cx={9} cy={16} r={2.2} fill={colors.card} stroke={colors.text} strokeWidth={2} />
          </Svg>
        </Round>
        {canPick ? <Pill label="Pick for us" kind="outline" onPress={onPick} style={{ flex: 1 }} /> : null}
        <Pill label="Add an idea" onPress={onAdd} style={{ flex: 1 }} />
      </View>
    </Animated.View>
  );
}

/** For a garden with more flowers than the yard holds: which bed is on show, and the way to the next and the last. */
export function BedPager({ bed, beds, onChange }: { bed: number; beds: number; onChange: (bed: number) => void }) {
  const { colors } = useTheme();
  if (beds < 2) return null;
  const arrow = (to: number, label: string, d: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: to < 0 || to >= beds }}
      disabled={to < 0 || to >= beds}
      onPress={() => onChange(to)}
      style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', opacity: to < 0 || to >= beds ? 0.45 : 1 }}>
      <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
        <Path d={d} stroke={colors.text} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </Pressable>
  );
  return (
    <View pointerEvents="box-none" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingBottom: 10 }}>
      {arrow(bed - 1, 'Flowers before these', 'M12 4L6 10l6 6')}
      <View accessible accessibilityLabel={`Flower bed ${bed + 1} of ${beds}`} style={{ height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: colors.card, justifyContent: 'center' }}>
        <T size={12.5} weight="extra">
          Bed {bed + 1} of {beds}
        </T>
      </View>
      {arrow(bed + 1, 'More flowers', 'M8 4l6 6-6 6')}
    </View>
  );
}

/**
 * A sheet that slides up from the bottom, over the bar, and leaves the garden in view above it.
 * Every sheet over the garden is one of these.
 */
function SlideSheet({ open, children }: { open: boolean; children: ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [height, setHeight] = useState(320);
  const { shown, away } = useOpening(open, SHEET_MS, SHEET_EASE);
  return (
    <View pointerEvents="box-none" style={[{ position: 'absolute', left: 0, right: 0, bottom: 0, overflow: 'hidden', paddingTop: 24 }, away]}>
      <Animated.View
        pointerEvents={open ? 'auto' : 'none'}
        accessibilityElementsHidden={!open}
        importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
        onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
        style={{
          backgroundColor: colors.card,
          borderTopLeftRadius: 30,
          borderTopRightRadius: 30,
          paddingTop: 20,
          paddingHorizontal: EDGE,
          paddingBottom: Math.max(22, insets.bottom + 10),
          boxShadow: `0 -8px 12px ${colors.shadow}`,
          transform: [{ translateY: shown.interpolate({ inputRange: [0, 1], outputRange: [height * 1.1 + 24, 0] }) }],
        }}>
        {children}
      </Animated.View>
    </View>
  );
}

/** The top of a sheet that is not about one idea: what it is, a line under that, and the button that puts it away. */
function SheetHead({ title, line, action, onAction }: { title: string; line: string; action: string; onAction: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
      <View style={{ flex: 1 }}>
        <T size={19} weight="black">
          {title}
        </T>
        <T size={13} color={colors.textMuted} style={{ marginTop: 2, marginBottom: 4 }}>
          {line}
        </T>
      </View>
      <Pill label={action} kind="text" onPress={onAction} />
    </View>
  );
}

/** A member's answer on the idea a sheet is about. */
export type SheetMember = { id: string; name: string; color: string; vote: Vote; me: boolean };

/** What the sheet says about one idea. */
export type SheetIdea = {
  id: string;
  title: string;
  line: string;
  /** Each member and their answer, when the group is small enough to list. */
  members: SheetMember[] | null;
  /** In a bigger group, the answers counted up instead. */
  tally: string | null;
  buttons: { vote: boolean; plan: boolean; done: boolean };
  /** Who watering would nudge, as the button says them: "Sam and Alex". Null when there is nobody to nudge. */
  nudge: string | null;
};

/**
 * The sheet for the flower that was tapped. It slides up over the bottom bar and leaves the garden
 * in view above it, where the camera has moved in on that flower. Null puts it away, and while it
 * slides down it still shows the idea it was last about.
 */
export function IdeaSheet({
  idea,
  busy,
  watering,
  onVote,
  onPlan,
  onDone,
  onWater,
  onClose,
}: {
  idea: SheetIdea | null;
  /** True while an answer is being saved, so the buttons wait. */
  busy: boolean;
  /** True while the watering can is out. */
  watering: boolean;
  onVote: (vote: 1 | 2) => void;
  onPlan: () => void;
  onDone: () => void;
  onWater: () => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  // The idea last shown, kept while the sheet slides away. Kept as text, so that being handed the
  // same idea again, freshly put together, does not count as a change.
  const now = idea ? JSON.stringify(idea) : null;
  const [last, setLast] = useState(now);
  if (now && now !== last) setLast(now);
  const about = idea ?? (last ? (JSON.parse(last) as SheetIdea) : null);
  return (
    <SlideSheet open={idea !== null}>
      {about ? (
        <>
          <T size={19} weight="black" lines={2}>
            {about.title}
          </T>
          <T size={13} color={colors.textMuted} style={{ marginTop: 2, marginBottom: 12 }}>
            {about.line}
          </T>
          {about.members ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 6, marginBottom: 14 }}>
              {about.members.map((m) => (
                <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 8,
                      borderWidth: 1.5,
                      backgroundColor: m.vote ? m.color : 'transparent',
                      borderStyle: m.vote ? 'solid' : 'dashed',
                      borderColor: m.vote ? colors.text : colors.outline,
                    }}
                  />
                  <T size={13} weight="extra">
                    {m.me ? `${m.name} (you)` : m.name}{' '}
                    <T size={13} color={colors.textMuted}>
                      {voteWords(m.vote)}
                    </T>
                  </T>
                </View>
              ))}
            </View>
          ) : about.tally ? (
            <T size={13} weight="extra" style={{ marginBottom: 14 }}>
              {about.tally}
            </T>
          ) : null}
          {/* The buttons run on to a second line when they do not fit: "Close" is pushed to the right, and the watering can comes after it. */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            {about.buttons.vote ? <Pill label="I'm in" disabled={busy} onPress={() => onVote(1)} /> : null}
            {about.buttons.vote ? <Pill label="Eh" kind="soft" pad={16} disabled={busy} onPress={() => onVote(2)} /> : null}
            {about.buttons.plan ? <Pill label="Plan it" disabled={busy} onPress={onPlan} /> : null}
            {about.buttons.done ? <Pill label="We did it!" disabled={busy} onPress={onDone} /> : null}
            <Pill label="Close" kind="text" onPress={onClose} style={{ marginLeft: 'auto' }} />
            {about.nudge ? <Pill label={`Water to nudge ${about.nudge}`} kind="soft" pad={16} disabled={watering} onPress={onWater} style={{ maxWidth: '100%' }} /> : null}
          </View>
        </>
      ) : null}
    </SlideSheet>
  );
}

/**
 * The bar that floats under a wall inside the house: what the wall is, or the frame that is
 * chosen, with an arrow at each end to walk to the older wall and the newer one. It floats, where
 * a sheet would cover the floor and the sideboard. The middle of it opens the list.
 */
export function CaptionBar({
  open,
  title,
  line,
  walls,
  wall,
  onWall,
  onList,
}: {
  open: boolean;
  title: string;
  line: string;
  /** How many walls there are, and which one is in view. */
  walls: number;
  wall: number;
  onWall: (wall: number) => void;
  onList: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { shown, away } = useOpening(open, SHEET_MS, SHEET_EASE);
  const arrow = (to: number, label: string, d: string) => {
    const off = to < 0 || to >= walls;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: off }}
        disabled={off || walls < 2}
        onPress={() => onWall(to)}
        // With one wall there is nowhere to walk, so the arrows are not shown, but they keep their room.
        style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', opacity: walls < 2 ? 0 : off ? 0.28 : 1 }}>
        <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
          <Path d={d} stroke={colors.text} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Pressable>
    );
  };
  return (
    <Animated.View
      pointerEvents={open ? 'auto' : 'none'}
      accessibilityElementsHidden={!open}
      importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
      style={[
        {
          position: 'absolute',
          left: EDGE,
          right: EDGE,
          bottom: Math.max(20, insets.bottom + 8),
          height: 56,
          borderRadius: 28,
          backgroundColor: colors.card,
          boxShadow: `0 8px 12px ${colors.shadow}`,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 2,
          paddingHorizontal: 6,
          transform: [{ translateY: shown.interpolate({ inputRange: [0, 1], outputRange: [56 * 1.6 + 40, 0] }) }],
        },
        away,
      ]}>
      {arrow(wall - 1, 'Older wall', 'M12 4L6 10l6 6')}
      <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${line}. See everything as a list`} onPress={onList} style={{ flex: 1, minWidth: 0, height: 48, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' }}>
        <T size={15.5} weight="black" center lines={1} style={{ lineHeight: 19.4 }}>
          {title}
        </T>
        <T size={12.5} color={colors.textMuted} center lines={1} style={{ lineHeight: 15.6 }}>
          {line}
        </T>
      </Pressable>
      {arrow(wall + 1, 'Newer wall', 'M8 4l6 6-6 6')}
    </Animated.View>
  );
}

/**
 * Everything the group has done, as a list, grouped by wall with the newest first. Tapping a
 * wall's name walks to that wall. Tapping an idea walks to its wall and leans in to its frame.
 * This is also how the hallway is used with a keyboard or a screen reader.
 */
export function DoneList({
  open,
  walls,
  total,
  now,
  onWall,
  onIdea,
  onMore,
  onClose,
}: {
  open: boolean;
  walls: HouseWall[];
  total: number;
  now: Date;
  onWall: (wall: number) => void;
  onIdea: (wall: number, frame: number) => void;
  /** Opens the full "Things we did" page, with the do-again shelf. */
  onMore: () => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const { height } = useWindowDimensions();
  const rows: ReactNode[] = [];
  const headings: number[] = [];
  for (let wall = walls.length - 1; wall >= 0; wall--) {
    const { label, items } = walls[wall];
    headings.push(rows.length);
    rows.push(
      <Pressable
        key={`wall ${wall}`}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${thingsWords(items.length)}. Walk to this wall`}
        onPress={() => onWall(wall)}
        style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, backgroundColor: colors.card, paddingTop: 12, paddingBottom: 6 }}>
        <T size={14} weight="black">
          {label}
        </T>
        <T size={12.5} color={colors.textMuted}>
          {items.length}
        </T>
      </Pressable>,
    );
    for (let frame = items.length - 1; frame >= 0; frame--) {
      const idea = items[frame];
      const line = finishedLine(idea, now);
      rows.push(
        <Pressable
          key={idea.id}
          accessibilityRole="button"
          accessibilityLabel={`${idea.title}, ${line}. Walk to its frame`}
          onPress={() => onIdea(wall, frame)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44, paddingVertical: 3 }}>
          <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: idea.color }} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <T size={14.5} weight="extra" lines={1} style={{ lineHeight: 18.1 }}>
              {idea.title}
            </T>
            <T size={12.5} color={colors.textMuted} lines={1} style={{ lineHeight: 15.6 }}>
              {line}
            </T>
          </View>
        </Pressable>,
      );
    }
  }
  return (
    <SlideSheet open={open}>
      <SheetHead title="Things we did" line={total === 0 ? 'Nothing yet. Finish an idea and it hangs here.' : `${total} so far. Tap one to walk to it.`} action="Close" onAction={onClose} />
      {/* On a short screen the list is shorter, so the top of the sheet stays on it. */}
      <ScrollView stickyHeaderIndices={headings} style={{ maxHeight: Math.max(160, Math.min(500, height - 300)), marginHorizontal: -EDGE }} contentContainerStyle={{ paddingHorizontal: EDGE }}>
        {rows}
      </ScrollView>
      <Pressable accessibilityRole="link" onPress={onMore} style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', marginTop: 4 }}>
        <T size={14} weight="extra" color={colors.link}>
          Do-again shelf and more
        </T>
      </Pressable>
    </SlideSheet>
  );
}

/** One row of "Our garden": what it is for, then its choices. */
function LookRow({ label, children }: { label: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, marginTop: 6 }}>
      <T size={13} weight="extra" color={colors.textMuted} style={{ width: 54 }}>
        {label}
      </T>
      <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{children}</View>
    </View>
  );
}

/** A colour to paint with: a dot with a faint ring, and a dark ring round the one that is chosen. Eight sit across the sheet. */
function Swatch({ color, on, label, onPress }: { color: string; on: boolean; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ selected: on }} onPress={onPress} style={{ width: '12.5%', height: 44, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: color, boxShadow: on ? `0 0 0 2.5px ${colors.card}, 0 0 0 5px ${colors.text}` : `0 0 0 1.5px ${colors.outline}` }} />
    </Pressable>
  );
}

/** A choice in words. `locked` is for something not earned yet, which says when it will be. `wide` makes it fill its share of a row. */
function Choice({ label, on, locked, wide, onPress }: { label: string; on: boolean; locked?: string; wide?: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole={locked ? 'button' : 'radio'}
      accessibilityLabel={locked ? `${label}, ${locked}` : label}
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={{
        height: 44,
        flex: wide ? 1 : undefined,
        paddingHorizontal: 14,
        borderRadius: 22,
        borderWidth: 1.5,
        borderStyle: locked ? 'dashed' : 'solid',
        borderColor: on ? colors.button : colors.outline,
        backgroundColor: on ? colors.button : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <T size={14} weight="extra" color={on ? colors.onButton : locked ? colors.textMuted : colors.text} style={{ lineHeight: 16.1 }}>
        {label}
      </T>
      {locked ? (
        <T size={11.5} color={colors.textMuted} style={{ lineHeight: 13.5 }}>
          {locked}
        </T>
      ) : null}
    </Pressable>
  );
}

type LookTab = 'house' | 'lawn' | 'extras';
type PaintPart = 'roof' | 'walls' | 'door';

const LOOK_TABS: { key: LookTab; name: string }[] = [
  { key: 'house', name: 'House' },
  { key: 'lawn', name: 'Lawn' },
  { key: 'extras', name: 'Extras' },
];
const PAINT_PARTS: { part: PaintPart; label: string }[] = [
  { part: 'roof', label: 'Roof' },
  { part: 'walls', label: 'Walls' },
  { part: 'door', label: 'Door' },
];
/** The extras two to a row, so they sit in two equal columns. */
const EXTRA_ROWS = EXTRAS.reduce<(typeof EXTRAS)[]>((rows, extra, i) => {
  if (i % 2 === 0) rows.push([extra]);
  else rows[rows.length - 1].push(extra);
  return rows;
}, []);

/**
 * "Our garden", in three tabs. House: how far the house has grown with the group's rank, and the
 * group's paint for its roof, walls and door, twenty-four colours each. Lawn: how the lawn is
 * kept, and this device's sounds. Extras: the things the group has earned for the yard. While it
 * is open the camera pulls back to show the whole yard above it. Everyone in the group sees the
 * same garden, but the sounds are this device's own. Which tab and which part of the house are
 * showing is not kept.
 */
export function LookSheet({
  open,
  group,
  look,
  level,
  done,
  sound,
  onChange,
  onLocked,
  onSound,
  onClose,
}: {
  open: boolean;
  group: string;
  look: GardenLook;
  /** How far the house has grown, from 1 (the cottage) to 6 (the mansion). It follows the group's rank and is not chosen. */
  level: number;
  /** How many things the group has done, which is what earns the extras. */
  done: number;
  sound: boolean;
  onChange: (look: GardenLook) => void;
  /** An extra that is not earned yet was tapped. */
  onLocked: (extra: Extra) => void;
  onSound: (on: boolean) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const [tab, setTab] = useState<LookTab>('house');
  const [part, setPart] = useState<PaintPart>('roof');
  const house = houseWords(level);
  const painting = PAINT_PARTS.find((p) => p.part === part) ?? PAINT_PARTS[0];
  return (
    <SlideSheet open={open}>
      <SheetHead title="Our garden" line={`Everyone in ${group} sees these`} action="Done" onAction={onClose} />
      <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 6, marginTop: 8, marginBottom: 10 }}>
        {LOOK_TABS.map(({ key, name }) => (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityLabel={name}
            accessibilityState={{ selected: tab === key }}
            onPress={() => setTab(key)}
            style={{ flex: 1, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: tab === key ? colors.text : colors.background }}>
            <T size={14.5} weight="extra" color={tab === key ? colors.card : colors.text}>
              {name}
            </T>
          </Pressable>
        ))}
      </View>
      {/* As tall as its tallest tab, so the sheet does not change height between them. */}
      <View style={{ minHeight: 232 }}>
        {tab === 'house' ? (
          <>
            <T size={13} color={colors.textMuted} style={{ lineHeight: 18.2, marginBottom: 8 }}>
              <T size={13} weight="black">
                {house.name}
              </T>
              {house.rest}
            </T>
            <View accessibilityRole="radiogroup" accessibilityLabel="The part of the house to paint" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {PAINT_PARTS.map((p) => (
                <Choice key={p.part} label={p.label} on={part === p.part} onPress={() => setPart(p.part)} />
              ))}
            </View>
            <View accessibilityRole="radiogroup" accessibilityLabel={`${painting.label} colour`} style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
              {HOUSE_PAINTS[part].map((color) => (
                <Swatch key={color} color={color} on={look[part] === color} label={`${painting.label}: ${PAINT_NAMES[color] ?? color}`} onPress={() => onChange({ ...look, [part]: color })} />
              ))}
            </View>
          </>
        ) : tab === 'lawn' ? (
          <>
            <LookRow label="Lawn">
              {LAWNS.map((lawn) => (
                <Choice key={lawn.key} label={lawn.name} on={look.lawn === lawn.key} onPress={() => onChange({ ...look, lawn: lawn.key })} />
              ))}
            </LookRow>
            <LookRow label="Sounds">
              <Choice label="Off" on={!sound} onPress={() => onSound(false)} />
              <Choice label="On" on={sound} onPress={() => onSound(true)} />
            </LookRow>
          </>
        ) : (
          <View accessibilityLabel="Extras" style={{ gap: 6 }}>
            {EXTRA_ROWS.map((row) => (
              <View key={row[0].key} style={{ flexDirection: 'row', gap: 6 }}>
                {row.map((extra) =>
                  done >= extra.at ? (
                    <Choice key={extra.key} wide label={extra.name} on={look[extra.key]} onPress={() => onChange({ ...look, [extra.key]: !look[extra.key] })} />
                  ) : (
                    <Choice key={extra.key} wide label={extra.name} on={false} locked={`at ${extra.at} done`} onPress={() => onLocked(extra.key)} />
                  ),
                )}
                {row.length === 1 ? <View style={{ flex: 1 }} /> : null}
              </View>
            ))}
          </View>
        )}
      </View>
    </SlideSheet>
  );
}

/**
 * Under the buttons of a finished idea's card: where its picture is from, and the way to give it
 * a photo of the group's own. A photo found by search is credited here, with its links, which is
 * what lets it hang in a frame without a caption. `shown` is false when the picture could not be
 * loaded and the card shows the pressed flower instead.
 */
export function CardSource({ idea, shown, busy, onAdd }: { idea: Pick<Finished, 'source' | 'credit'>; shown: boolean; busy: boolean; onAdd: () => void }) {
  const { colors } = useTheme();
  const label = idea.source === 'own' ? 'Change photo' : 'Add our photo';
  return (
    <>
      {shown && idea.source === 'found' && idea.credit ? (
        <PhotoCredit photo={idea.credit} size={13.5} color={colors.white} />
      ) : (
        <T size={13.5} color={colors.white} lines={1}>
          {sourceWords(idea, shown)}
        </T>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        onPress={onAdd}
        style={({ pressed }) => ({ height: 44, paddingHorizontal: 14, justifyContent: 'center', opacity: busy ? 0.45 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] })}>
        <T size={15} weight="extra" color={colors.white} style={{ textDecorationLine: 'underline' }}>
          {label}
        </T>
      </Pressable>
    </>
  );
}

/**
 * A postcard of the garden as it looks now, or the card of one finished idea from a frame in the
 * house: the picture on a white card, tilted a little, over the dimmed garden, with the buttons
 * that send it or keep it. Null puts it away. `flash` goes up by one each time a picture of the
 * garden is taken, and the screen flashes white like a camera. `below` goes under the buttons.
 */
export function Postcard({
  picture,
  title,
  line,
  alt,
  whole,
  flash,
  busy,
  below,
  onShare,
  onSave,
  onClose,
}: {
  /** The picture, as a data address. Null when there is no card. */
  picture: string | null;
  title: string;
  line: string;
  /** What the picture is, for a screen reader. */
  alt: string;
  /** Show the whole title, on as many lines as it needs. Otherwise it is kept to one. */
  whole?: boolean;
  below?: ReactNode;
  flash: number;
  /** True while the card is being made to share or save. */
  busy: boolean;
  onShare: () => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const open = picture !== null;
  const { shown: dim, away } = useOpening(open, 300);
  const { shown: rise } = useOpening(open, 500, CARD_EASE);
  // What was last shown, kept while the card fades away.
  const [last, setLast] = useState({ picture, title, line, alt, whole });
  if (picture && (picture !== last.picture || title !== last.title || line !== last.line || alt !== last.alt || whole !== last.whole)) setLast({ picture, title, line, alt, whole });
  const [white] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (flash === 0 || reduced !== false) return;
    white.setValue(0.9);
    const run = Animated.timing(white, { toValue: 0, duration: 500, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE });
    run.start();
    return () => run.stop();
  }, [flash, reduced, white]);
  const shown = last.picture;
  return (
    <>
      <Animated.View
        pointerEvents={open ? 'auto' : 'none'}
        accessibilityViewIsModal={open}
        accessibilityElementsHidden={!open}
        importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
        style={[{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: POSTCARD.dim, alignItems: 'center', justifyContent: 'center', gap: 24, opacity: dim }, away]}>
        <Animated.View
          style={{
            width: 292,
            backgroundColor: POSTCARD.card,
            paddingTop: 12,
            paddingHorizontal: 12,
            paddingBottom: 14,
            borderRadius: 6,
            boxShadow: `0 8px 12px ${POSTCARD.shadow}`,
            transform: [{ rotate: '-3deg' }, { translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }, { scale: rise.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) }],
          }}>
          {shown ? (
            <Image source={{ uri: shown }} accessibilityLabel={last.alt} resizeMode="cover" style={{ width: '100%', aspectRatio: 4 / 5, borderRadius: 3, backgroundColor: POSTCARD.blank }} />
          ) : (
            <View style={{ width: '100%', aspectRatio: 4 / 5, borderRadius: 3, backgroundColor: POSTCARD.blank }} />
          )}
          <T size={18} weight="black" color={POSTCARD.ink} lines={last.whole ? undefined : 1} style={{ marginTop: 10 }}>
            {last.title}
          </T>
          <T size={12.5} color={POSTCARD.muted} lines={1}>
            {last.line}
          </T>
        </Animated.View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pill label="Share" pad={18} disabled={busy} onPress={onShare} />
          <Pill label="Save picture" kind="outline" pad={18} ink={colors.white} disabled={busy} onPress={onSave} />
          <Pill label="Close" kind="text" pad={18} ink={colors.white} onPress={onClose} />
        </View>
        {/* Close up under the buttons. A long credit takes a line of its own. */}
        {open && below ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', columnGap: 4, marginTop: -12, paddingHorizontal: EDGE }}>{below}</View> : null}
      </Animated.View>
      <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.white, opacity: white }} />
    </>
  );
}
