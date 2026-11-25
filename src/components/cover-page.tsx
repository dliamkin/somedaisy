import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isDark, type Cover as CoverData } from '@/lib/covers';
import type { IconName } from '@/lib/looks';
import { searchedPhoto } from '@/lib/photo-search';
import { useTheme } from '@/lib/theme';

import { Cover, COVER } from './cover';
import { CoverCredit } from './cover-credit';
import { BackIcon, ForwardIcon } from './daisy';
import { ListIcon } from './list-tile';
import { CircleButton, FooterBand, GUTTER, T, TypingContext, useKeepInView } from './ui';

// How far the panel under the cover rides up over it, and how round its top corners are.
const OVERLAP = 28;
const CORNER = 30;
// How tall the small bar that stays at the top is, under the clock and battery.
const BAR = 56;
// What hangs on the seam between the cover and the panel (see `SeamPill`): how tall it is, how much
// of it sits on the cover, how wide it is taken to be until it has been measured, and the room
// kept between it and the photo's credit, which it would otherwise cover the end of.
const SEAM = 44;
const SEAM_ON_COVER = 18;
const SEAM_GUESS = 120;
const SEAM_CLEAR = 12;

/** A round button over the cover. `icon` is given the colour to draw in. */
export type CoverAction = { label: string; icon: (color: string) => ReactNode; onPress: () => void };

/**
 * A page whose top is a group's cover, edge to edge and running under the clock and battery.
 * The rest of the page sits on a panel in the page's own colour that rides up over the bottom of
 * the cover. The cover scrolls away with the page. Once it has gone, a small bar with the way
 * back, the group's name and the same buttons stays at the top.
 *
 * `under` goes below the name on the cover (see `Cover`). `footer` is pinned to the bottom of the
 * screen on a band of flowers. `seam` hangs at the right on the line where the panel meets the
 * cover, drawn over both.
 *
 * A box on the page that is being typed in is kept above the keyboard, as on every other page
 * (see `useKeepInView`), and clear of the small bar. Sliding the page puts the keyboard away,
 * so what a search found can be read with the whole screen.
 */
