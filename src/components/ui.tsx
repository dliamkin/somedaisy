import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts, useTheme } from '@/lib/theme';

import { BackIcon, CloseIcon } from './daisy';
import { FlowerField } from './flower-outlines';

type Weight = 'medium' | 'bold' | 'extra' | 'black';

export function T({
  children,
  size = 16,
  weight = 'bold',
  color,
  center,
  style,
  lines,
}: {
  children: ReactNode;
  size?: number;
  weight?: Weight;
  color?: string;
  center?: boolean;
  style?: StyleProp<TextStyle>;
  lines?: number;
}) {
  const { colors } = useTheme();
  return (
    <Text
      numberOfLines={lines}
      style={[{ fontFamily: fonts[weight], fontSize: size, color: color ?? colors.text, textAlign: center ? 'center' : 'left' }, style]}>
      {children}
    </Text>
  );
}

/** The space between the side of the screen and what is on it. A little less than the space between two cards. */
const GUTTER = 16;

/**
 * Page wrapper: pastel background, phone-width column, optional pinned footer.
 * `flowers` draws the footer as a band of the brand's flowers that reaches the bottom of the screen.
 */
export function Screen({ children, footer, flowers }: { children: ReactNode; footer?: ReactNode; flowers?: boolean }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const band = Boolean(footer && flowers);
  return (
    // With the band, the bottom edge is left to the band itself, so its colour runs under the phone's own bar.
    <SafeAreaView edges={band ? ['top', 'left', 'right'] : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Makes room for the keyboard: the page gets shorter, so the box being typed in and the pinned buttons stay in view. */}
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center' }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: GUTTER, paddingTop: 24, paddingBottom: footer ? 12 : 16, gap: 18, flexGrow: 1 }}>
          {children}
        </ScrollView>
        {/* The same space above and below the pinned buttons. A phone's own bar at the bottom already leaves room there. */}
        {footer && !band ? <View style={{ paddingHorizontal: GUTTER, paddingTop: 12, paddingBottom: insets.bottom > 0 ? 4 : 12, gap: 8 }}>{footer}</View> : null}
        {footer && band ? (
          // The band is white like the cards and lifts off the page with a shadow cast upward, which
          // is what sets it apart from the list scrolling behind it. The shadow is on the outer box
          // and the flowers are cut to shape by the inner one, so neither clips the other.
          <View style={{ borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: colors.card, boxShadow: `0 -6px 18px ${colors.shadowStrong}` }}>
            <View
              style={{
                paddingHorizontal: GUTTER,
                paddingTop: 14,
                paddingBottom: insets.bottom + (insets.bottom > 0 ? 6 : 14),
                gap: 8,
                borderTopLeftRadius: 28,
                borderTopRightRadius: 28,
                // A hairline as well, for the phones that do not draw the shadow.
                borderTopWidth: 1,
                borderColor: colors.line,
                overflow: 'hidden',
              }}>
              <FlowerField />
              {footer}
            </View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Loading({ label }: { label?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.background }}>
      <ActivityIndicator color={colors.button} />
      {label ? <T color={colors.textMuted} size={14}>{label}</T> : null}
    </View>
  );
}

type ButtonKind = 'primary' | 'soft' | 'ghost' | 'outline' | 'danger';

export function Button({
  label,
  onPress,
  kind = 'primary',
  disabled,
  busy,
  small,
  style,
}: {
  label: string;
  onPress: () => void;
  kind?: ButtonKind;
  disabled?: boolean;
  busy?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, shadow } = useTheme();
  const height = small ? 44 : 56;
  const bg = kind === 'primary' ? colors.button : kind === 'ghost' ? 'transparent' : colors.card;
  const fg = kind === 'primary' ? colors.onButton : kind === 'soft' ? colors.text : kind === 'danger' ? colors.danger : colors.link;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled || busy) }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        {
          height,
          borderRadius: height / 2,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 20,
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
          borderWidth: kind === 'outline' || kind === 'danger' ? 3 : 0,
          borderColor: kind === 'danger' ? colors.danger : colors.button,
        },
        kind === 'primary' || kind === 'soft' ? shadow : null,
        style,
      ]}>
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <T size={small ? 15 : 18} weight="extra" color={fg}>
          {label}
        </T>
      )}
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors, shadow } = useTheme();
  return <View style={[{ backgroundColor: colors.card, borderRadius: 24, padding: 14, gap: 12 }, shadow, style]}>{children}</View>;
}

