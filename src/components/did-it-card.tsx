import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import type { ListLook } from '@/lib/looks';
import { cardCredit, cardPicture } from '@/lib/pictures';
import { dayLabel } from '@/lib/plans';
import { useTheme } from '@/lib/theme';
import type { AgainPrompt } from '@/lib/together';

import { PhotoCredit } from './cover-credit';
import { CheckIcon, CloseIcon } from './daisy';
import { ListTile } from './list-tile';
import { AgainChoice } from './together';
import { FlowerCard, T } from './ui';

// The picture beside the words, and the green tick on its corner.
const PICTURE = 68;
const TICK = 24;

/**
 * Something the group did that this person has not yet said whether they would do again. It
 * waits on the group's page, under what is coming up: a keepsake of the thing itself (its
 * picture, or its list's icon, with a green tick), when it was done, and the question with its
 * two answers.
 *
 * It can be put off with the X, and then it is gone until the page is next opened. The question
 * is always there to answer under "Things we did" as well.
 */
export function DidItCard({
  prompt,
  listName,
  look,
  now,
  onAnswer,
  onLater,
}: {
  prompt: AgainPrompt;
  /** The list the idea was on, when it is known. */
  listName: string | null;
  look: ListLook;
  now: Date;
  onAnswer: (again: boolean) => void;
  onLater: () => void;
}) {
  const { colors } = useTheme();
  // Remember the picture that failed, so a different one gets its own chance.
  const [broken, setBroken] = useState<string | null>(null);
  const shown = cardPicture(prompt);
  const picture = shown && broken !== shown ? shown : null;
  // Who to credit, when the picture on show is a photo found by search.
  const credit = picture ? cardCredit(prompt) : null;
  const day = dayLabel(new Date(prompt.done_at), now);
  const when = day === 'Today' || day === 'Yesterday' ? day.toLowerCase() : `on ${day}`;

  return (
    <FlowerCard shift={64}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View style={{ width: PICTURE, height: PICTURE }}>
          {picture ? (
            <Image
              source={{ uri: picture }}
              style={{ width: PICTURE, height: PICTURE, borderRadius: 18, backgroundColor: colors.background }}
              contentFit="cover"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              onError={() => setBroken(picture)}
            />
          ) : (
            <ListTile icon={look.icon} color={look.color} size={PICTURE} />
          )}
          {/* Done: a green tick on the corner, with a rim the colour of the card so it stands clear of the picture. */}
          <View
            pointerEvents="none"
            style={{ position: 'absolute', right: -6, bottom: -6, width: TICK, height: TICK, borderRadius: TICK / 2, backgroundColor: colors.mintText, borderWidth: 2, borderColor: colors.card, alignItems: 'center', justifyContent: 'center' }}>
            <CheckIcon color={colors.white} size={11} />
          </View>
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <T size={12} weight="extra" color={colors.good} style={{ letterSpacing: 0.4 }}>
            YOU DID IT {when.toUpperCase()}
          </T>
          <T size={18} weight="black" lines={2} style={{ lineHeight: 22, letterSpacing: -0.2 }}>
            {prompt.title}
          </T>
          {listName ? (
            <T size={13} color={colors.textMuted} lines={1}>
              {listName}
            </T>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Ask me later about ${prompt.title}`}
          onPress={onLater}
          hitSlop={8}
          style={({ pressed }) => ({ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: -4, marginRight: -4, opacity: pressed ? 0.6 : 1 })}>
          <CloseIcon color={colors.textMuted} />
        </Pressable>
      </View>
      {credit ? <PhotoCredit photo={credit} size={11} lines={1} /> : null}
      <View style={{ gap: 8 }}>
        <T size={15} weight="extra">
          Would you do it again?
        </T>
        <AgainChoice answer={null} onAnswer={onAnswer} />
      </View>
    </FlowerCard>
  );
}