export function CoverPage({
  cover,
  name,
  earned,
  photo,
  onBack,
  actions,
  under,
  seam,
  footer,
  children,
}: {
  cover: CoverData;
  name: string;
  earned: number;
  photo?: { uri: string; key?: string } | null;
  onBack: () => void;
  actions: CoverAction[];
  under?: ReactNode | ((ink: string) => ReactNode);
  seam?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const { colors, dark } = useTheme();
  const insets = useSafeAreaInsets();
  // Whether the cover has scrolled out from under the top of the screen.
  const [gone, setGone] = useState(false);
  const [seamWide, setSeamWide] = useState(SEAM_GUESS);
  // The clock and battery follow the cover only while this page is the one on show: a page opened
  // over this one keeps this one alive underneath.
  const [onShow, setOnShow] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setOnShow(true);
      return () => setOnShow(false);
    }, []),
  );
  const leaves = COVER.page.height - OVERLAP - 8;
  const { scroller, reveal, typing, scrolled } = useKeepInView(insets.top + BAR + 12);
  const coverDark = isDark(cover, cover.kind === 'photo' && Boolean(photo));

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Dark words over a pale cover and light ones over a dark cover. Past the cover, whatever the mode asks for. */}
      {onShow ? <StatusBar style={gone ? (dark ? 'light' : 'dark') : coverDark ? 'light' : 'dark'} /> : null}
      {/* Makes room for the keyboard: the page gets shorter, so the box being typed in and the pinned buttons stay in view. */}
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center' }}>
        <TypingContext.Provider value={typing}>
        <ScrollView
          ref={scroller}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onLayout={reveal}
          scrollEventThrottle={32}
          onScroll={(event) => {
            const y = event.nativeEvent.contentOffset.y;
            scrolled(y);
            const past = y > leaves;
            if (past !== gone) setGone(past);
          }}
          contentContainerStyle={{ flexGrow: 1 }}>
          <Cover
            cover={cover}
            place="page"
            name={name}
            earned={earned}
            photo={photo}
            inset={insets.top}
            above={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {/* White with dark icons on every cover, pale or dark, in both modes. */}
                <CircleButton white label="Back to groups" onPress={onBack}>
                  <BackIcon color={colors.ink} />
                </CircleButton>
                <View style={{ flex: 1 }} />
                {actions.map((action) => (
                  <CircleButton white key={action.label} label={action.label} onPress={action.onPress}>
                    {action.icon(colors.ink)}
                  </CircleButton>
                ))}
              </View>
            }>
            {under}
          </Cover>
          {/* Placed from the top of the page and not hung off the panel, so all of it is inside what holds it
              and can be tapped on Android. It comes before the panel, so a keyboard and a screen reader
              reach it before what is on the panel, and is lifted to be drawn over the panel. */}
          {seam ? (
            <View
              onLayout={(event) => setSeamWide(Math.round(event.nativeEvent.layout.width))}
              style={{ position: 'absolute', zIndex: 1, top: COVER.page.height + insets.top - OVERLAP - SEAM_ON_COVER, right: GUTTER + insets.right }}>
              {seam}
            </View>
          ) : null}
          <View
            style={{
              flexGrow: 1,
              marginTop: -OVERLAP,
              borderTopLeftRadius: CORNER,
              borderTopRightRadius: CORNER,
              backgroundColor: colors.background,
              paddingTop: 16,
              paddingBottom: footer ? 12 : 16,
              paddingLeft: GUTTER + insets.left,
              paddingRight: GUTTER + insets.right,
              gap: 18,
            }}>
            {/* Who took the photo, straight under it, when the cover is one found by search. */}
            {/* With something on the seam, the credit keeps to one line and stops short of it. */}
            {searchedPhoto(cover) ? (
              <CoverCredit cover={cover} size={11} lines={seam ? 1 : undefined} style={{ marginTop: -6, marginBottom: -8, marginRight: seam ? seamWide + SEAM_CLEAR : 0 }} />
            ) : null}
            {children}
          </View>
        </ScrollView>
        </TypingContext.Provider>
        {gone ? (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingTop: insets.top + 6,
              paddingBottom: 6,
              paddingLeft: GUTTER + insets.left,
              paddingRight: GUTTER + insets.right,
              backgroundColor: colors.background,
              borderBottomWidth: 1,
              borderColor: colors.line,
            }}>
            <CircleButton flat label="Back to groups" onPress={onBack}>
              <BackIcon />
            </CircleButton>
            <T size={17} weight="black" lines={1} style={{ flex: 1 }}>
              {name}
            </T>
            {actions.map((action) => (
              <CircleButton flat key={action.label} label={action.label} onPress={action.onPress}>
                {action.icon(colors.text)}
              </CircleButton>
            ))}
          </View>
        ) : null}
        {footer ? <FooterBand>{footer}</FooterBand> : null}
      </KeyboardAvoidingView>
    </View>
  );
}

/**
 * A named pill for the seam of a `CoverPage`: an icon, a word and a caret. White in every mode,
 * like the round buttons at the top of the cover, since part of it sits on the cover.
 */
export function SeamPill({ label, says, icon, onPress }: { label: string; /** What a screen reader says, when the word alone is not enough. */ says?: string; icon: IconName; onPress: () => void }) {
  const { colors, shadow } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={says ?? label}
      onPress={onPress}
      style={({ pressed }) => [
        { height: SEAM, borderRadius: SEAM / 2, paddingLeft: 12, paddingRight: 13, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.white, opacity: pressed ? 0.85 : 1 },
        shadow,
      ]}>
      <ListIcon name={icon} size={19} color={colors.logoTile} />
      <T size={14} weight="extra" color={colors.ink}>
        {label}
      </T>
      <ForwardIcon color={colors.ink} />
    </Pressable>
  );
}
