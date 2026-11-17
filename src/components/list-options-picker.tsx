import { Switch, View } from 'react-native';

import type { ListOptions } from '@/lib/list-options';
import { colors } from '@/lib/theme';

import { T } from './ui';

const ROWS: { key: keyof ListOptions; title: string; on: string; off: string }[] = [
  { key: 'dates', title: 'Can be given a date', on: 'For things to go and do: pick a date, then mark it done.', off: 'No dates please: this list is just for keeping things.' },
  { key: 'links', title: 'Show the link box', on: 'A trailer, a map pin, a menu...', off: 'New ideas here are not asked for a link.' },
  { key: 'notes', title: 'Show the note box', on: 'A few words about why it would be fun.', off: 'New ideas here are not asked for a note.' },
];

/**
 * Choose what a list asks for. An idea's name is always needed. Dates, the link box and the
 * note box are each on or off, and all start on.
 */
export function ListOptionsPicker({ value, onChange }: { value: ListOptions; onChange: (next: ListOptions) => void }) {
  return (
    <View style={{ gap: 12 }}>
      <View>
        <T size={14} weight="extra">
          What this list asks for
        </T>
        <T size={13} color={colors.muted}>
          Every idea needs a name. The rest is up to you.
        </T>
      </View>
      {ROWS.map((row) => (
        <View key={row.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <T size={15} weight="extra">
              {row.title}
            </T>
            <T size={13} color={colors.muted}>
              {value[row.key] ? row.on : row.off}
            </T>
          </View>
          <Switch
            accessibilityLabel={row.title}
            value={value[row.key]}
            onValueChange={(next) => onChange({ ...value, [row.key]: next })}
            trackColor={{ true: colors.grape, false: '#8E80A3' }}
            thumbColor={colors.white}
          />
        </View>
      ))}
    </View>
  );
}
