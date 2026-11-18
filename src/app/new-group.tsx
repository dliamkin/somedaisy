import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Chip, ErrorNote, Field, Screen, T, TopBar } from '@/components/ui';
import { createGroup } from '@/lib/data';
import { colors, covers, STARTER_LISTS } from '@/lib/theme';

export default function NewGroup() {
  const [name, setName] = useState('');
  const [cover, setCover] = useState('sky');
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
      const id = await createGroup(name.trim(), cover, ordered);
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
      <Field label="Group name" value={name} onChangeText={setName} placeholder="Roommates, book club, us two..." maxLength={60} autoFocus />
      <View style={{ gap: 8 }}>
        <T size={16} weight="extra">
          Pick a cover
        </T>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {Object.entries(covers).map(([key, value]) => (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={`${key} cover`}
              accessibilityState={{ selected: key === cover }}
              onPress={() => setCover(key)}
              style={{ flex: 1, height: 72, borderRadius: 20, backgroundColor: value, borderWidth: 3, borderColor: key === cover ? colors.grape : 'transparent' }}
            />
          ))}
        </View>
      </View>
      <View style={{ gap: 8 }}>
        <T size={16} weight="extra">
          Start with some lists
        </T>
        <T size={14} color={colors.muted}>
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
