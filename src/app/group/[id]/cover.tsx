import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { AvatarStack } from '@/components/avatar-stack';
import { Cover } from '@/components/cover';
import { CoverColors } from '@/components/cover-colors';
import { Button, ErrorNote, Loading, Screen, T, TopBar } from '@/components/ui';
import { coverOf, sameCover, type Cover as CoverData } from '@/lib/covers';
import { fetchGroup, markChanged, saveCover, type GroupData } from '@/lib/data';
import { levelFor, TITLES } from '@/lib/points';
import { useTheme } from '@/lib/theme';

/**
 * The cover picker: choose how a group's cover looks. The cover at the top is a preview, with the
 * group's real name and daisy, and changes with every tap. Nothing changes for anyone else until
 * "Save cover" is tapped. Any member can change the cover.
 */
export default function GroupCover() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [group, setGroup] = useState<GroupData | null | undefined>(undefined);
  // The cover as chosen so far. Null until the group has loaded, and then the cover it has.
  const [chosen, setChosen] = useState<CoverData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  const people = group.members.length;

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await saveCover(id, cover);
      // The group's page tells the other members when it next comes into view.
      markChanged(id);
      back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the cover. Try again.');
      setBusy(false);
    }
  };

  return (
    <Screen footer={<Button label="Save cover" onPress={() => void save()} disabled={sameCover(cover, saved)} busy={busy} />}>
      <TopBar title="Group cover" backTo={`/group/${id}/settings`} />
      <Cover
        cover={cover}
        place="picker"
        name={group.name}
        // One petal for each rank the group has reached. Without points, the whole daisy.
        earned={group.points !== null ? levelFor(group.points).index + 1 : TITLES.length}
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
      <CoverColors value={cover} onChange={setChosen} />
      <ErrorNote message={error} />
    </Screen>
  );
}
