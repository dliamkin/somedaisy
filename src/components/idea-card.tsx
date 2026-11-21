import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import type { Comment } from '@/lib/comments';
import type { Idea, Member, Reaction } from '@/lib/data';
import { siteName } from '@/lib/links';
import type { ListLook } from '@/lib/looks';
import { cardPicture } from '@/lib/pictures';
import { countdown, formatPlan } from '@/lib/plans';
import { somedayLabel } from '@/lib/someday';
import { MORE_REACTIONS, useTheme } from '@/lib/theme';

import { ActionIcon, IconAction } from './action-icons';
import { DoneButtons } from './coming-up';
import { Emoji } from './emoji';
import { ListTile } from './list-tile';
import { Avatar, Button, Card, Chip, T } from './ui';

// The card's corners, and how tall the picture across the top of a card is.
const RADIUS = 26;
const PICTURE = 170;
// The space between the side of a card and what is on it.
const SIDE = 14;

/**
 * One idea on a group's page.
 *
 * An idea with a picture (its own, or the one from the page it links to) gets a picture card: the
 * picture across the top with the name over it. An idea without one, or whose picture will not
 * load, gets a compact card: its list's icon, then the name. Both end the same way: the votes and
 * "Plan it", then a row that opens the comments and shows the latest one.
 *
 * Sharing and editing are behind the "..." button, to leave room for that comment row.
 */
