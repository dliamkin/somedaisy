import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Switch, View } from 'react-native';

import { AlreadyHere } from '@/components/already-here';
import { IdeaPicture, type PictureChoice } from '@/components/idea-picture';
import { IdeaTagsPicker } from '@/components/idea-tags-picker';
import { LinkPreviewNote, useLinkPreview } from '@/components/link-preview';
import { AddBoxes, ListChooser } from '@/components/list-chooser';
import { Button, Card, ErrorNote, Field, Loading, Screen, Segmented, T, TopBar } from '@/components/ui';
import { addIdea, fetchDone, fetchGroup, lateChange, markChanged, type IdeaTags, type List } from '@/lib/data';
import { LINK_MAX, looksLikeLink, NOTE_MAX, siteName, tidyLink } from '@/lib/links';
import { formShows, optionsOf } from '@/lib/list-options';
import { reportChosen } from '@/lib/photo-search';
import { removePicture, uploadPicture } from '@/lib/picture-files';
import { attachPreview, nameFromTitle, TITLE_MAX } from '@/lib/preview';
import type { Known } from '@/lib/similar';
import { useSession } from '@/lib/session';
import { useTheme } from '@/lib/theme';

// The two ways to add an idea. "type" is the form: a name, and whatever else the list asks for.
// "paste" starts from a link, and the page it goes to fills in the picture and the name.
type Mode = 'type' | 'paste';

const MODES: { key: Mode; label: string }[] = [
  { key: 'type', label: 'Type it' },
  { key: 'paste', label: 'Paste a link' },
];

