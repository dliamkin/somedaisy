import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isDark, type Cover as CoverData } from '@/lib/covers';
import { useTheme } from '@/lib/theme';

import { Cover, COVER } from './cover';
import { BackIcon } from './daisy';
import { CircleButton, FooterBand, GUTTER, T } from './ui';

// How far the panel under the cover rides up over it, and how round its top corners are.
const OVERLAP = 28;
const CORNER = 30;

/** A round button over the cover. `icon` is given the colour to draw in. */
export type CoverAction = { label: string; icon: (color: string) => ReactNode; onPress: () => void };

/**
 * A page whose top is a group's cover, edge to edge and running under the clock and battery.
 * The rest of the page sits on a panel in the page's own colour that rides up over the bottom of
 * the cover. The cover scrolls away with the page. Once it has gone, a small bar with the way
 * back, the group's name and the same buttons stays at the top.
 *
 * `under` goes below the name on the cover (see `Cover`). `footer` is pinned to the bottom of the
 * screen on a band of flowers.
 */
export function CoverPage({
  cover,
  name,
  earned,
  photoUri,
  onBack,
  actions,
  under,
  footer,
  children,
}: {
  cover: CoverData;
  name: string;
  earned: number;
  photoUri?: string | null;
  onBack: () => void;
  actions: CoverAction[];
  under?: ReactNode | ((ink: string) => ReactNode);
  footer?: ReactNode;
  children: ReactNode;
}) {
  const { colors, dark } = useTheme();
  const insets = useSafeAreaInsets();
  // Whether the cover has scrolled out from under the top of the screen.
  const [gone, setGone] = useState(false);
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
  const coverDark = isDark(cover, cover.kind === 'photo' && Boolean(photoUri));

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Dark words over a pale cover and light ones over a dark cover. Past the cover, whatever the mode asks for. */}
      {onShow ? <StatusBar style={gone ? (dark ? 'light' : 'dark') : coverDark ? 'light' : 'dark'} /> : null}
      <View style={{ flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center' }}>
        <ScrollView
          scrollEventThrottle={32}
          onScroll={(event) => {
            const past = event.nativeEvent.contentOffset.y > leaves;
            if (past !== gone) setGone(past);
          }}
          contentContainerStyle={{ flexGrow: 1 }}>
          <Cover
            cover={cover}
            place="page"
            name={name}
            earned={earned}
            photoUri={photoUri}
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
            {children}
          </View>
        </ScrollView>
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
      </View>
    </View>
  );
}
