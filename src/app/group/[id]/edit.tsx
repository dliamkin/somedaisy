import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Chip, ErrorNote, Field, Loading, Screen, T, TopBar } from '@/components/ui';
import { deleteIdea, fetchGroup, markChanged, updateIdea, type Idea, type List } from '@/lib/data';
import { LINK_MAX, NOTE_MAX, tidyLink } from '@/lib/links';
import { colors } from '@/lib/theme';

/** Change an idea's words or list, or remove it. Any member of the group can. */
export default function EditIdea() {
  const { id, idea: ideaId } = useLocalSearchParams<{ id: string; idea?: string }>();
  const [idea, setIdea] = useState<Idea | null | undefined>(undefined);
  const [lists, setLists] = useState<List[]>([]);
  const [listId, setListId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [link, setLink] = useState('');
  const [note, setNote] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchGroup(id)
      .then((g) => {
        const found = g?.ideas.find((i) => i.id === ideaId) ?? null;
        setIdea(found);
        setLists(g?.lists ?? []);
        if (found) {
          setListId(found.list_id);
          setTitle(found.title);
          setLink(found.link ?? '');
          setNote(found.note ?? '');
        }
      })
      .catch((e: Error) => {
        setError(e.message);
        setIdea(null);
      });
  }, [id, ideaId]);

  const back = () => (router.canGoBack() ? router.back() : router.replace(`/group/${id}` as never));

  const save = async () => {
    if (!id || !idea || !listId || !title.trim() || busy) return;
    const tidy = tidyLink(link);
    if (!tidy.ok) {
      setError('That link does not look like a web address. Check it, or leave it empty.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateIdea(idea.id, { title: title.trim(), link: tidy.link, note: note.trim() || null, listId });
      markChanged(id);
      back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the idea.');
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!id || !idea || busy) return;
    setBusy(true);
    setError(null);
    try {
      await deleteIdea(idea.id);
      markChanged(id);
      back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove the idea.');
      setBusy(false);
    }
  };

  if (idea === undefined) return <Loading />;
  if (!idea) {
    return (
      <Screen footer={<Button label="Back to the group" kind="soft" onPress={back} />}>
        <TopBar title="Edit idea" backTo={`/group/${id}`} />
        <ErrorNote message={error} />
        <T weight="medium" color={colors.muted}>
          That idea is no longer in the group.
        </T>
      </Screen>
    );
  }

  return (
    <Screen footer={<Button label="Save changes" onPress={save} disabled={!title.trim() || !listId} busy={busy && !confirming} />}>
      <TopBar title="Edit idea" backTo={`/group/${id}`} />
      <Field label="What's the idea?" value={title} onChangeText={setTitle} maxLength={120} />
      <View style={{ gap: 8 }}>
        <T size={16} weight="extra">
          Which list?
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {lists.map((l) => (
            <Chip key={l.id} label={l.name} selected={l.id === listId} onPress={() => setListId(l.id)} />
          ))}
        </View>
      </View>
      <Field label="Link (optional)" value={link} onChangeText={setLink} placeholder="Paste a trailer, a map pin, a menu..." kind="link" maxLength={LINK_MAX} />
      <Field label="Note (optional)" value={note} onChangeText={setNote} placeholder="Why it'd be fun" multiline maxLength={NOTE_MAX} />
      <ErrorNote message={error} />
      {confirming ? (
        <Card style={{ padding: 18, gap: 10 }}>
          <T size={16} weight="extra">
            Remove this idea?
          </T>
          <T size={14} weight="medium" color={colors.muted}>
            It disappears for everyone in the group, along with its reactions and comments.
          </T>
          <T size={14} weight="extra" color={colors.danger}>
            This cannot be undone.
          </T>
          <Button label="Remove the idea" kind="danger" small onPress={remove} busy={busy} />
          <Button label="Keep it" kind="ghost" small onPress={() => setConfirming(false)} disabled={busy} />
        </Card>
      ) : (
        <Button label="Remove this idea" kind="ghost" small onPress={() => setConfirming(true)} disabled={busy} />
      )}
    </Screen>
  );
}
