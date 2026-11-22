import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { cleanSearch, NOTHING_FOUND, SEARCH_MAX, SEARCH_SAYS, searchPhotos, UNSPLASH, type FoundPhoto } from '@/lib/photo-search';
import { useTheme } from '@/lib/theme';

import { TextLink } from './cover-credit';
import { Button, Field, T } from './ui';

// How many photos sit side by side.
const ACROSS = 3;

/**
 * Search free photos, for a cover or for an idea: a box to type in, and a grid of what was found.
 * Tapping a photo hands it to `onPick`, which shows it above the grid. Nothing is fetched until
 * the person searches. `start` is what the box holds to begin with, such as an idea's name.
 *
 * The photos are Unsplash's, so each one says who took it, and the line at the bottom leads to
 * Unsplash, as Unsplash asks.
 */
export function PhotoSearch({ chosen, onPick, disabled, start }: { chosen: string | null; onPick: (photo: FoundPhoto) => void; disabled?: boolean; start?: string }) {
  const { colors } = useTheme();
  const [words, setWords] = useState(() => (start ?? '').replace(/\s+/g, ' ').trim().slice(0, SEARCH_MAX));
  // What the last search found. Null until there has been one.
  const [found, setFound] = useState<FoundPhoto[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const search = async () => {
    const asked = cleanSearch(words);
    if (!asked || searching) return;
    setSearching(true);
    setNote(null);
    const { photos, trouble } = await searchPhotos(asked);
    setFound(photos);
    setNote(trouble ? SEARCH_SAYS[trouble] : photos.length === 0 ? NOTHING_FOUND : null);
    setSearching(false);
  };

  const rows: FoundPhoto[][] = [];
  for (let at = 0; found && at < found.length; at += ACROSS) rows.push(found.slice(at, at + ACROSS));

  return (
    <View style={{ gap: 10 }}>
      <Field
        label="Search free photos"
        value={words}
        onChangeText={setWords}
        placeholder="beach, mountains, pizza"
        maxLength={SEARCH_MAX}
        onSubmit={() => void search()}
        after={<Button label="Search" small onPress={() => void search()} busy={searching} disabled={!cleanSearch(words) || disabled} />}
      />
      {note ? (
        <T size={14} color={colors.textMuted}>
          {note}
        </T>
      ) : null}
      {rows.map((row) => (
        <View key={row[0].id} style={{ flexDirection: 'row', gap: 8 }}>
          {row.map((photo) => {
            const on = photo.url === chosen;
            return (
              <View key={photo.id} style={{ flex: 1, minWidth: 0, gap: 3 }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: on, disabled: Boolean(disabled) }}
                  accessibilityLabel={`Use this photo: ${photo.alt ?? 'no description'}, by ${photo.name}`}
                  disabled={disabled}
                  onPress={() => onPick(photo)}
                  style={({ pressed }) => ({
                    height: 74,
                    borderRadius: 16,
                    borderWidth: 3,
                    borderColor: on ? colors.button : 'transparent',
                    padding: 3,
                    backgroundColor: colors.card,
                    opacity: pressed ? 0.85 : 1,
                  })}>
                  {/* Kept for the session only: the results of a search are not stored on the device. */}
                  <Image source={{ uri: photo.thumb }} cachePolicy="memory" contentFit="cover" style={{ flex: 1, borderRadius: 11, backgroundColor: colors.line }} />
                </Pressable>
                <T size={11} weight="medium" color={colors.textMuted} lines={1}>
                  <TextLink to={photo.creditUrl} label={`${photo.name} on Unsplash`}>
                    {photo.name}
                  </TextLink>
                </T>
              </View>
            );
          })}
          {/* An unfinished row keeps its photos the same width as the rest. */}
          {Array.from({ length: ACROSS - row.length }, (_, gap) => (
            <View key={gap} style={{ flex: 1 }} />
          ))}
        </View>
      ))}
      <T size={12} weight="medium" color={colors.textMuted} style={{ lineHeight: 17 }}>
        Photos come from <TextLink to={UNSPLASH}>Unsplash</TextLink>. We save the photo&apos;s web address and who took it, not the photo.
      </T>
    </View>
  );
}
