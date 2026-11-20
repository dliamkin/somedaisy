import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { IdeaPicture, type PictureChoice } from '@/components/idea-picture';
import { IdeaTagsPicker } from '@/components/idea-tags-picker';
import { LinkPreviewNote, useLinkPreview } from '@/components/link-preview';
import { AddBoxes, ListChooser } from '@/components/list-chooser';
import { Button, Card, ErrorNote, Field, Loading, Screen, T, TopBar } from '@/components/ui';
import { deleteIdea, fetchGroup, lateChange, markChanged, updateIdea, type Idea, type IdeaTags, type List } from '@/lib/data';
import { LINK_MAX, NOTE_MAX, tidyLink } from '@/lib/links';
import { formShows } from '@/lib/list-options';
import { removePicture, uploadPicture } from '@/lib/picture-files';
import { ownPicture } from '@/lib/pictures';
import { attachPreview } from '@/lib/preview';
import { useTheme } from '@/lib/theme';

/** Change an idea's words or list, or remove it. Any member of the group can. */
export default function EditIdea() {
  const { colors } = useTheme();
  const { id, idea: ideaId } = useLocalSearchParams<{ id: string; idea?: string }>();
  const [idea, setIdea] = useState<Idea | null | undefined>(undefined);
  const [lists, setLists] = useState<List[]>([]);
  const [listId, setListId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [link, setLink] = useState('');
  const [note, setNote] = useState('');
  const [tags, setTags] = useState<IdeaTags>({ takes: null, setting: null });
  // Boxes the list leaves off the form that the person has asked for, for this idea only.
  const [added, setAdded] = useState({ link: false, note: false });
  // The idea's own picture: the one it has, a new one chosen here, or none.
  const [picture, setPicture] = useState<PictureChoice>(null);
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
          setTags({ takes: found.takes ?? null, setting: found.setting ?? null });
          const has = ownPicture(found.picture);
          setPicture(has ? { kind: 'kept', path: has } : null);
        }
      })
      .catch((e: Error) => {
        setError(e.message);
        setIdea(null);
      });
  }, [id, ideaId]);

  const back = () => (router.canGoBack() ? router.back() : router.replace(`/group/${id}` as never));

  // Each list says which boxes it wants. A box with something already in it always shows, so a
  // link or note the idea came with can be changed or taken off.
  const shows = formShows(lists.find((l) => l.id === listId), { link: added.link || Boolean(idea?.link) || link.trim() !== '', note: added.note || Boolean(idea?.note) || note.trim() !== '' });
  // The picture the idea will have. The one it has now needs no looking up.
  const preview = useLinkPreview(link, idea?.link ? { link: idea.link, picture: idea.image_url ?? null } : null);

  const save = async () => {
    if (!id || !idea || !listId || !title.trim() || busy) return;
    const tidy = tidyLink(link);
    if (!tidy.ok) {
      setError('That link does not look like a web address. Check it, or leave it empty.');
      return;
    }
    setBusy(true);
    setError(null);
    // The picture is only sent when it was changed: a new one is kept first, and one taken off is
    // saved as none. Either way the file it had before is removed once the change is saved.
    const had = ownPicture(idea.picture);
    let fresh: string | null = null;
    try {
      if (picture?.kind === 'new') fresh = await uploadPicture(id, picture.chosen);
      const repictured = fresh ? fresh : !picture && had ? null : undefined;
      // The tags are only sent when they were changed, so saving anything else leaves them alone.
      const retagged = tags.takes !== (idea.takes ?? null) || tags.setting !== (idea.setting ?? null);
      await updateIdea(idea.id, { title: title.trim(), link: tidy.link, note: note.trim() || null, listId, tags: retagged ? tags : undefined, picture: repictured });
      if (repictured !== undefined && had) void removePicture(had);
      // The link's preview picture is looked up afresh in the background on every save, so a
      // picture that has stopped loading is replaced, and a link that had none gets another try.
      // A picture found while typing a new link is used as it is.
      const found = preview.state === 'found' && preview.link === tidy.link && tidy.link !== idea.link ? preview.picture : null;
      if (tidy.link) void attachPreview(idea.id, tidy.link, found).then((saved) => saved && lateChange(id));
      markChanged(id);
      back();
    } catch (e) {
      if (fresh) void removePicture(fresh);
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
      // Its picture goes with it.
      void removePicture(idea.picture);
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
        <T weight="medium" color={colors.textMuted}>
          That idea is no longer in the group.
        </T>
      </Screen>
    );
  }

  return (
    <Screen footer={<Button label="Save changes" onPress={save} disabled={!title.trim() || !listId} busy={busy && !confirming} />}>
      <TopBar title="Edit idea" backTo={`/group/${id}`} />
      <Field label="What's the idea?" value={title} onChangeText={setTitle} maxLength={120} />
      <ListChooser all={lists} lists={lists} chosenId={listId} onChoose={setListId} />
      {shows.link ? (
        <View style={{ gap: 8 }}>
          <Field label="Link (optional)" value={link} onChangeText={setLink} placeholder="A trailer, a map pin, a menu..." kind="link" maxLength={LINK_MAX} />
          {/* The idea's own picture is the one its card shows, so the link's is not promised then. */}
          {picture ? null : <LinkPreviewNote preview={preview} label={title.trim()} />}
        </View>
      ) : null}
      {shows.note ? <Field label="Note (optional)" value={note} onChangeText={setNote} placeholder="Why it'd be fun" multiline maxLength={NOTE_MAX} /> : null}
      {shows.tags ? <IdeaTagsPicker value={tags} onChange={setTags} /> : null}
      <AddBoxes link={!shows.link} note={!shows.note} onLink={() => setAdded({ ...added, link: true })} onNote={() => setAdded({ ...added, note: true })} />
      <IdeaPicture value={picture} onChange={setPicture} name={title} />
      <ErrorNote message={error} />
      {confirming ? (
        <Card style={{ padding: 18, gap: 10 }}>
          <T size={16} weight="extra">
            Remove this idea?
          </T>
          <T size={14} weight="medium" color={colors.textMuted}>
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
