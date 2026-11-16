import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { cleanHex, ICON_LABELS, ICONS, lookFor, TILE_COLORS, type IconName } from '@/lib/looks';
import { colors } from '@/lib/theme';

import { ListIcon, ListTile } from './list-tile';
import { Field, T } from './ui';

/** What someone has chosen for a list. Null means "not chosen": the app picks for them. */
export type LookChoice = { icon: IconName | null; color: string | null };

/**
 * Choose how a list looks: an icon from the whole set, and a colour from the ready-made ones or
 * typed as a colour code. The tile at the top shows the result as it will be on the cards.
 * Until something is chosen, it shows what the app would pick by itself (the daisy for a name it
 * does not recognise).
 */
export function ListLookPicker({ name, place, value, onChange }: { name: string; place: number; value: LookChoice; onChange: (next: LookChoice) => void }) {
  const shown = lookFor({ name, icon: value.icon, color: value.color }, place);
  // What is in the colour code box. It can be half typed, so it is kept apart from the colour in use.
  const [code, setCode] = useState(value.color ?? '');
  const typed = code.trim() === '' ? null : cleanHex(code);

  const pickColor = (color: string) => {
    setCode(color);
    onChange({ ...value, color });
  };
  const typeCode = (text: string) => {
    setCode(text);
    const color = cleanHex(text);
    if (color) onChange({ ...value, color });
    else if (text.trim() === '') onChange({ ...value, color: null });
  };

  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <ListTile icon={shown.icon} color={shown.color} size={56} />
        <View style={{ flex: 1 }}>
          <T size={14} weight="extra">
            How it looks
          </T>
          <T size={13} color={colors.muted}>
            Pick an icon and a colour, or leave them and the app chooses.
          </T>
        </View>
      </View>

      <View style={{ gap: 6 }}>
        <T size={14} weight="extra">
          Colour
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
          {TILE_COLORS.map((color) => {
            const on = shown.color === color;
            return (
              <Pressable
                key={color}
                accessibilityRole="button"
                accessibilityLabel={`Colour ${color}`}
                accessibilityState={{ selected: on }}
                onPress={() => pickColor(color)}
                style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: on ? colors.text : 'transparent' }}>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: color }} />
              </Pressable>
            );
          })}
        </View>
        <Field label="Or a colour code" value={code} onChangeText={typeCode} placeholder={shown.color} maxLength={7} kind="link" />
        {code.trim() !== '' && !typed ? (
          <T size={13} color={colors.muted}>
            A colour code is # followed by six letters or numbers, such as #2F7BE8.
          </T>
        ) : null}
      </View>

      <View style={{ gap: 6 }}>
        <T size={14} weight="extra">
          Icon
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
          {ICONS.map((icon) => {
            const on = shown.icon === icon;
            return (
              <Pressable
                key={icon}
                accessibilityRole="button"
                accessibilityLabel={ICON_LABELS[icon]}
                accessibilityState={{ selected: on }}
                onPress={() => onChange({ ...value, icon })}
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 2,
                  borderColor: on ? colors.grape : 'transparent',
                  backgroundColor: on ? colors.grapeTint : colors.ground,
                }}>
                <ListIcon name={icon} size={26} color={colors.text} />
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}
