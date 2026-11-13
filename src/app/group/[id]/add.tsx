import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';

import { Button, Chip, ErrorNote, Field, Loading, Screen, T, TopBar } from '@/components/ui';
import { addIdea, fetchGroup, markChanged, type List } from '@/lib/data';
import { useSession } from '@/lib/session';
import { colors } from '@/lib/theme';

export default function AddIdea() {
  const { id, list } = useLocalSearchParams<{ id: string; list?: string }>();
  const { userId } = useSession();
  const [lists, setLists] = useState<List[] | null>(null);
  const [listId, setListId] = useState<string | null>(list ?? null);
  const [title, setTitle] = useState('');
  const [link, setLink] = useState('');
  const [note, setNote] = useState('');
  const [thumbsUp, setThumbsUp] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchGroup(id)
      .then((g) => {
        setLists(g?.lists ?? []);
        setListId((cur) => cur ?? g?.lists[0]?.id ?? null);
      })
      .catch((e: Error) => setError(e.message));
  }, [id]);

  const back = () => (router.canGoBack() ? router.back() : router.replace(`/group/${id}` as never));

  const submit = async () => {
    if (!id || !userId || !listId || !title.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await addIdea({ groupId: id, listId, title: title.trim(), link: link.trim(), note: note.trim(), userId, thumbsUp });
      markChanged(id);
      back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add the idea.');
      setBusy(false);
    }
  };

  if (lists === null && !error) return <Loading />;

  return (
    <Screen footer={<Button label="Add to list" onPress={submit} disabled={!title.trim() || !listId} busy={busy} />}>
      <TopBar title="New idea" backTo={`/group/${id}`} />
      <Field label="What's the idea?" value={title} onChangeText={setTitle} placeholder="Sunrise beach walk, a movie, a new taco spot..." maxLength={120} autoFocus />
      <View style={{ gap: 8 }}>
        <T size={16} weight="extra">
          Which list?
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {(lists ?? []).map((l) => (
            <Chip key={l.id} label={l.name} selected={l.id === listId} onPress={() => setListId(l.id)} />
          ))}
        </View>
      </View>
      <Field label="Link (optional)" value={link} onChangeText={setLink} placeholder="Paste a trailer, a map pin, a menu..." />
      <Field label="Note (optional)" value={note} onChangeText={setNote} placeholder="Why it'd be fun" multiline />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <T size={16} weight="extra">
            Count me in
          </T>
          <T size={14} color={colors.muted}>
            Adds your thumbs up right away
          </T>
        </View>
        <Switch accessibilityLabel="Add my thumbs up" value={thumbsUp} onValueChange={setThumbsUp} trackColor={{ true: colors.grape, false: '#8E80A3' }} thumbColor={colors.white} />
      </View>
      <ErrorNote message={error} />
    </Screen>
  );
}
