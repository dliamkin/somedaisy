import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';

import { IdeaTagsPicker } from '@/components/idea-tags-picker';
import { LinkPreviewNote, useLinkPreview } from '@/components/link-preview';
import { Button, Chip, ErrorNote, Field, Loading, Screen, T, TopBar } from '@/components/ui';
import { addIdea, fetchGroup, lateChange, markChanged, type IdeaTags, type List } from '@/lib/data';
import { LINK_MAX, NOTE_MAX, tidyLink } from '@/lib/links';
import { formShows } from '@/lib/list-options';
import { attachPreview } from '@/lib/preview';
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
  const [tags, setTags] = useState<IdeaTags>({ takes: null, setting: null });
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

  // Each list says which boxes it wants. What was typed in a box that is then hidden is not sent.
  const shows = formShows((lists ?? []).find((l) => l.id === listId), { link: false, note: false });
  // The picture the idea will get, looked up while the link is being typed.
  const preview = useLinkPreview(shows.link ? link : '');

  const submit = async () => {
    if (!id || !userId || !listId || !title.trim() || busy) return;
    const tidy = tidyLink(shows.link ? link : '');
    if (!tidy.ok) {
      setError('That link does not look like a web address. Check it, or leave it empty.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const ideaId = await addIdea({
        groupId: id,
        listId,
        title: title.trim(),
        link: tidy.link ?? undefined,
        note: shows.note ? note.trim() : '',
        userId,
        thumbsUp,
        tags: shows.tags ? tags : undefined,
      });
      // The link's picture is saved in the background and appears on the card shortly after. If
      // it was already found while typing, that one is used and it is not looked up again.
      const found = preview.state === 'found' && preview.link === tidy.link ? preview.picture : null;
      if (tidy.link) void attachPreview(ideaId, tidy.link, found).then((saved) => saved && lateChange(id));
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
      {shows.link ? (
        <View style={{ gap: 8 }}>
          <Field label="Link (optional)" value={link} onChangeText={setLink} placeholder="Paste a trailer, a map pin, a menu..." kind="link" maxLength={LINK_MAX} />
          <LinkPreviewNote preview={preview} label={title.trim()} />
        </View>
      ) : null}
      {shows.note ? <Field label="Note (optional)" value={note} onChangeText={setNote} placeholder="Why it'd be fun" multiline maxLength={NOTE_MAX} /> : null}
      {shows.tags ? <IdeaTagsPicker value={tags} onChange={setTags} /> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <T size={16} weight="extra">
            Count me in
          </T>
          <T size={14} color={colors.muted}>
            {`Adds your "I'm down" right away`}
          </T>
        </View>
        <Switch accessibilityLabel="Add my I'm down" value={thumbsUp} onValueChange={setThumbsUp} trackColor={{ true: colors.grape, false: '#8E80A3' }} thumbColor={colors.white} />
      </View>
      <ErrorNote message={error} />
    </Screen>
  );
}
