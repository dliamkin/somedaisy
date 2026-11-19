import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { stampLook, type IconName, type StampList } from '@/lib/looks';
import { breakdown, levelFor, TITLES, type Completion, type Level } from '@/lib/points';
import { useTheme } from '@/lib/theme';

import { Blooming, Confetti, Overlay, PopIn, useReducedMotion } from './celebrate';
import { Daisy } from './daisy';
import { ListTile } from './list-tile';
import { Button, Card, Chip, T } from './ui';

/**
 * The frame of the points bar: the title the group holds on the left, the one it is working
 * towards on the right, the bar between them, and where that leaves the group underneath.
 * `fill` is the coloured part of the bar, which the two bars below draw in their own way.
 */
function BarFrame({ level, points, fill, tip }: { level: Level; points: number; fill: ReactNode; tip?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
        <View style={{ flexShrink: 1 }}>
          <T size={11} weight="extra" color={colors.textMuted}>
            GROUP RANK
          </T>
          <T size={15} weight="black" lines={1}>
            {level.title}
          </T>
        </View>
        <View style={{ flexShrink: 1, alignItems: 'flex-end' }}>
          <T size={11} weight="extra" color={colors.textMuted}>
            {level.next ? 'NEXT' : 'TOP RANK'}
          </T>
          <T size={15} weight="extra" color={colors.textMuted} lines={1}>
            {level.next ? level.next.title : 'You made it'}
          </T>
        </View>
      </View>
      <View>
        <View style={{ height: 12, borderRadius: 6, backgroundColor: colors.line, overflow: 'hidden' }}>{fill}</View>
        {tip}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
        <T size={12} color={colors.textMuted}>
          Rank {level.index + 1} of {TITLES.length} · {points} {points === 1 ? 'point' : 'points'}
        </T>
        {level.next ? (
          <T size={12} weight="extra" color={colors.link}>
            {Math.max(0, level.next.at - points)} to go
          </T>
        ) : null}
      </View>
    </View>
  );
}

const percent = (progress: number) => `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%` as const;

/** What a screen reader says for the bar. */
function barSays(level: Level): string {
  const place = `${level.title}, rank ${level.index + 1} of ${TITLES.length}, ${level.points} points`;
  return level.next ? `${place}. ${level.toNext} to go to ${level.next.title}` : `${place}. The top rank`;
}

