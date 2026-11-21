import { Linking, Text, type StyleProp, type TextStyle } from 'react-native';

import type { Cover } from '@/lib/covers';
import { creditName, searchedPhoto, UNSPLASH } from '@/lib/photo-search';
import { fonts, useTheme } from '@/lib/theme';

import { T } from './ui';

function open(address: string) {
  // A phone with no browser, or a blocked pop-up, is not worth an error on the screen.
  Promise.resolve(Linking.openURL(address)).catch(() => {});
}

/** A few words inside a line of text that open a web page. */
export function TextLink({ to, label, children }: { to: string; label?: string; children: string }) {
  const { colors } = useTheme();
  return (
    <Text
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={() => open(to)}
      style={{ fontFamily: fonts.extra, color: colors.link, textDecorationLine: 'underline' }}>
      {children}
    </Text>
  );
}

/**
 * Who took a cover's photo, for a photo found by search: "Photo by <name> on Unsplash", with the
 * name leading to the photographer's page and "Unsplash" to Unsplash. Unsplash asks for this
 * wherever one of its photos shows, so it goes with the cover on Home, on the group's page, in
 * its settings and in the cover picker. Nothing for any other cover.
 */
export function CoverCredit({ cover, size = 12, lines, style }: { cover: Cover; size?: number; lines?: number; style?: StyleProp<TextStyle> }) {
  const { colors } = useTheme();
  const photo = searchedPhoto(cover);
  if (!photo) return null;
  const name = creditName(photo.credit);
  return (
    <T size={size} weight="medium" color={colors.textMuted} lines={lines} style={style}>
      {name ? (
        <>
          Photo by{' '}
          <TextLink to={photo.creditUrl} label={`${name} on Unsplash`}>
            {name}
          </TextLink>{' '}
          on{' '}
          <TextLink to={UNSPLASH}>Unsplash</TextLink>
        </>
      ) : (
        <TextLink to={photo.creditUrl}>{photo.credit}</TextLink>
      )}
    </T>
  );
}