export default function AddIdea() {
  const { colors, dark } = useTheme();
  const { id, list } = useLocalSearchParams<{ id: string; list?: string }>();
  const { userId } = useSession();
  const [lists, setLists] = useState<List[] | null>(null);
  // What the group already has, to say so when the same thing is typed again: the ideas still on
  // a list, and the things already done.
  const [known, setKnown] = useState<Known[]>([]);
  const [did, setDid] = useState<Known[]>([]);
  const [listId, setListId] = useState<string | null>(list ?? null);
  const [mode, setMode] = useState<Mode>('type');
  // The name and the link are shared by both ways in, so switching does not lose what was typed.
  const [title, setTitle] = useState('');
  const [link, setLink] = useState('');
  const [note, setNote] = useState('');
  const [tags, setTags] = useState<IdeaTags>({ takes: null, setting: null });
  const [thumbsUp, setThumbsUp] = useState(true);
  // Boxes the list leaves off the form that the person has asked for, for this idea only.
  const [added, setAdded] = useState({ link: false, note: false });
  // The picture chosen for this idea: one of the person's own, which is sent when the idea is
  // added, or a photo found by search, of which only the address and the credit are kept.
  const [own, setOwn] = useState<PictureChoice>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // What the "Paste" button could not do, said under the link box.
  const [pasteNote, setPasteNote] = useState<string | null>(null);
  // The link whose page was last asked for a name, and the name it gave. A name the person has
  // typed or changed themselves is never replaced.
  const [namedFor, setNamedFor] = useState<string | null>(null);
  const [offered, setOffered] = useState<string | null>(null);
  // The picture found for the link would not load.
  const [brokenPicture, setBrokenPicture] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchGroup(id)
      .then((g) => {
        setLists(g?.lists ?? []);
        setKnown(g?.ideas ?? []);
        setListId((cur) => cur ?? g?.lists[0]?.id ?? null);
      })
      .catch((e: Error) => setError(e.message));
    // A look back, and no more: the form works the same without it.
    fetchDone(id).then(setDid, () => {});
  }, [id]);

  const back = () => (router.canGoBack() ? router.back() : router.replace(`/group/${id}` as never));

  // Pasting a link only makes sense for a list that keeps links, so only those are offered there.
  // With no such list there is one way in, and the switch is not shown.
  const linkLists = (lists ?? []).filter((l) => optionsOf(l).links);
  const canPaste = linkLists.length > 0;
  const pasting = mode === 'paste' && canPaste;
  const offeredLists = pasting ? linkLists : (lists ?? []);
  const chosenId = offeredLists.some((l) => l.id === listId) ? listId : (offeredLists[0]?.id ?? null);

  // Each list says which boxes it wants. What was typed in a box that is then hidden is not sent.
  const shows = formShows((lists ?? []).find((l) => l.id === chosenId), added);
  const usesLink = pasting || shows.link;
  // The picture and the page's name, looked up while the link is being typed.
  const preview = useLinkPreview(usesLink ? link : '');
  const settled = preview.state === 'found' || preview.state === 'missing' ? preview : null;

  // When a pasted link's page has been read, its title becomes the idea's name, unless the person
  // has already written one of their own.
  if (pasting && settled && settled.link !== namedFor) {
    setNamedFor(settled.link);
    const name = settled.title ? nameFromTitle(settled.title) : null;
    if (name && (!title.trim() || title === offered)) {
      setTitle(name);
      setOffered(name);
    }
  }

  const tidy = tidyLink(usesLink ? link : '');
  const ready = Boolean(title.trim() && chosenId) && (!pasting || (tidy.ok && tidy.link !== null));

  const paste = async () => {
    try {
      const copied = (await Clipboard.getStringAsync()).trim();
      if (copied) {
        setLink(copied.slice(0, LINK_MAX));
        setPasteNote(null);
      } else {
        setPasteNote('There is nothing to paste yet. Copy a link first, or type it in the box.');
      }
    } catch {
      setPasteNote('Could not read what you copied. Paste it into the box yourself.');
    }
  };

  // A web address typed where the name goes: move it to the link box and start from there.
  const useAsLink = () => {
    setLink(title.trim());
    setTitle('');
    setOffered(null);
    setNamedFor(null);
    setMode('paste');
  };

  const submit = async () => {
    if (!id || !userId || !chosenId || !title.trim() || busy) return;
    if (!tidy.ok) {
      setError(pasting ? 'That link does not look like a web address. Check it and try again.' : 'That link does not look like a web address. Check it, or leave it empty.');
      return;
    }
    if (pasting && !tidy.link) return;
    setBusy(true);
    setError(null);
    // Where the picture was kept, so it can be taken away again if the idea is not added after all.
    let kept: string | null = null;
    try {
      if (own?.kind === 'new') kept = await uploadPicture(id, own.chosen);
      const ideaId = await addIdea({
        groupId: id,
        listId: chosenId,
        title: title.trim(),
        link: tidy.link ?? undefined,
        // The note and the tags belong to the typed form. They are not sent from the other one.
        note: !pasting && shows.note ? note.trim() : '',
        userId,
        // Only a thing to go and do can be counted in on.
        thumbsUp: shows.countMeIn && thumbsUp,
        tags: !pasting && shows.tags ? tags : undefined,
        picture: kept,
        photo: own?.kind === 'found' ? own.photo : null,
      });
      // Unsplash asks to be told when one of its photos is put to use.
      if (own?.kind === 'found' && own.found) reportChosen(own.found);
      // The link's picture is saved in the background and appears on the card shortly after. If
      // it was already found while typing, that one is used and it is not looked up again.
      const found = preview.state === 'found' && preview.link === tidy.link ? preview.picture : null;
      if (tidy.link) void attachPreview(ideaId, tidy.link, found).then((saved) => saved && lateChange(id));
      markChanged(id);
      back();
    } catch (e) {
      if (kept) void removePicture(kept);
      setError(e instanceof Error ? e.message : 'Could not add the idea.');
      setBusy(false);
    }
  };

  if (lists === null && !error) return <Loading />;

  const picture = preview.state === 'found' && preview.picture !== brokenPicture ? preview.picture : null;
  // Nothing at all came back for the link: no picture and no name.
  const unread = preview.state === 'missing' && !preview.title;

  const listPicker = <ListChooser all={lists ?? []} lists={offeredLists} chosenId={chosenId} onChoose={setListId} />;
  // Any idea can have a picture of its own, whatever its list asks for and whichever way it is added.
  const ownPicture = <IdeaPicture value={own} onChange={setOwn} name={title} />;
  // Said under the name while it is typed. It only tells: the idea can still be added.
  const alreadyHere = <AlreadyHere name={title} open={known} done={did} lists={lists ?? []} />;

  return (
    <Screen footer={<Button label="Add to list" onPress={submit} disabled={!ready} busy={busy} />}>
      <TopBar title="New idea" backTo={`/group/${id}`} />
      {/* Both ways in are always on show, so nobody has to find out there are two. */}
      {canPaste ? <Segmented label="How to add the idea" options={MODES} value={mode} onChange={setMode} /> : null}

      {pasting ? (
        <>
          <View style={{ gap: 6 }}>
            <Field
              label="Paste a link and we will fill in the rest"
              value={link}
              onChangeText={(v) => {
                setLink(v);
                setPasteNote(null);
              }}
              placeholder="A trailer, a map pin..."
              kind="link"
              maxLength={LINK_MAX}
              after={<Button label="Paste" kind="outline" small onPress={() => void paste()} style={{ height: 52, borderRadius: 26, paddingHorizontal: 16 }} />}
            />
            {pasteNote ? (
              <T size={14} color={colors.textMuted}>
                {pasteNote}
              </T>
            ) : null}
          </View>

          {preview.state === 'looking' ? (
            <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ActivityIndicator size="small" color={colors.button} />
              <T size={14} color={colors.textMuted}>
                Reading the page...
              </T>
            </View>
          ) : null}

          {settled ? (
            <Card>
              {unread ? (
                <T size={14} color={colors.textMuted}>
                  We couldn&apos;t read that page. You can still name the idea yourself.
                </T>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  {picture ? (
                    <Image
                      source={{ uri: picture }}
                      style={{ width: 96, height: 72, borderRadius: 12, backgroundColor: colors.background, borderWidth: dark ? 1 : 0, borderColor: colors.line }}
                      contentFit="cover"
                      accessibilityLabel="The picture from the page"
                      onError={() => setBrokenPicture(picture)}
                    />
                  ) : null}
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <T size={12} color={colors.textMuted}>
                      Found this
                    </T>
                    <T size={16} weight="extra" lines={3}>
                      {settled.title ?? siteName(settled.link)}
                    </T>
                    {settled.title ? (
                      <T size={12} color={colors.textMuted} lines={1}>
                        {siteName(settled.link)}
                      </T>
                    ) : null}
                  </View>
                </View>
              )}
              <Field label={unread ? 'Idea name' : 'Idea name (edit if you like)'} value={title} onChangeText={setTitle} maxLength={TITLE_MAX} />
            </Card>
          ) : null}
          {settled ? alreadyHere : null}

          {listPicker}
          {ownPicture}
        </>
      ) : (
        <>
          {/* The keyboard does not open by itself, so the whole form shows first. */}
          <Field label="What's the idea?" value={title} onChangeText={setTitle} placeholder="A beach walk, a movie, tacos..." maxLength={TITLE_MAX} />
          {alreadyHere}
          {canPaste && looksLikeLink(title) ? (
            <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
              <T size={14} weight="medium" color={colors.textMuted} style={{ flex: 1 }}>
                That looks like a link. We can read the page and fill in the name.
              </T>
              <Button label="Use the link" small onPress={useAsLink} />
            </Card>
          ) : null}
          {listPicker}
          {shows.link ? (
            <View style={{ gap: 8 }}>
              <Field label="Link (optional)" value={link} onChangeText={setLink} placeholder="A trailer, a map pin, a menu..." kind="link" maxLength={LINK_MAX} />
              {/* The idea's own picture is the one its card shows, so the link's is not promised then. */}
              {own ? null : <LinkPreviewNote preview={preview} label={title.trim()} />}
            </View>
          ) : null}
          {shows.note ? <Field label="Note (optional)" value={note} onChangeText={setNote} placeholder="Why it'd be fun" multiline maxLength={NOTE_MAX} /> : null}
          {shows.tags ? <IdeaTagsPicker value={tags} onChange={setTags} /> : null}
          {/* What the list leaves off can still be added to this one idea. */}
          <AddBoxes link={!shows.link} note={!shows.note} onLink={() => setAdded({ ...added, link: true })} onNote={() => setAdded({ ...added, note: true })} />
          {ownPicture}
        </>
      )}

      {/* For a list of things to go and do. A list that is only for keeping things has nothing to be in on. */}
      {shows.countMeIn ? (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <T size={16} weight="extra">
            Count me in
          </T>
          <T size={14} color={colors.textMuted}>
            {`Adds your "I'm in" right away`}
          </T>
        </View>
        <Switch accessibilityLabel="Add my I'm in" value={thumbsUp} onValueChange={setThumbsUp} trackColor={{ true: colors.button, false: colors.textDisabled }} thumbColor={colors.white} />
      </View>
      ) : null}
      <ErrorNote message={error} />
    </Screen>
  );
}
