import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { openLink } from '@/lib/links';
import { choosePicture, type ChosenPicture } from '@/lib/picture-files';
import { pictureAddress, pictureSearch } from '@/lib/pictures';
import { useTheme } from '@/lib/theme';

import { ActionIcon } from './action-icons';
import { Button, Chip, T } from './ui';

/**
 * The picture a form holds for an idea: one already kept with the idea, one just chosen and not
 * yet sent, or none.
 */
export type PictureChoice = { kind: 'kept'; path: string } | { kind: 'new'; chosen: ChosenPicture } | null;

/**
 * On the forms for an idea: its own picture, and the ways to get one. With no picture there are
 * two dashed chips, like the ones that add a link or a note: one opens the phone's photos, the
 * other opens a picture search for the idea's name in the browser, to save one from. With a
 * picture it is shown, with a way to change it and a way to take it off.
 */
export function IdeaPicture({ value, onChange, name }: { value: PictureChoice; onChange: (next: PictureChoice) => void; name: string }) {
  const { colors, dark } = useTheme();
  const [busy, setBusy] = useState(false);
  // What to say under the chips: how the search works, or what went wrong.
  const [note, setNote] = useState<{ text: string; bad?: boolean } | null>(null);

  const choose = async () => {
    if (busy) return;
    setBusy(true);
    setNote(null);
    try {
      const chosen = await choosePicture();
      if (chosen) onChange({ kind: 'new', chosen });
    } catch (e) {
      setNote({ text: e instanceof Error && e.message ? e.message : 'Could not open that picture. Try another one.', bad: true });
    } finally {
      setBusy(false);
    }
  };

  const search = () => {
    const where = pictureSearch(name);
    if (!where) {
      setNote({ text: 'Name the idea first, so there is something to search for.' });
      return;
    }
    openLink(where);
    setNote({ text: 'Save a picture you like to your phone or computer. Then come back and add it here.' });
  };

  const shown = value?.kind === 'new' ? value.chosen.uri : value ? pictureAddress(value.path) : null;

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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Button label="Change" kind="outline" small busy={busy} onPress={() => void choose()} />
          <Button label="Remove" kind="ghost" small disabled={busy} onPress={() => onChange(null)} />
        </View>
        {note ? (
          <T size={14} color={note.bad ? colors.danger : colors.textMuted}>
            {note.text}
          </T>
        ) : null}
      </View>
    );
  }

  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <Chip label="+ Add a picture" dashed onPress={() => void choose()} />
        <Chip label="Find one on the web" dashed before={<ActionIcon name="search" size={18} color={colors.text} />} onPress={search} />
        {busy ? <ActivityIndicator size="small" color={colors.button} /> : null}
      </View>
      {note ? (
        <T size={14} color={note.bad ? colors.danger : colors.textMuted}>
          {note.text}
        </T>
      ) : null}
    </View>
  );
}
