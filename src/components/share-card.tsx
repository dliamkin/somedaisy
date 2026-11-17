import { Image } from 'expo-image';
import { View } from 'react-native';

import type { ListLook } from '@/lib/looks';
import type { CardRef } from '@/lib/share-picture';
import type { ShareWords } from '@/lib/share';
import { colors } from '@/lib/theme';

import { FlowerOutlines } from './flower-outlines';
import { ListTile } from './list-tile';
import { T } from './ui';

/** The card as drawn on screen. The picture made from it is larger, in the same four-to-five shape. */
export const CARD = { width: 300, height: 375 };

// The brand violet, the same as the splash screen.
const VIOLET = '#8A4BE6';
// The flower strip is 480 wide and 72 tall. A row of this height shows it at about the size it has on a group's cover.
const ROW = 54;
const ROWS = ['start', 'end', 'middle', 'start', 'end', 'middle', 'start'] as const;
// The white logo file is 1941 x 448.
const LOGO_RATIO = 1941 / 448;

/**
 * The picture of an idea for sharing: the idea on a white panel over the brand violet and its
 * flowers, with what is happening across the top and the SomeDaisy name along the bottom.
 * Everything on it is drawn in the app. `cardRef` is how the picture is taken of it.
 */
export function ShareCard({ cardRef, title, listName, look, words }: { cardRef: CardRef; title: string; listName: string | null; look: ListLook; words: ShareWords }) {
  const pill = words.kind === 'done' ? { bg: colors.mint, fg: colors.mintText } : words.kind === 'plan' ? { bg: colors.pinkTint, fg: colors.pink } : { bg: colors.grapeTint, fg: colors.link };
  return (
    // "collapsable" off keeps this a real view on Android, which taking its picture needs.
    <View
      ref={cardRef}
      collapsable={false}
      accessible
      accessibilityLabel={`A picture to share: ${words.kicker.toLowerCase()} ${title}${words.line ? `, ${words.line}` : ''}`}
      style={{ width: CARD.width, height: CARD.height, backgroundColor: VIOLET, overflow: 'hidden', padding: 20, justifyContent: 'space-between' }}>
      {/* The flower pattern is a wide strip, so it is laid in rows down the card, each row showing a different stretch. */}
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
        {ROWS.map((part, i) => (
          <View key={i} style={{ height: ROW }}>
            <FlowerOutlines opacity={0.28} part={part} />
          </View>
        ))}
      </View>
      <T size={15} weight="black" color={colors.white} center style={{ letterSpacing: 1.5 }}>
        {words.kicker}
      </T>
      <View style={{ backgroundColor: colors.white, borderRadius: 24, padding: 18, gap: 12, alignItems: 'center' }}>
        {/* A long name gets a smaller icon, so four lines of it still fit. */}
        <ListTile icon={look.icon} color={look.color} size={title.length > 48 ? 44 : 60} flat />
        <View style={{ gap: 2, alignSelf: 'stretch' }}>
          <T size={title.length > 48 ? 20 : 24} weight="black" center lines={4}>
            {title}
          </T>
          {listName ? (
            <T size={13} color={colors.muted} center lines={1}>
              {listName}
            </T>
          ) : null}
        </View>
        {words.line ? (
          <View style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: pill.bg }}>
            <T size={15} weight="black" color={pill.fg} center>
              {words.line}
            </T>
          </View>
        ) : null}
      </View>
      <View style={{ alignItems: 'center', gap: 2 }}>
        <Image source={require('../../assets/logo/somedaisy-logo-horizontal-white.png')} style={{ height: 26, width: Math.round(26 * LOGO_RATIO) }} contentFit="contain" />
        <T size={12} weight="extra" color={colors.white} center>
          somedaisy.com
        </T>
      </View>
    </View>
  );
}