/**
 * A card with the faint flowers behind what it holds, for the things worth a second look: a plan
 * that is coming up, something on the do-again shelf. `shift` shows a different stretch of flowers.
 */
export function FlowerCard({ children, shift = 21 }: { children: ReactNode; shift?: number }) {
  return (
    // The card carries the shadow. The box inside it cuts the flowers to the card's rounded shape.
    <Card style={{ padding: 0 }}>
      <View style={{ borderRadius: 24, overflow: 'hidden', padding: 14, gap: 12 }}>
        <FlowerField shift={shift} />
        {children}
      </View>
    </Card>
  );
}

/** A person's circle: their photo when they have one that loads, otherwise their initial on their colour. */
export function Avatar({ name, color, size = 30, photo }: { name: string; color: string; size?: number; photo?: string | null }) {
  const { colors } = useTheme();
  // Remember the photo that failed, so a different one gets its own chance.
  const [broken, setBroken] = useState<string | null>(null);
  if (photo && broken !== photo) {
    return (
      <Image
        source={{ uri: photo }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }}
        contentFit="cover"
        accessibilityLabel={name}
        onError={() => setBroken(photo)}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <T size={Math.round(size * 0.43)} weight="extra" color={colors.onPastel}>
        {(name.trim()[0] ?? '?').toUpperCase()}
      </T>
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  dark,
  dashed,
  outlined,
  soft,
  small,
  before,
  accessibilityLabel,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  dark?: boolean;
  dashed?: boolean;
  /** A visible edge even when not selected, for a chip sitting on a white card. */
  outlined?: boolean;
  /**
   * For a choice on a card, such as a vote: a pale edge so it reads as a button, and the button
   * colour rather than pink once chosen.
   */
  soft?: boolean;
  /** Shorter and with smaller words, for a row of votes on a card. It can still be tapped a little outside its edge. */
  small?: boolean;
  /** A small picture before the words, such as an emoji. */
  before?: ReactNode;
  accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  const active = Boolean(selected);
  const hairline = Boolean(soft) && !active;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      hitSlop={small ? { top: 5, bottom: 5 } : undefined}
      style={{
        minHeight: small ? 34 : 44,
        paddingHorizontal: small ? 12 : 14,
        borderRadius: 22,
        flexDirection: 'row',
        gap: 5,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderStyle: dashed ? 'dashed' : 'solid',
        borderColor: dashed ? colors.outline : hairline ? colors.line : active && soft ? colors.button : active && !dark ? colors.accent : outlined ? colors.outline : 'transparent',
        backgroundColor: dashed ? 'transparent' : active ? (dark ? colors.tabOn : soft ? colors.voteOn : colors.selected) : colors.card,
      }}>
      {before}
      <T size={small ? 13 : 15} weight="extra" color={active && dark ? colors.onTabOn : colors.text}>
        {label}
      </T>
    </Pressable>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  autoFocus,
  maxLength,
  onSubmit,
  kind,
  after,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  autoFocus?: boolean;
  maxLength?: number;
  onSubmit?: () => void;
  /** Picks the right keyboard and autofill for an email address, an emailed code or a web address. */
  kind?: 'email' | 'code' | 'link';
  /** Something to sit beside the box, such as a button that fills it in. */
  after?: ReactNode;
}) {
  const { colors, dark } = useTheme();
  // The box being typed in gets an edge in the button colour, in place of the browser's own focus ring.
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <T size={14} weight="extra">
        {label}
      </T>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textDisabled}
        keyboardAppearance={dark ? 'dark' : 'light'}
        multiline={multiline}
        autoFocus={autoFocus}
        maxLength={maxLength}
        onSubmitEditing={onSubmit}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType={kind === 'email' ? 'email-address' : kind === 'code' ? 'number-pad' : kind === 'link' ? 'url' : 'default'}
        autoCapitalize={kind ? 'none' : undefined}
        autoCorrect={kind ? false : undefined}
        autoComplete={kind === 'email' ? 'email' : kind === 'code' ? 'one-time-code' : undefined}
        textContentType={kind === 'email' ? 'emailAddress' : kind === 'code' ? 'oneTimeCode' : undefined}
        returnKeyType={multiline ? 'default' : 'done'}
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: multiline ? 88 : 52,
          borderRadius: 18,
          borderWidth: 2,
          borderColor: focused ? colors.button : colors.line,
          outlineWidth: 0,
          backgroundColor: colors.card,
          paddingHorizontal: 16,
          paddingVertical: multiline ? 14 : 0,
          fontFamily: fonts.bold,
          fontSize: 16,
          color: colors.text,
          textAlignVertical: multiline ? 'top' : 'center',
        }}
      />
        {after}
      </View>
    </View>
  );
}

