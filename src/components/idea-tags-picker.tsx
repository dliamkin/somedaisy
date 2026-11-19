import { View } from 'react-native';

import type { IdeaTags } from '@/lib/data';
import { SETTINGS, TAKES } from '@/lib/pick';
import { useTheme } from '@/lib/theme';

import { Chip, T } from './ui';

/**
 * The two optional tags on an idea: how long it takes, and staying in or going out. "Pick for
 * us" uses them to match the time the group has. Tapping the chosen one again clears it.
 */
export function IdeaTagsPicker({ value, onChange }: { value: IdeaTags; onChange: (tags: IdeaTags) => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <View style={{ gap: 2 }}>
        <T size={16} weight="extra">
          Good for... (optional)
        </T>
        <T size={14} color={colors.textMuted}>
          Helps &quot;Pick for us&quot; find something that fits the time you have.
        </T>
      </View>
      <View accessibilityLabel="How long it takes" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {TAKES.map((t) => (
          <Chip key={t.value} label={t.label} selected={value.takes === t.value} onPress={() => onChange({ ...value, takes: value.takes === t.value ? null : t.value })} />
        ))}
      </View>
      <View accessibilityLabel="Staying in or going out" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {SETTINGS.map((s) => (
          <Chip key={s.value} label={s.label} selected={value.setting === s.value} onPress={() => onChange({ ...value, setting: value.setting === s.value ? null : s.value })} />
        ))}
      </View>
    </View>
  );
}
