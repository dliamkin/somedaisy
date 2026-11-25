import { Platform, Pressable, View, type ViewStyle } from 'react-native';

import { reactionCount, summaryWords, type ReactionSummary } from '@/lib/comment-reactions';
import { COMMENT_REACTIONS, useTheme, type Theme } from '@/lib/theme';

import { ActionIcon } from './action-icons';
import { Emoji } from './emoji';
import { Avatar, Button, T } from './ui';

// How many holds are still being seen to (see `afterHold`). More than one only if two overlap.
let holds = 0;
// What a browser does of its own accord with a finger that stays down: select, and offer a menu.
const BROWSERS_OWN = ['click', 'contextmenu', 'selectstart'];

/**
 * For the website, called when pressing and holding has just opened something over the page. The
 * finger is still down, on what has opened and no longer on what was held, and a browser has two
 * things of its own to do with that:
 *
 * 1. A phone's browser has its own, slower, press and hold, which selects the word under the
 *    finger and offers to copy or look it up. So until the finger has lifted nothing on the page
 *    can be selected, and the browser's menu is turned down.
 * 2. Lifting the finger is followed by a click on whatever is under it, which would shut what has
 *    just opened, or choose something in it. That click is let go by.
 *
 * Nothing to do in the phone app, which has neither.
 */
export function afterHold(): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  const page = document.documentElement.style;
  const swallow = (event: Event) => {
    event.stopPropagation();
    event.preventDefault();
  };
  let over = false;
  const stop = () => {
    if (over) return;
    over = true;
    for (const type of BROWSERS_OWN) document.removeEventListener(type, swallow, true);
    document.removeEventListener('pointerup', lifted, true);
    document.removeEventListener('pointercancel', lifted, true);
    holds -= 1;
    if (holds > 0) return;
    page.removeProperty('user-select');
    page.removeProperty('-webkit-user-select');
  };
  // The click comes straight after the lift, if it comes at all.
  const lifted = () => setTimeout(stop, 400);
  holds += 1;
  page.setProperty('user-select', 'none');
  page.setProperty('-webkit-user-select', 'none');
  window.getSelection?.()?.removeAllRanges();
  for (const type of BROWSERS_OWN) document.addEventListener(type, swallow, true);
  document.addEventListener('pointerup', lifted, true);
  document.addEventListener('pointercancel', lifted, true);
  // Never left this way for good, whatever the browser does.
  setTimeout(stop, 10000);
}

// How tall the pills that hang off a comment are, and how far they hang below it.
const CLUSTER = 26;
export const CLUSTER_HANGS = 13;

// What the two pills that hang off a comment's bottom edge have in common.
const pill = (colors: Theme['colors'], pressed: boolean): ViewStyle => ({
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  height: CLUSTER,
  borderRadius: CLUSTER / 2,
  backgroundColor: colors.card,
  borderWidth: 1,
  borderColor: colors.line,
  boxShadow: `0 1px 3px ${colors.shadow}`,
  opacity: pressed ? 0.7 : 1,
});

/**
 * A comment's reactions, gathered into one small pill that hangs off the comment's bottom right corner:
 * the emoji used most, each overlapping the last, then how many people reacted. The number is in
 * the link colour when the person looking is one of them. Tapping it shows who reacted.
 */
export function ReactionCluster({ summary, onPress }: { summary: ReactionSummary; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={summaryWords(summary)}
      onPress={onPress}
      hitSlop={9}
      style={({ pressed }) => [pill(colors, pressed), { paddingLeft: 2, paddingRight: 8 }]}>
      {summary.top.map((emoji, i) => (
        // Each sits on a disc the colour of the pill, so the one before it shows as a clean crescent.
        <View key={emoji} style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', marginLeft: i ? -5 : 0, zIndex: summary.top.length - i }}>
          <Emoji char={emoji} size={17} />
        </View>
      ))}
      <T size={12.5} weight="extra" color={summary.mine ? colors.link : colors.textMuted} style={{ marginLeft: 3 }}>
        {summary.total}
      </T>
    </Pressable>
  );
}

/**
 * The small face with a plus, which opens the emoji to react with. A pill like the gathered
 * reactions, hanging off the comment's other bottom corner.
 */
export function AddReaction({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={9} style={({ pressed }) => [pill(colors, pressed), { paddingHorizontal: 8 }]}>
      <ActionIcon name="emoji" size={17} />
    </Pressable>
  );
}

/**
 * The emoji to react to a comment with, as a grid of round buttons. The person's own reaction is
 * marked, and tapping it takes it away.
 */
export function ReactionPicker({ mine, onPick }: { mine: string | null; onPick: (emoji: string) => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, justifyContent: 'center' }}>
      {COMMENT_REACTIONS.map((emoji) => (
        <Pressable
          key={emoji}
          accessibilityRole="button"
          accessibilityLabel={mine === emoji ? `Take away your ${emoji}` : `React with ${emoji}`}
          accessibilityState={{ selected: mine === emoji }}
          onPress={() => onPick(emoji)}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2,
            borderColor: mine === emoji ? colors.button : 'transparent',
            backgroundColor: mine === emoji ? colors.voteOn : colors.background,
          }}>
          <Emoji char={emoji} size={26} />
        </Pressable>
      ))}
    </View>
  );
}

/** One person who reacted, as the list of them needs it. */
export type Reactor = { id: string; name: string; color: string; photo?: string | null; emoji: string; me: boolean };

/** Who reacted to a comment, each with their emoji, in the order they did. The person looking can take theirs away from here. */
export function ReactionPeople({ people, onRemoveMine }: { people: Reactor[]; onRemoveMine: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 4 }}>
      <T size={13} color={colors.textMuted} style={{ paddingHorizontal: 4 }}>
        {reactionCount(people.length)}
      </T>
      {people.map((person) => (
        <View key={person.id} accessible accessibilityLabel={`${person.me ? 'You' : person.name}: ${person.emoji}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingHorizontal: 4 }}>
          <Avatar name={person.name} color={person.color} photo={person.photo} />
          <T size={15} weight="extra" lines={1} style={{ flex: 1 }}>
            {person.me ? 'You' : person.name}
          </T>
          <Emoji char={person.emoji} size={24} />
        </View>
      ))}
      {people.some((person) => person.me) ? <Button label="Take away my reaction" kind="ghost" small onPress={onRemoveMine} /> : null}
    </View>
  );
}