/**
 * A switch between a few choices that are always all on show, such as two ways of doing the
 * same thing. One is always chosen.
 */
export function Segmented<K extends string>({
  label,
  options,
  value,
  onChange,
  flat,
}: {
  /** What is being chosen, for a screen reader. */
  label: string;
  options: { key: K; label: string }[];
  value: K;
  onChange: (key: K) => void;
  /** For a switch that sits on a card: the page's colour behind it, and no shadow. */
  flat?: boolean;
}) {
  const { colors, shadow } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={[{ flexDirection: 'row', gap: 4, padding: 4, borderRadius: 26, backgroundColor: flat ? colors.background : colors.card }, flat ? null : shadow]}>
      {options.map((option) => {
        const on = option.key === value;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ checked: on }}
            onPress={() => onChange(option.key)}
            style={{ flex: 1, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, backgroundColor: on ? colors.button : 'transparent' }}>
            <T size={15} weight="extra" color={on ? colors.onButton : colors.text} lines={1}>
              {option.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

export function CircleButton({ children, onPress, label, flat }: { children: ReactNode; onPress: () => void; label: string; /** No shadow, for a button in a row of them. */ flat?: boolean }) {
  const { colors, shadow } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
        flat ? null : shadow,
      ]}>
      {children}
    </Pressable>
  );
}

export function TopBar({
  title,
  subtitle,
  backTo,
  right,
  close,
}: {
  title: string;
  subtitle?: string;
  backTo?: string;
  right?: ReactNode;
  /** An X in place of the back arrow, in the same spot, for a page opened to do one thing and then shut. */
  close?: boolean;
}) {
  const { colors } = useTheme();
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace((backTo ?? '/') as never);
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      {backTo !== undefined ? (
        <CircleButton onPress={goBack} label={close ? 'Close' : 'Back'}>
          {close ? <CloseIcon /> : <BackIcon />}
        </CircleButton>
      ) : (
        <View style={{ width: 44, height: 44 }} />
      )}
      <View style={{ alignItems: 'center', flexShrink: 1, paddingHorizontal: 8 }}>
        <T size={20} weight="black" lines={1}>
          {title}
        </T>
        {subtitle ? (
          <T size={13} color={colors.textMuted}>
            {subtitle}
          </T>
        ) : null}
      </View>
      {right ?? <View style={{ width: 44, height: 44 }} />}
    </View>
  );
}

export function ErrorNote({ message }: { message: string | null }) {
  const { colors } = useTheme();
  if (!message) return null;
  return (
    <View accessibilityRole="alert" style={{ backgroundColor: colors.dangerTint, borderRadius: 16, padding: 12 }}>
      <T size={14} color={colors.danger}>
        {message}
      </T>
    </View>
  );
}
