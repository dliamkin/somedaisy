import { useState, type ReactNode } from 'react';
import { Pressable, Switch, View } from 'react-native';

import { CLASSIC, LOOKS, OWN_COLORS, readyLook, sameColor, surpriseLook, textOn, threeOf, type Cover, type Look } from '@/lib/covers';
import { useTheme } from '@/lib/theme';

import { CheckIcon } from './daisy';
import { CoverFlowers } from './flower-outlines';
import { T } from './ui';

type Well = 'background' | 'shape1' | 'shape2';

const WELLS: { key: Well; label: string }[] = [
  { key: 'background', label: 'Background' },
  { key: 'shape1', label: 'Shape 1' },
  { key: 'shape2', label: 'Shape 2' },
];

const capital = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

/**
 * The colours a group's cover can have: the four classic colours, the ready-made looks with
 * "Surprise me" beside them, three colours of the group's own, and whether the flower pattern is
 * drawn on top. It keeps nothing itself: `value` is the cover as it stands, and every tap hands
 * back the cover it would become, for the page to show in its preview and save when asked.
 *
 * `own` is for the three colours of the group's own. The form that makes a group leaves them out.
 */
export function CoverColors({ value, onChange, own = true }: { value: Cover; onChange: (cover: Cover) => void; own?: boolean }) {
  const { colors } = useTheme();
  // Which of the three colours is being picked: its grid of colours is open under the three.
  const [well, setWell] = useState<Well | null>(null);
  const three = threeOf(value);
  const byHand = value.kind === 'look' && !readyLook(three);
  const pickLook = (look: Look) => onChange({ kind: 'look', background: look.background, shape1: look.shape1, shape2: look.shape2, pattern: value.pattern });

  return (
    <View style={{ gap: 16 }}>
      <Section label="Classic">
        <Grid>
          {Object.keys(CLASSIC).map((key) => (
            <Swatch
              key={key}
              label={`${capital(key)}, classic`}
              on={value.kind === 'classic' && sameColor(value.background, CLASSIC[key])}
              onPress={() => onChange({ kind: 'classic', background: CLASSIC[key], pattern: value.pattern })}
              background={CLASSIC[key]}>
              {/* A classic cover is one colour with the flowers, so that is what its square shows. */}
              <CoverFlowers opacity={0.6} />
            </Swatch>
          ))}
        </Grid>
      </Section>

      <Section
        label="New looks"
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Surprise me with a new look"
            onPress={() => pickLook(surpriseLook())}
            style={({ pressed }) => ({
              height: 36,
              paddingHorizontal: 12,
              borderRadius: 18,
              borderWidth: 2,
              borderColor: colors.button,
              backgroundColor: colors.card,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.7 : 1,
            })}>
            <T size={13} weight="extra" color={colors.link}>
              Surprise me
            </T>
          </Pressable>
        }>
        <Grid>
          {LOOKS.map((look) => (
            <Swatch
              key={look.name}
              label={`${look.name} look`}
              on={value.kind === 'look' && readyLook(three)?.name === look.name}
              onPress={() => pickLook(look)}
              background={look.background}>
              <Dot color={look.shape1} size={34} right={-6} top={-10} />
              <Dot color={look.shape2} size={32} left={-8} bottom={-14} />
            </Swatch>
          ))}
        </Grid>
      </Section>

      {own ? (
        <Section label="Or pick your own three">
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {WELLS.map(({ key, label }) => (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={`${label} colour`}
                accessibilityState={{ expanded: well === key }}
                onPress={() => setWell(well === key ? null : key)}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  gap: 4,
                  padding: 8,
                  borderRadius: 18,
                  borderWidth: 2,
                  // The one being picked stands out. Otherwise all three are outlined once the colours are the group's own.
                  borderColor: well === key || (well === null && byHand) ? colors.button : colors.line,
                  backgroundColor: colors.card,
                }}>
                <View style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: colors.line, backgroundColor: three[key] }} />
                <T size={12} weight="extra" lines={1}>
                  {label}
                </T>
              </Pressable>
            ))}
          </View>
          {well ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingTop: 4 }}>
              {OWN_COLORS.map((colour) => {
                const on = value.kind === 'look' && sameColor(three[well], colour);
                return (
                  <Pressable
                    key={colour}
                    accessibilityRole="button"
                    accessibilityLabel={`Colour ${colour}`}
                    accessibilityState={{ selected: on }}
                    onPress={() => pickLook({ ...three, [well]: colour })}
                    hitSlop={2}
                    style={{
                      // Six to a row.
                      flexBasis: '14%',
                      flexGrow: 1,
                      height: 44,
                      borderRadius: 14,
                      borderWidth: on ? 3 : 2,
                      borderColor: on ? colors.button : colors.line,
                      backgroundColor: colour,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    {on ? <CheckIcon color={textOn(colour)} /> : null}
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </Section>
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 }}>
        <T size={15} weight="extra" style={{ flex: 1 }}>
          Flower pattern on top
        </T>
        <Switch
          accessibilityLabel="Flower pattern on top"
          value={value.pattern}
          onValueChange={(pattern) => onChange({ ...value, pattern })}
          trackColor={{ true: colors.button, false: colors.textDisabled }}
          thumbColor={colors.white}
        />
      </View>
    </View>
  );
}

function Section({ label, right, children }: { label: string; right?: ReactNode; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: right ? 36 : undefined }}>
        <T size={12} weight="extra" color={colors.textMuted} style={{ flex: 1, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {label}
        </T>
        {right}
      </View>
      {children}
    </View>
  );
}

/** Four to a row. */
function Grid({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{children}</View>;
}

/** One cover to choose, as a small square of its colours. The chosen one is outlined. */
function Swatch({ label, on, onPress, background, children }: { label: string; on: boolean; onPress: () => void; background: string; children?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={{ flexBasis: '22%', flexGrow: 1, height: 56, borderRadius: 18, borderWidth: 3, borderColor: on ? colors.button : 'transparent', padding: 3, backgroundColor: on ? colors.card : 'transparent' }}>
      <View style={{ flex: 1, borderRadius: 13, overflow: 'hidden', backgroundColor: background }}>{children}</View>
    </Pressable>
  );
}

function Dot({ color, size, top, bottom, left, right }: { color: string; size: number; top?: number; bottom?: number; left?: number; right?: number }) {
  return <View pointerEvents="none" style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color, top, bottom, left, right }} />;
}
