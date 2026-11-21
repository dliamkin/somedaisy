import { View } from 'react-native';

import { similarIdeas, type Known } from '@/lib/similar';
import { useTheme } from '@/lib/theme';

import { Card, T } from './ui';

// How many are shown. A hint, not a search: the closest few are enough to say "it is here".
const OPEN_SHOWN = 3;
const DONE_SHOWN = 2;

/**
 * Shown under the name of a new idea while it is typed: the ideas the group already has that are
 * like it. The ones still on a list come first. Things the group has already done come after,
 * fainter, as a look back. It only tells: the idea can still be added.
 */
export function AlreadyHere({ name, open, done, lists }: { name: string; open: readonly Known[]; done: readonly Known[]; lists: readonly { id: string; name: string }[] }) {
  const { colors } = useTheme();
  const stillOpen = similarIdeas(name, open, OPEN_SHOWN);
  const didIt = similarIdeas(name, done, DONE_SHOWN);
  if (stillOpen.length === 0 && didIt.length === 0) return null;
  const listOf = (idea: Known) => lists.find((l) => l.id === idea.list_id)?.name ?? null;
  const row = (idea: Known) => (
    <View key={idea.id} style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
      <T size={15} weight="extra" lines={1} style={{ flexShrink: 1 }}>
        {idea.title}
      </T>
      {listOf(idea) ? (
        <T size={13} color={colors.textMuted} lines={1}>
          {listOf(idea)}
        </T>
      ) : null}
    </View>
  );
  return (
    <Card style={{ gap: 10 }}>
      <View accessibilityLiveRegion="polite" style={{ gap: 10 }}>
        {stillOpen.length > 0 ? (
          <View style={{ gap: 4 }}>
            <T size={13} weight="extra" color={colors.textMuted}>
              Already on a list
            </T>
            {stillOpen.map(row)}
          </View>
        ) : null}
        {didIt.length > 0 ? (
          <View style={{ gap: 4, opacity: 0.6 }}>
            <T size={13} weight="extra" color={colors.textMuted}>
              Things we did
            </T>
            {didIt.map(row)}
          </View>
        ) : null}
      </View>
    </Card>
  );
}
