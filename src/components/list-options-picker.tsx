import { Pressable, Switch, View } from 'react-native';

import { kindOf, withKind, type ListKind, type ListOptions } from '@/lib/list-options';
import type { IconName } from '@/lib/looks';
import { useTheme } from '@/lib/theme';

import { ListIcon } from './list-tile';
import { T } from './ui';

const KINDS: { key: ListKind; icon: IconName; title: string; about: string }[] = [
  { key: 'todo', icon: 'calendar', title: 'Things to do', about: "Pick a date, say I'm in, then mark it done." },
  { key: 'keep', icon: 'bulb', title: 'Just a list', about: 'Names, quotes, anything to keep. A thumbs up or down, and no dates.' },
];

const EXTRAS: { key: 'links' | 'notes'; title: string; on: string; off: string }[] = [
  { key: 'links', title: 'A link', on: 'A trailer, a map pin, a menu...', off: 'New ideas here have no link box.' },
  { key: 'notes', title: 'A note', on: 'A few words about it.', off: 'New ideas here have no note box.' },
];

/**
 * Choose what a list is for. First its kind: things to go and do, which can be given a date, or
 * just a list, which cannot. Then whether its ideas also have a link and a note. An idea's name
 * is always needed.
 *
 * `fresh` is for a list that is being made: picking a kind also sets the link and the note to
 * what that kind usually wants (both for things to do, neither for just a list), and they can
 * then be changed. For a list that exists, picking a kind leaves them alone.
 */
export function ListOptionsPicker({ value, onChange, fresh }: { value: ListOptions; onChange: (next: ListOptions) => void; fresh?: boolean }) {
  const { colors } = useTheme();
  const kind = kindOf(value);
  return (
    <View style={{ gap: 14 }}>
      <View style={{ gap: 8 }}>
        <T size={14} weight="extra">
          What kind of list is it?
        </T>
        <View accessibilityRole="radiogroup" accessibilityLabel="What kind of list is it?" style={{ gap: 8 }}>
          {KINDS.map((row) => {
            const on = row.key === kind;
            return (
              <Pressable
                key={row.key}
                accessibilityRole="radio"
                accessibilityLabel={`${row.title}. ${row.about}`}
                accessibilityState={{ checked: on }}
                onPress={() => onChange(withKind(value, row.key, Boolean(fresh)))}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  minHeight: 64,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderRadius: 18,
                  borderWidth: 2,
                  borderColor: on ? colors.button : 'transparent',
                  backgroundColor: on ? colors.voteOn : colors.background,
                }}>
                <ListIcon name={row.icon} size={26} color={colors.text} />
                <View style={{ flex: 1 }}>
                  <T size={15} weight="extra">
                    {row.title}
                  </T>
                  <T size={13} color={colors.textMuted}>
                    {row.about}
                  </T>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <View>
          <T size={14} weight="extra">
            Each idea can also have
          </T>
          <T size={13} color={colors.textMuted}>
            Every idea has a name. Anything turned off here is left off the form for a new idea.
          </T>
        </View>
        {EXTRAS.map((row) => (
          <View key={row.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <T size={15} weight="extra">
                {row.title}
              </T>
              <T size={13} color={colors.textMuted}>
                {value[row.key] ? row.on : row.off}
              </T>
            </View>
            <Switch
              accessibilityLabel={row.title}
              value={value[row.key]}
              onValueChange={(next) => onChange({ ...value, [row.key]: next })}
              trackColor={{ true: colors.button, false: colors.textDisabled }}
              thumbColor={colors.white}
            />
          </View>
        ))}
      </View>
    </View>
  );
}
