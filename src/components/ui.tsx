import { router } from 'expo-router';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts, shadow } from '@/lib/theme';

import { BackIcon } from './daisy';

type Weight = 'medium' | 'bold' | 'extra' | 'black';

export function T({
  children,
  size = 16,
  weight = 'bold',
  color = colors.text,
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
  return (
    <Text
      numberOfLines={lines}
      style={[{ fontFamily: fonts[weight], fontSize: size, color, textAlign: center ? 'center' : 'left' }, style]}>
      {children}
    </Text>
  );
}

/** Page wrapper: pastel background, phone-width column, optional pinned footer. */
export function Screen({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.ground }}>
      <View style={{ flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center' }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 24, paddingBottom: 16, gap: 18, flexGrow: 1 }}>
          {children}
        </ScrollView>
        {footer ? <View style={{ paddingHorizontal: 24, paddingBottom: 20, paddingTop: 4, gap: 8 }}>{footer}</View> : null}
      </View>
    </SafeAreaView>
  );
}

export function Loading({ label }: { label?: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.ground }}>
      <ActivityIndicator color={colors.grape} />
      {label ? <T color={colors.muted} size={14}>{label}</T> : null}
    </View>
  );
}

type ButtonKind = 'primary' | 'soft' | 'ghost' | 'outline';

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
  const height = small ? 44 : 56;
  const bg = kind === 'primary' ? colors.grape : kind === 'ghost' ? 'transparent' : colors.white;
  const fg = kind === 'primary' ? colors.white : kind === 'soft' ? colors.text : colors.link;
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
          borderWidth: kind === 'outline' ? 3 : 0,
          borderColor: colors.grape,
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
  return <View style={[{ backgroundColor: colors.white, borderRadius: 24, padding: 14, gap: 12 }, shadow, style]}>{children}</View>;
}

export function Avatar({ name, color, size = 30 }: { name: string; color: string; size?: number }) {
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
      <T size={Math.round(size * 0.43)} weight="extra">
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
  accessibilityLabel,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  dark?: boolean;
  dashed?: boolean;
  accessibilityLabel?: string;
}) {
  const active = Boolean(selected);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{
        minHeight: 44,
        paddingHorizontal: 14,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderStyle: dashed ? 'dashed' : 'solid',
        borderColor: dashed ? colors.dash : active && !dark ? colors.pink : 'transparent',
        backgroundColor: dashed ? 'transparent' : active ? (dark ? colors.text : colors.pinkTint) : colors.white,
      }}>
      <T size={15} weight="extra" color={active && dark ? colors.white : colors.text}>
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
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  autoFocus?: boolean;
  maxLength?: number;
  onSubmit?: () => void;
}) {
  return (
    <View style={{ gap: 6 }}>
      <T size={14} weight="extra">
        {label}
      </T>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#8B7E9C"
        multiline={multiline}
        autoFocus={autoFocus}
        maxLength={maxLength}
        onSubmitEditing={onSubmit}
        returnKeyType={multiline ? 'default' : 'done'}
        style={{
          minHeight: multiline ? 88 : 52,
          borderRadius: 18,
          borderWidth: 2,
          borderColor: colors.line,
          backgroundColor: colors.white,
          paddingHorizontal: 16,
          paddingVertical: multiline ? 14 : 0,
          fontFamily: fonts.bold,
          fontSize: 16,
          color: colors.text,
          textAlignVertical: multiline ? 'top' : 'center',
        }}
      />
    </View>
  );
}

export function CircleButton({ children, onPress, label }: { children: ReactNode; onPress: () => void; label: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
        shadow,
      ]}>
      {children}
    </Pressable>
  );
}

export function TopBar({ title, subtitle, backTo, right }: { title: string; subtitle?: string; backTo?: string; right?: ReactNode }) {
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace((backTo ?? '/') as never);
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      {backTo !== undefined ? (
        <CircleButton onPress={goBack} label="Back">
          <BackIcon />
        </CircleButton>
      ) : (
        <View style={{ width: 44, height: 44 }} />
      )}
      <View style={{ alignItems: 'center', flexShrink: 1, paddingHorizontal: 8 }}>
        <T size={20} weight="black" lines={1}>
          {title}
        </T>
        {subtitle ? (
          <T size={13} color={colors.muted}>
            {subtitle}
          </T>
        ) : null}
      </View>
      {right ?? <View style={{ width: 44, height: 44 }} />}
    </View>
  );
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View accessibilityRole="alert" style={{ backgroundColor: '#FDE7E5', borderRadius: 16, padding: 12 }}>
      <T size={14} color={colors.danger}>
        {message}
      </T>
    </View>
  );
}
