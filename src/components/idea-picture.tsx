import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { photoForIdea, type IdeaPhoto } from '@/lib/idea-photos';
import { openLink } from '@/lib/links';
import type { FoundPhoto } from '@/lib/photo-search';
import { choosePicture, type ChosenPicture } from '@/lib/picture-files';
import { pictureAddress, pictureSearch } from '@/lib/pictures';
import { useTheme } from '@/lib/theme';

import { ActionIcon } from './action-icons';
import { PhotoCredit } from './cover-credit';
import { PhotoSearch } from './photo-search';
import { Button, Chip, T } from './ui';

/**
 * The picture a form holds for an idea:
 *   * `kept`: its own picture, already kept with the idea.
 *   * `new`: one of the person's own, just chosen and not yet sent.
 *   * `found`: a photo found by search. Only its address and credit are kept. `found` is the
 *     search result it came from, there when it was picked on this form, so Unsplash can be told.
 *   * null: none.
 */
export type PictureChoice =
  | { kind: 'kept'; path: string }
  | { kind: 'new'; chosen: ChosenPicture }
  | { kind: 'found'; photo: IdeaPhoto; found?: FoundPhoto }
  | null;

/**
 * On the forms for an idea: its picture, and the two ways to get one. "Add a picture" opens the
 * phone's photos. "Search free photos" opens a search under the buttons, starting from the idea's
 * name, and tapping a result makes it the picture. With a picture it is shown, with the same two
 * ways to change it and a way to take it off.
 *
 * A found photo has who took it under it, as Unsplash asks wherever one of its photos shows.
 */
export function IdeaPicture({ value, onChange, name }: { value: PictureChoice; onChange: (next: PictureChoice) => void; name: string }) {
  const { colors, dark } = useTheme();
  const [busy, setBusy] = useState(false);
  // Whether the search for free photos is open under the buttons.
  const [searching, setSearching] = useState(false);
  // What to say under the buttons: how looking on the web works, or what went wrong.
  const [note, setNote] = useState<{ text: string; bad?: boolean } | null>(null);

  const choose = async () => {
    if (busy) return;
    setBusy(true);
    setNote(null);
    try {
      const chosen = await choosePicture();
      if (chosen) {
        onChange({ kind: 'new', chosen });
        setSearching(false);
      }
    } catch (e) {
      setNote({ text: e instanceof Error && e.message ? e.message : 'Could not open that picture. Try another one.', bad: true });
    } finally {
      setBusy(false);
    }
  };

  // For what a search of free photos does not have, such as a film's poster: a picture search for
  // the idea's name in the person's own browser, to save one from and add here.
  const lookOnTheWeb = () => {
    const where = pictureSearch(name);
    if (!where) {
      setNote({ text: 'Name the idea first, so there is something to search for.' });
      return;
    }
    openLink(where);
    setNote({ text: 'Save a picture you like to your phone or computer. Then come back and add it here.' });
  };

  const shown = value?.kind === 'new' ? value.chosen.uri : value?.kind === 'found' ? value.photo.url : value ? pictureAddress(value.path) : null;

  const said = note ? (
    <T size={14} color={note.bad ? colors.danger : colors.textMuted}>
      {note.text}
    </T>
  ) : null;

  const search = searching ? (
    <View style={{ gap: 8 }}>
      <PhotoSearch start={name} chosen={value?.kind === 'found' ? value.photo.url : null} onPick={(found) => onChange({ kind: 'found', photo: photoForIdea(found), found })} disabled={busy} />
      <Pressable accessibilityRole="link" accessibilityLabel="Look for a picture on the web instead" onPress={lookOnTheWeb} hitSlop={8} style={{ alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' }}>
        <T size={13} weight="extra" color={colors.link} style={{ textDecorationLine: 'underline' }}>
          Not there? Look on the web
        </T>
      </Pressable>
    </View>
  ) : null;

  if (value && shown) {
    return (
      <View style={{ gap: 8 }}>
        <T size={14} weight="extra">
          Picture
        </T>
        <Image
          source={{ uri: shown }}
          style={{ width: '100%', aspectRatio: 1.91, borderRadius: 16, backgroundColor: colors.card, borderWidth: dark ? 1 : 0, borderColor: colors.line }}
          contentFit="cover"
          accessibilityLabel={`The picture for ${name.trim() || 'this idea'}`}
        />
        {value.kind === 'found' ? <PhotoCredit photo={value.photo} size={12} /> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <Button label="Change" kind="outline" small busy={busy} onPress={() => void choose()} />
          <Button label={searching ? 'Close search' : 'Search photos'} kind="outline" small disabled={busy} onPress={() => setSearching(!searching)} />
          <Button
            label="Remove"
            kind="ghost"
            small
            disabled={busy}
            onPress={() => {
              onChange(null);
              setSearching(false);
            }}
          />
        </View>
        {said}
        {search}
      </View>
    );
  }

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <Chip label="+ Add a picture" dashed onPress={() => void choose()} />
        <Chip
          label={searching ? 'Close search' : 'Search free photos'}
          dashed
          before={<ActionIcon name="search" size={18} color={colors.text} />}
          onPress={() => setSearching(!searching)}
        />
        {busy ? <ActivityIndicator size="small" color={colors.button} /> : null}
      </View>
      {said}
      {search}
    </View>
  );
}