export function IdeaCard({
  idea,
  listName,
  look,
  members,
  reactions,
  userId,
  now,
  toDo,
  canDate,
  allIn,
  comments,
  latest,
  pickerOpen,
  confirming,
  onReact,
  onPickEmoji,
  onPlan,
  onComments,
  onMore,
  onOpenLink,
  onAskDone,
  onDone,
  onNotYet,
}: {
  idea: Idea;
  /** The list the idea is on, when it is known. */
  listName: string | null;
  look: ListLook;
  members: Member[];
  /** The reactions to this idea only. */
  reactions: Reaction[];
  userId: string;
  now: Date;
  /** Something to go and do, which people are in or out on and can plan. Otherwise only kept on a list. */
  toDo: boolean;
  /** Whether ideas on this list can be given a date. */
  canDate: boolean;
  /** Every member has said yes. */
  allIn: boolean;
  /** How many comments the idea has, and the newest of them. */
  comments: number;
  latest: Comment | null;
  /** Whether the grid of emoji to react with is open on this card. */
  pickerOpen: boolean;
  /** True once "We did it!" or "Did it early" has been tapped on this card, while the app asks to be sure. */
  confirming: boolean;
  onReact: (emoji: string) => void;
  onPickEmoji: () => void;
  onPlan: () => void;
  onComments: () => void;
  onMore: () => void;
  onOpenLink: () => void;
  onAskDone: () => void;
  onDone: () => void;
  onNotYet: () => void;
}) {
  const { colors } = useTheme();
  // Remember the picture that failed, so a different one gets its own chance.
  const [broken, setBroken] = useState<string | null>(null);
  const shown = cardPicture(idea);
  const picture = shown && broken !== shown ? shown : null;

  const count = (emoji: string) => reactions.filter((r) => r.emoji === emoji).length;
  const mine = (emoji: string) => reactions.some((r) => r.emoji === emoji && r.user_id === userId);
  const ups = count('👍');
  const downs = count('👎');
  // Every other emoji someone has used on this idea, in the order they were first used.
  const extras = [...new Set(reactions.map((r) => r.emoji))].filter((e) => e !== '👍' && e !== '👎');
  const waiting = members.filter((m) => !reactions.some((r) => r.user_id === m.user_id && (r.emoji === '👍' || r.emoji === '👎')));
  const nameOf = (uid: string | null) => (uid === userId ? 'you' : (members.find((m) => m.user_id === uid)?.name ?? 'someone'));
  // The clock stops once the idea has a date.
  const clock = idea.planned_for ? null : somedayLabel(idea.created_at, now);
  const about = `Added by ${nameOf(idea.added_by)}${clock ? ` · ${clock}` : ''}`;
  const agreed = allIn && toDo ? (members.length === 2 ? 'Both in' : "Everyone's in") : null;
  const planned = idea.planned_for ? formatPlan(idea.planned_for, now) : null;
  const commenter = latest ? members.find((m) => m.user_id === latest.user_id) : null;

  const more = (onPicture: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`More for ${idea.title}: share, edit`}
      onPress={onMore}
      hitSlop={6}
      style={({ pressed }) => [
        { alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 },
        onPicture
          ? { position: 'absolute', right: 10, top: 10, width: 36, height: 36, borderRadius: 18, backgroundColor: colors.white, boxShadow: `0 4px 10px ${colors.shadow}` }
          : { width: 40, height: 40, borderRadius: 20 },
      ]}>
      <ActionIcon name="more" size={onPicture ? 20 : 22} color={onPicture ? colors.ink : colors.textMuted} />
    </Pressable>
  );

  // The date button: the main thing to do with an idea, so it alone has its name on show. A date
  // already set always shows, and can be changed or taken off, even on a list that no longer has dates.
  const date = planned ? (
    <IconAction tip="end" icon="date" strong label={`Planned for ${planned}. Change date`} text={planned} onPress={onPlan} />
  ) : canDate ? (
    <Button label="Plan it" small onPress={onPlan} style={{ height: 40, paddingHorizontal: 16 }} />
  ) : null;

  return (
    <Card style={{ padding: 0, gap: 0, borderRadius: RADIUS }}>
      {picture ? (
        // Only the picture is cut to the card's top corners. The rest of the card is left open, so the
        // words that appear over an icon on a computer are not cut off at its edge.
        <View style={{ height: PICTURE, borderTopLeftRadius: RADIUS, borderTopRightRadius: RADIUS, overflow: 'hidden', backgroundColor: colors.background }}>
          <Pressable
            accessibilityRole={idea.link ? 'link' : 'image'}
            accessibilityLabel={idea.link ? `${idea.title}. ${about}. Open the link` : `${idea.title}. ${about}`}
            disabled={!idea.link}
            onPress={onOpenLink}
            style={{ flex: 1 }}>
            <Image source={{ uri: picture }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" onError={() => setBroken(picture)} />
            {/* The name is in white over the foot of the picture, which is darkened behind it. The same in both modes. */}
            <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 34, paddingHorizontal: SIDE, paddingBottom: 12 }}>
              <Svg pointerEvents="none" width="100%" height="100%" viewBox="0 0 1 1" preserveAspectRatio="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
                <Defs>
                  <LinearGradient id="idea-fade" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={colors.ink} stopOpacity={0} />
                    <Stop offset="1" stopColor={colors.ink} stopOpacity={0.82} />
                  </LinearGradient>
                </Defs>
                <Rect width={1} height={1} fill="url(#idea-fade)" />
              </Svg>
              <T size={20} weight="black" color={colors.white} lines={3} style={{ lineHeight: 23, letterSpacing: -0.3 }}>
                {idea.title}
              </T>
              <T size={13} color={colors.white} lines={1} style={{ opacity: 0.95 }}>
                {about}
              </T>
            </View>
            <View pointerEvents="none" style={{ position: 'absolute', left: 12, top: 12, right: 56, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {listName ? <Tag label={listName} background={colors.white} ink={colors.ink} /> : null}
              {planned ? <Tag label={planned} background={colors.button} ink={colors.onButton} /> : null}
              {agreed ? <Tag label={agreed} background={colors.mint} ink={colors.mintText} /> : null}
            </View>
          </Pressable>
          {more(true)}
        </View>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingTop: 14, paddingLeft: SIDE, paddingRight: 10, paddingBottom: 2 }}>
          {/* An idea with no picture still gets one, so no card is bare: its list's icon on the list's colour. */}
          <ListTile icon={look.icon} color={look.color} />
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <T size={17} weight="extra" style={{ lineHeight: 21 }}>
              {idea.title}
            </T>
            <T size={13} color={colors.textMuted}>
              {listName ? `${listName} · ` : ''}
              {about}
            </T>
            {agreed ? (
              <View style={{ flexDirection: 'row', paddingTop: 4 }}>
                <Tag label={agreed} background={colors.mint} ink={colors.mintText} />
              </View>
            ) : null}
          </View>
          {more(false)}
        </View>
      )}

      {idea.note || (idea.link && !picture) ? (
        <View style={{ paddingHorizontal: SIDE, paddingTop: 10, gap: 6 }}>
          {idea.note ? (
            <T size={14} weight="medium">
              {idea.note}
            </T>
          ) : null}
          {/* On a picture card, tapping the picture opens the link. Without a picture, the link needs somewhere to be tapped. */}
          {idea.link && !picture ? (
            <Pressable accessibilityRole="link" accessibilityLabel={`Open the link for ${idea.title}`} onPress={onOpenLink} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <ActionIcon name="link" size={16} />
              <T size={14} color={colors.link} lines={1} style={{ flexShrink: 1, textDecorationLine: 'underline' }}>
                {siteName(idea.link)}
              </T>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {/* The votes, and at the right the date. A list that is only for keeping things has thumbs in place of "I'm in" and "Eh". */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: toDo ? 6 : 2, paddingHorizontal: 12, paddingVertical: 10 }}>
        {toDo ? (
          <>
            <Chip soft small label={ups ? `I'm in · ${ups}` : "I'm in"} accessibilityLabel={`I'm in, ${ups}`} selected={mine('👍')} onPress={() => onReact('👍')} />
            <Chip soft small label={downs ? `Eh · ${downs}` : 'Eh'} accessibilityLabel={`Eh, ${downs}`} selected={mine('👎')} onPress={() => onReact('👎')} />
            {extras.map((e) => (
              <Chip soft small key={e} before={<Emoji char={e} size={18} />} label={String(count(e))} accessibilityLabel={`${e}, ${count(e)}`} selected={mine(e)} onPress={() => onReact(e)} />
            ))}
            <Chip soft small label="+ emoji" accessibilityLabel="Add a reaction" onPress={onPickEmoji} />
          </>
        ) : (
          <>
            <IconAction tip="start" icon="up" label={ups === 0 ? 'Thumbs up' : ups === 1 ? 'Thumbs up, 1 person' : `Thumbs up, ${ups} people`} text={ups ? String(ups) : null} on={mine('👍')} onPress={() => onReact('👍')} />
            <IconAction tip="start" icon="down" label={downs === 0 ? 'Thumbs down' : downs === 1 ? 'Thumbs down, 1 person' : `Thumbs down, ${downs} people`} text={downs ? String(downs) : null} on={mine('👎')} onPress={() => onReact('👎')} />
            {extras.map((e) => (
              <IconAction
                key={e}
                noTip
                icon="emoji"
                picture={<Emoji char={e} size={22} />}
                label={count(e) === 1 ? `${e}, 1 person` : `${e}, ${count(e)} people`}
                text={String(count(e))}
                on={mine(e)}
                onPress={() => onReact(e)}
              />
            ))}
            <IconAction tip="start" icon="emoji" label="Add a reaction" onPress={onPickEmoji} />
          </>
        )}
        {date ? <View style={{ marginLeft: 'auto' }}>{date}</View> : null}
      </View>

      {pickerOpen ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, paddingHorizontal: 12, paddingBottom: 10 }}>
          {MORE_REACTIONS.map((e) => (
            <Pressable
              key={e}
              accessibilityRole="button"
              accessibilityLabel={`React with ${e}`}
              accessibilityState={{ selected: mine(e) }}
              onPress={() => onReact(e)}
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

      {/* A plan can be finished from here as well as from "Coming up" at the top of the page. Whoever
          just gave the idea a date comes back to this card, often with that one scrolled out of sight. */}
      {idea.planned_for ? (
        <View style={{ paddingHorizontal: SIDE, paddingBottom: 10, gap: 8 }}>
          <DoneButtons started={countdown(idea.planned_for, now) === null} confirming={confirming} onAskDone={onAskDone} onDone={onDone} onNotYet={onNotYet} />
        </View>
      ) : null}

      {toDo && !allIn && waiting.length > 0 && members.length > 1 ? (
        <T size={13} color={colors.textMuted} style={{ paddingHorizontal: SIDE, paddingBottom: 10 }}>
          Waiting on {waiting.map((m) => (m.user_id === userId ? 'you' : m.name)).join(', ')}
        </T>
      ) : null}

      {/* Always there, on every card: the newest comment, or the way to write the first. One tap opens the comments. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={comments === 0 ? `Add a comment on ${idea.title}` : comments === 1 ? 'Open the comment' : `Open all ${comments} comments`}
        onPress={onComments}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          minHeight: 44,
          paddingHorizontal: SIDE,
          paddingVertical: 10,
          borderTopWidth: 2,
          borderColor: colors.background,
          opacity: pressed ? 0.6 : 1,
        })}>
        {latest ? (
          <>
            <Avatar name={commenter?.name ?? 'Someone'} color={commenter?.color ?? colors.sky} photo={commenter?.photo} size={26} />
            <T size={14} lines={1} style={{ flex: 1, minWidth: 0 }}>
              <T size={14} weight="extra">
                {latest.user_id === userId ? 'You' : (commenter?.name ?? 'Someone')}:{' '}
              </T>
              {latest.body.replace(/\s+/g, ' ')}
            </T>
            <ActionIcon name="comment" size={18} />
            <T size={14} weight="extra" color={colors.link}>
              {comments}
            </T>
          </>
        ) : (
          <>
            <ActionIcon name="comment" size={20} />
            <T size={14} color={colors.textMuted}>
              Add a comment
            </T>
          </>
        )}
      </Pressable>
    </Card>
  );
}

/** A small label over a picture, or under a name: the list, the date, or that everyone is in. */
function Tag({ label, background, ink }: { label: string; background: string; ink: string }) {
  return (
    <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: background, maxWidth: '100%' }}>
      <T size={12} weight="extra" color={ink} lines={1}>
        {label}
      </T>
    </View>
  );
}
