import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { AvatarStack } from '@/components/avatar-stack';
import { Cover } from '@/components/cover';
import { CoverColors } from '@/components/cover-colors';
import { CoverCredit } from '@/components/cover-credit';
import { PhotoSearch } from '@/components/photo-search';
import { Button, ErrorNote, Loading, Screen, Segmented, T, TopBar } from '@/components/ui';
import { useCoverPhotos } from '@/lib/cover-addresses';
import { nextVersion, PHOTO_NOT_SAVED, uploadedPhoto } from '@/lib/cover-photos';
import { coverOf, coverPath, sameCover, type Cover as CoverData } from '@/lib/covers';
import { fetchGroup, markChanged, saveCover, type GroupData } from '@/lib/data';
import { reportChosen, searchedCover, searchedPhoto, type FoundPhoto } from '@/lib/photo-search';
import { chooseCoverPhoto, removeCover, uploadCover, type ChosenPicture } from '@/lib/picture-files';
import { levelFor, TITLES } from '@/lib/points';
import { useTheme } from '@/lib/theme';

type Tab = 'colors' | 'photo';

const TABS: { key: Tab; label: string }[] = [
  { key: 'colors', label: 'Colors' },
  { key: 'photo', label: 'Photo' },
];

/**
 * The cover picker: choose how a group's cover looks, in colours or with a photo. The cover at
 * the top is a preview, with the group's real name and daisy, and changes with every tap. Nothing
 * changes for anyone else until "Save cover" is tapped. Any member can change the cover.
 *
 * A photo of the group's own is chosen and made small here, and only sent when the cover is
 * saved. A group keeps one photo: a new one takes the place of the old, and going back to colours
 * or to a photo found by search removes it. A photo found by search is never copied: the cover
 * keeps its web address and who took it.
 */
export default function GroupCover() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [group, setGroup] = useState<GroupData | null | undefined>(undefined);
  // The cover as chosen so far. Null until something is chosen, which leaves the cover the group has.
  const [chosen, setChosen] = useState<CoverData | null>(null);
  // Which half of the picker is on show. Null until one is tapped, which leaves the half the group's cover belongs to.
  const [tab, setTab] = useState<Tab | null>(null);
  // A photo picked here and not yet sent, with the version it will be saved under. It is what the
  // preview shows while the chosen cover is that photo.
  const [fresh, setFresh] = useState<{ picture: ChosenPicture; version: number } | null>(null);
  // The photo last tapped in the search results, kept so the photo service can be told if it is saved.
  const [tapped, setTapped] = useState<FoundPhoto | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Where the photo the group already has loads from.
  const photoOf = useCoverPhotos(group ? [coverOf(group)] : []);

  useEffect(() => {
    if (!id) return;
    fetchGroup(id).then(setGroup, (e: Error) => {
      setError(e.message);
      setGroup(null);
    });
  }, [id]);

  const back = () => (router.canGoBack() ? router.back() : router.replace(`/group/${id}/settings` as never));

  if (group === undefined) return <Loading />;
  if (!group || !id) {
    return (
      <Screen footer={<Button label="Back to groups" kind="soft" onPress={() => router.replace('/')} />}>
        <TopBar title="Group cover" backTo="/" />
        <ErrorNote message={error} />
        <T weight="medium" color={colors.textMuted}>
          That group is not available.
        </T>
      </Screen>
    );
  }

  const saved = coverOf(group);
  const cover = chosen ?? saved;
  const onShow = tab ?? (saved.kind === 'photo' ? 'photo' : 'colors');
  const people = group.members.length;
  // A photo picked here is shown straight from the device. The one already saved comes from storage.
  const pending = fresh && uploadedPhoto(cover)?.version === fresh.version ? fresh.picture : null;
  const photo = pending ? { uri: pending.uri } : photoOf(cover);

  const pick = async () => {
    if (choosing || busy) return;
    setChoosing(true);
    setError(null);
    try {
      const picked = await chooseCoverPhoto();
      if (picked) {
        const version = nextVersion();
        setFresh({ picture: picked, version });
        // The colour under the photo stays whatever the cover had: it shows while the photo loads.
        setChosen({ kind: 'photo', background: cover.background, pattern: cover.pattern, photo: { source: 'upload', path: coverPath(id), version } });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open that photo. Try another one.');
    } finally {
      setChoosing(false);
    }
  };

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      // The photo goes first: the cover is only saved once there is a photo for it to point at.
      if (pending) await uploadCover(id, pending);
      await saveCover(id, cover);
      // Back to colours, or on to a photo found by search: the photo the group had uploaded is no
      // longer shown anywhere, so it is removed.
      if (uploadedPhoto(saved) && !uploadedPhoto(cover)) await removeCover(id);
      // The photo service asks to be told when one of its photos is put to use.
      if (tapped && searchedPhoto(cover)?.url === tapped.url) reportChosen(tapped);
      // The group's page tells the other members when it next comes into view.
      markChanged(id);
      back();
    } catch (e) {
      setError(e instanceof Error ? e.message : pending ? PHOTO_NOT_SAVED : 'Could not save the cover. Try again.');
      setBusy(false);
    }
  };

  return (
    <Screen footer={<Button label="Save cover" onPress={() => void save()} disabled={sameCover(cover, saved) || choosing} busy={busy} />}>
      <TopBar title="Group cover" backTo={`/group/${id}/settings`} />
      <Cover
        cover={cover}
        place="picker"
        name={group.name}
        // One petal for each rank the group has reached. Without points, the whole daisy.
        earned={group.points !== null ? levelFor(group.points).index + 1 : TITLES.length}
        photo={photo}
        style={{ borderRadius: 26 }}>
        {(ink) => (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <AvatarStack members={group.members} size={28} ring={colors.white} ink={ink} />
            <T size={14} weight="extra" color={ink}>
              {people === 1 ? "It's just you" : `${people} people`}
            </T>
          </View>
        )}
      </Cover>
      <CoverCredit cover={cover} />
      <Segmented label="What the cover is made of" options={TABS} value={onShow} onChange={setTab} />
      {onShow === 'colors' ? (
        <>
          {cover.kind === 'photo' ? (
            <T size={14} color={colors.textMuted}>
              Pick a colour to use it in place of the photo. The photo is removed when you save.
            </T>
          ) : null}
          <CoverColors value={cover} onChange={setChosen} />
        </>
      ) : (
        <View style={{ gap: 12 }}>
          <View style={{ gap: 10 }}>
            <Button label={uploadedPhoto(cover) ? 'Upload a different photo' : 'Upload a photo'} kind="outline" onPress={() => void pick()} busy={choosing} disabled={busy} />
            <T size={13} color={colors.textMuted} style={{ lineHeight: 18 }}>
              One photo per group. We shrink it before saving, and a new one replaces the old one.
            </T>
            <T size={13} color={colors.textMuted} style={{ lineHeight: 18 }}>
              Only people in the group can see it.
            </T>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1, height: 2, backgroundColor: colors.line }} />
            <T size={13} color={colors.textMuted}>
              or
            </T>
            <View style={{ flex: 1, height: 2, backgroundColor: colors.line }} />
          </View>
          <PhotoSearch
            chosen={searchedPhoto(cover)?.url ?? null}
            disabled={busy || choosing}
            onPick={(photo) => {
              setError(null);
              setTapped(photo);
              setChosen(searchedCover(cover, photo));
            }}
          />
        </View>
      )}
      <ErrorNote message={error} />
    </Screen>
  );
}
