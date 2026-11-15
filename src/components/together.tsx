import type { ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { breakdown, categoryEmoji, levelFor, levelLine, type Completion, type Level } from '@/lib/points';
import { colors } from '@/lib/theme';

import { Daisy } from './daisy';
import { Button, Card, Chip, T } from './ui';

/** The group's shared bar: its title, and how far it is from the next one. */
export function PointsBar({ points, onPress }: { points: number; onPress?: () => void }) {
  const level = levelFor(points);
  const bar = (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <T size={14} weight="extra" lines={1} style={{ flexShrink: 1 }}>
          {levelLine(level)}
        </T>
        <T size={13} color={colors.muted}>
          {level.points} {level.points === 1 ? 'pt' : 'pts'}
        </T>
      </View>
      <View style={{ height: 10, borderRadius: 5, backgroundColor: colors.line, overflow: 'hidden' }}>
        <View style={{ width: `${Math.round(Math.min(1, Math.max(0, level.progress)) * 100)}%`, height: 10, borderRadius: 5, backgroundColor: colors.pink }} />
      </View>
    </View>
  );
  if (!onPress) return bar;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${levelLine(level)}. ${level.points} points. See your stamps`} onPress={onPress}>
      {bar}
    </Pressable>
  );
}

/** "Would you do it again?" with this person's answer picked out. */
export function AgainChoice({ answer, onAnswer, disabled }: { answer: boolean | null; onAnswer: (again: boolean) => void; disabled?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      <Chip label="Yes, again" selected={answer === true} onPress={disabled ? undefined : () => onAnswer(true)} />
      <Chip label="Once was enough" selected={answer === false} onPress={disabled ? undefined : () => onAnswer(false)} />
    </View>
  );
}

/** A full-screen grape sheet over the page. It scrolls, so nothing is cut off on a small phone. */
function Overlay({ children }: { children: ReactNode }) {
  return (
    <View accessibilityViewIsModal style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.grape }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 18 }}>{children}</ScrollView>
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
}: {
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
  return (
    <Overlay>
      <Daisy size={84} petal={colors.white} />
      <T size={38} weight="black" color={colors.white} center>
        {reached ? `You are ${reached.title} now!` : 'You did it!'}
      </T>
      <Card style={{ alignSelf: 'stretch', maxWidth: 420, padding: 16, gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <StampMark emoji={categoryEmoji(completion.list_name)} color={colors.mint} />
          <View style={{ flex: 1, gap: 2 }}>
            <T size={18} weight="extra">
              {completion.title}
            </T>
            <T size={13} color={colors.muted}>
              A new stamp for your group
            </T>
          </View>
        </View>
        <View style={{ gap: 4 }}>
          {breakdown(completion).map((line) => (
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
        <PointsBar points={total} />
      </Card>
      {answer !== undefined ? (
        <Card style={{ alignSelf: 'stretch', maxWidth: 420, padding: 16, gap: 10 }}>
          <T size={16} weight="extra">
            Would you do it again?
          </T>
          <T size={13} color={colors.muted}>
            If everyone says yes, it goes on your do-again shelf.
          </T>
          <AgainChoice answer={answer} onAnswer={onAnswer} />
        </Card>
      ) : null}
      <View style={{ alignSelf: 'stretch', maxWidth: 420 }}>
        <Button label="Nice" kind="outline" onPress={onClose} />
      </View>
    </Overlay>
  );
}

/** For the members who did not tap "We did it" themselves: the group has reached a new title. */
export function NewTitle({ level, onClose }: { level: Level; onClose: () => void }) {
  return (
    <Overlay>
      <Daisy size={96} petal={colors.white} />
      <T size={18} weight="extra" color={colors.white} center>
        Your group has a new title
      </T>
      <T size={40} weight="black" color={colors.white} center>
        {level.title}
      </T>
      <Card style={{ alignSelf: 'stretch', maxWidth: 420, padding: 16 }}>
        <PointsBar points={level.points} />
      </Card>
      <View style={{ alignSelf: 'stretch', maxWidth: 420 }}>
        <Button label="Nice" kind="outline" onPress={onClose} />
      </View>
    </Overlay>
  );
}

/** A round stamp: an emoji on a pastel circle with a dashed edge, drawn in the app (no image file). */
export function StampMark({ emoji, color, size = 56, special }: { emoji: string; color: string; size?: number; special?: boolean }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        borderWidth: special ? 3 : 2,
        borderStyle: 'dashed',
        borderColor: special ? colors.pink : colors.dash,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <T size={Math.round(size * 0.45)}>{emoji}</T>
    </View>
  );
}
