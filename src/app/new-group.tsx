import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Cover } from '@/components/cover';
import { CoverColors } from '@/components/cover-colors';
import { Button, Chip, ErrorNote, Field, Screen, T, TopBar } from '@/components/ui';
import { CLASSIC, coverChange, DEFAULT_CLASSIC, NAME_MAX, type Cover as CoverData } from '@/lib/covers';
import { createGroup, saveCover } from '@/lib/data';
import { STARTER_LISTS, useTheme } from '@/lib/theme';

export default function NewGroup() {
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [cover, setCover] = useState<CoverData>({ kind: 'classic', background: CLASSIC[DEFAULT_CLASSIC], pattern: true });
  const [lists, setLists] = useState<string[]>(['Movies', 'Places', 'Food']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (l: string) => setLists((cur) => (cur.includes(l) ? cur.filter((x) => x !== l) : [...cur, l]));

  const submit = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const ordered = STARTER_LISTS.filter((l) => lists.includes(l));
      // A group is made with a classic colour, as it always was. Anything newer is saved onto it
      // straight after. If that cannot be saved, the group is still made, with its classic colour.
      const change = coverChange(cover);
      const id = await createGroup(name.trim(), change.cover ?? DEFAULT_CLASSIC, ordered);
      if (change.cover_style) await saveCover(id, cover).catch(() => {});
      // Straight on to inviting people: a group with one person in it has nobody to plan with.
      router.replace(`/group/${id}/invite?new=1` as never);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the group.');
      setBusy(false);
    }
  };

  return (
    <Screen footer={<Button label="Create group" onPress={submit} disabled={!name.trim()} busy={busy} />}>
      <TopBar title="New group" subtitle="Step 1 of 2" backTo="/" />
      <Field label="Group name" value={name} onChangeText={setName} placeholder="Roommates, book club, us two..." maxLength={NAME_MAX} autoFocus />
      <View style={{ gap: 8 }}>
        <T size={16} weight="extra">
          Pick a cover
        </T>
        {/* The cover as it will look, with the name as typed so far. A new group has one petal. */}
        <Cover cover={cover} place="picker" name={name.trim() || 'Your group'} earned={1} style={{ borderRadius: 26 }} />
        <T size={14} color={colors.textMuted}>
          You can change it later in the group&apos;s settings, and pick colours of your own there.
        </T>
      </View>
      <CoverColors value={cover} onChange={setCover} own={false} />
      <View style={{ gap: 8 }}>
        <T size={16} weight="extra">
          Start with some lists
        </T>
        <T size={14} color={colors.textMuted}>
          You can add more inside the group.
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {STARTER_LISTS.map((l) => (
            <Chip key={l} label={l} selected={lists.includes(l)} onPress={() => toggle(l)} />
          ))}
        </View>
      </View>
      <ErrorNote message={error} />
    </Screen>
  );
}