/** The group's shared bar: its title, the next one, and how far along it is. */
export function PointsBar({ points, onPress }: { points: number; onPress?: () => void }) {
  const { colors } = useTheme();
  const level = levelFor(points);
  const bar = (
    <BarFrame
      level={level}
      points={level.points}
      fill={<View style={{ width: percent(level.progress), height: 12, borderRadius: 6, backgroundColor: colors.accent }} />}
    />
  );
  if (!onPress) return <View accessibilityLabel={barSays(level)}>{bar}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${barSays(level)}. See your stamps`} onPress={onPress}>
      {bar}
    </Pressable>
  );
}

/**
 * The bar, filling up from the points the group had to the points it has now, so the gain can be
 * seen. The number counts up with it, a sparkle rides the tip, and the bar gives a bounce when
 * it lands. When the gain reaches a new title, the bar fills to the end, then starts again on
 * the new title's bar.
 */
export function GrowingPointsBar({ from, to, delay = 0 }: { from: number; to: number; delay?: number }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const start = levelFor(from);
  const end = levelFor(to);
  const crosses = end.index > start.index;
  // The level whose bar is on show, and the points counted so far.
  const [shown, setShown] = useState<Level>(start);
  const [counted, setCounted] = useState(start.points);
  const [fill] = useState(() => new Animated.Value(start.progress));
  const [count] = useState(() => new Animated.Value(start.points));
  const [bounce] = useState(() => new Animated.Value(1));
  const [sparkle] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reduced === null) return;
    const finish = levelFor(to);
    if (reduced) {
      fill.setValue(finish.progress);
      const settle = setTimeout(() => {
        setShown(finish);
        setCounted(finish.points);
      }, 0);
      return () => clearTimeout(settle);
    }
    const counting = count.addListener(({ value }) => setCounted(Math.round(value)));
    const ease = Easing.out(Easing.cubic);
    const run = Animated.parallel([
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(sparkle, { toValue: 1, duration: 150, useNativeDriver: false }),
        Animated.timing(fill, { toValue: crosses ? 1 : finish.progress, duration: crosses ? 900 : 1300, easing: ease, useNativeDriver: false }),
      ]),
      Animated.sequence([Animated.delay(delay), Animated.timing(count, { toValue: finish.points, duration: crosses ? 1900 : 1300, easing: ease, useNativeDriver: false })]),
    ]);
    let second: Animated.CompositeAnimation | null = null;
    const land = () =>
      Animated.parallel([
        Animated.sequence([
          Animated.timing(bounce, { toValue: 1.9, duration: 140, useNativeDriver: false }),
          Animated.spring(bounce, { toValue: 1, friction: 3, tension: 120, useNativeDriver: false }),
        ]),
        Animated.timing(sparkle, { toValue: 0, duration: 700, delay: 400, useNativeDriver: false }),
      ]);
    run.start(({ finished }) => {
      if (!finished) return;
      if (!crosses) {
        second = land();
        second.start();
        return;
      }
      // A new title: show its bar from empty, and fill to where the group now stands on it.
      setShown(finish);
      fill.setValue(0);
      second = Animated.sequence([Animated.timing(fill, { toValue: finish.progress, duration: 900, easing: ease, useNativeDriver: false }), land()]);
      second.start();
    });
    return () => {
      run.stop();
      second?.stop();
      count.removeListener(counting);
    };
  }, [reduced, to, crosses, delay, fill, count, bounce, sparkle]);

  const width = fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return (
    <View accessibilityLabel={barSays(end)}>
      <BarFrame
        level={shown}
        points={counted}
        fill={<Animated.View style={{ width, height: 12, borderRadius: 6, backgroundColor: colors.accent }} />}
        tip={
          <Animated.View pointerEvents="none" style={{ position: 'absolute', top: -7, left: width, marginLeft: -13, opacity: sparkle, transform: [{ scale: bounce }] }}>
            <Spark size={26} />
          </Animated.View>
        }
      />
    </View>
  );
}

/**
 * The little star that rides the tip of the growing bar: a four-pointed sparkle in the daisy's
 * yellow with a white heart and a soft glow, drawn here so it looks the same on every phone.
 */
function Spark({ size }: { size: number }) {
  const { colors } = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 26 26">
      <Circle cx={13} cy={13} r={12} fill={colors.daisyCenter} opacity={0.4} />
      <Path d="M13 1.5 L15.4 10.6 L24.5 13 L15.4 15.4 L13 24.5 L10.6 15.4 L1.5 13 L10.6 10.6 Z" fill={colors.daisyCenter} stroke={colors.accent} strokeWidth={1.4} strokeLinejoin="round" />
      <Circle cx={13} cy={13} r={2.6} fill={colors.white} />
    </Svg>
  );
}

/** "Would you do it again?" as two clear buttons, with this person's answer picked out. */
export function AgainChoice({ answer, onAnswer, disabled }: { answer: boolean | null; onAnswer: (again: boolean) => void; disabled?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      <Chip label="😍 Yes, again" outlined selected={answer === true} onPress={disabled ? undefined : () => onAnswer(true)} />
      <Chip label="😌 Once was enough" outlined selected={answer === false} onPress={disabled ? undefined : () => onAnswer(false)} />
    </View>
  );
}

/** The daisy and headline at the top of a celebration, popping in one after the other. */
function Headline({ small, title }: { small?: string; title: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: 10 }}>
      <PopIn>
        <Daisy size={96} petal={colors.white} />
      </PopIn>
      <PopIn delay={180} style={{ alignItems: 'center', gap: 4 }}>
        {small ? (
          <T size={18} weight="extra" color={colors.onButton} center>
            {small}
          </T>
        ) : null}
        <T size={40} weight="black" color={colors.onButton} center style={{ lineHeight: 46 }}>
          {title}
        </T>
      </PopIn>
    </View>
  );
}

/**
 * The one screen for finishing something: the points it earned and why, the stamp, a new title
 * if this reached one, and the do-again question.
 */
export function YouDidIt({
  completion,
  total,
  reached,
  answer,
  onAnswer,
  onClose,
  onUndo,
  undoing,
  lists,
}: {
  /** The group's lists in their usual order, so the stamp matches its list's icon and colour. */
  lists?: StampList[];
  /** Takes the mark back, with its points and stamp. Left out when undo is not on offer. */
  onUndo?: () => void;
  undoing?: boolean;
  completion: Completion;
  /** The group's points now, this completion included. */
  total: number;
  /** The new title, when this completion reached one. */
  reached: Level | null;
  /** This person's do-again answer so far, or undefined when the question cannot be asked. */
  answer: boolean | null | undefined;
  onAnswer: (again: boolean) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const lines = breakdown(completion);
  const look = stampLook(completion.list_id, completion.list_name, lists);
  return (
    <Overlay behind={<Confetti count={reached ? 70 : 44} />}>
      <Headline small={reached ? 'You did it! Your new rank:' : undefined} title={reached ? reached.title : 'You did it!'} />
      <PopIn delay={320}>
        <Blooming delay={900} corners={['topRight', 'bottomLeft', 'topLeft']}>
          <Card style={{ padding: 18, gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <StampMark icon={look.icon} color={look.color} size={48} special tilt={-6} />
              <View style={{ flex: 1, gap: 2 }}>
                <T size={19} weight="black">
                  {completion.title}
                </T>
                <T size={13} color={colors.textMuted}>
                  A new stamp for your group
                </T>
              </View>
              <View style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, backgroundColor: colors.mint }}>
                <T size={18} weight="black" color={colors.mintText}>
                  +{completion.points}
                </T>
              </View>
            </View>
            <View style={{ gap: 4 }}>
              {lines.map((line) => (
                <View key={line.label} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                  <T size={14} weight="medium">
                    {line.label}
                  </T>
                  <T size={14} weight="extra" color={colors.mintText}>
                    +{line.points}
                  </T>
                </View>
              ))}
            </View>
            <View style={{ height: 1, backgroundColor: colors.line }} />
            <GrowingPointsBar from={Math.max(0, total - completion.points)} to={total} delay={1000} />
          </Card>
        </Blooming>
      </PopIn>
      {answer !== undefined ? (
        <PopIn delay={520}>
          <Blooming delay={1500} corners={['bottomRight']}>
            <Card style={{ padding: 18, gap: 10 }}>
              <T size={17} weight="black">
                Would you do it again?
              </T>
              <T size={13} color={colors.textMuted}>
                If everyone says yes, it goes on your do-again shelf.
              </T>
              <AgainChoice answer={answer} onAnswer={onAnswer} />
            </Card>
          </Blooming>
        </PopIn>
      ) : null}
      <PopIn delay={700}>
        <Button label="Nice" kind="outline" onPress={onClose} />
      </PopIn>
      {onUndo ? (
        <PopIn delay={820}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Undo, we have not done this"
            disabled={undoing}
            onPress={onUndo}
            hitSlop={10}
            style={{ alignSelf: 'center', paddingVertical: 6 }}>
            <T size={14} weight="extra" color={colors.onButton} center style={{ textDecorationLine: 'underline' }}>
              {undoing ? 'Undoing...' : 'Tapped by mistake? Undo'}
            </T>
          </Pressable>
        </PopIn>
      ) : null}
    </Overlay>
  );
}

/** For the members who did not tap "We did it" themselves: the group has reached a new title. */
export function NewTitle({ level, onClose }: { level: Level; onClose: () => void }) {
  return (
    <Overlay behind={<Confetti count={70} />}>
      <Headline small="Your group has a new rank" title={level.title} />
      <PopIn delay={320}>
        <Blooming delay={900}>
          <Card style={{ padding: 18 }}>
            <PointsBar points={level.points} />
          </Card>
        </Blooming>
      </PopIn>
      <PopIn delay={520}>
        <Button label="Nice" kind="outline" onPress={onClose} />
      </PopIn>
    </Overlay>
  );
}

/** The whole group has said yes to an idea. */
export function EveryonesIn({ title, onPlan, onClose }: { title: string; /** Absent when the idea already has a date. */ onPlan?: () => void; onClose: () => void }) {
  const { colors } = useTheme();
  return (
    <Overlay behind={<Confetti />}>
      <Headline title="Everyone's in!" />
      <PopIn delay={320}>
        <Blooming delay={900}>
          <Card style={{ padding: 18 }}>
            <T size={19} weight="black">
              {title}
            </T>
            <T size={14} color={colors.textMuted}>
              The whole group said yes.
            </T>
          </Card>
        </Blooming>
      </PopIn>
      <PopIn delay={520} style={{ gap: 10 }}>
        {onPlan ? <Button label="Pick a date" kind="soft" onPress={onPlan} /> : null}
        <Button label={onPlan ? 'Later' : 'Nice'} kind="outline" onPress={onClose} />
      </PopIn>
    </Overlay>
  );
}

/**
 * A round stamp, drawn in the app (no image file): a list's icon on its colour, with outlined
 * flowers scattered behind it, inside a dashed ring like the edge of a postage stamp. `tilt`
 * turns it a few degrees, as if pressed on by hand. A special stamp has a heavier ring in the
 * daisy's yellow and a small star on its shoulder.
 */
export function StampMark({ icon, color, size = 56, special, tilt = 0 }: { icon: IconName; color: string; size?: number; special?: boolean; tilt?: number }) {
  const { colors } = useTheme();
  const ring = special ? 3 : 2;
  const gap = 3;
  const outer = size + (ring + gap) * 2;
  return (
    <View style={{ width: outer, height: outer, transform: [{ rotate: `${tilt}deg` }] }}>
      <View
        style={{
          width: outer,
          height: outer,
          borderRadius: outer / 2,
          borderWidth: ring,
          borderStyle: 'dashed',
          borderColor: special ? colors.gold : colors.outline,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <ListTile icon={icon} color={color} size={size} round flowers flat />
      </View>
      {special ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: -4, right: -4 }}>
          <Spark size={Math.round(size * 0.4)} />
        </View>
      ) : null}
    </View>
  );
}
