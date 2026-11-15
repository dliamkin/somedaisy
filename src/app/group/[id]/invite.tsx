import * as Clipboard from 'expo-clipboard';
import * as ExpoLinking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Share, View } from 'react-native';

import { Avatar, Button, Card, ErrorNote, Loading, Screen, T, TopBar } from '@/components/ui';
import { fetchGroup, type GroupData } from '@/lib/data';
import { useSession } from '@/lib/session';
import { colors } from '@/lib/theme';

export default function Invite() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useSession();
  const [group, setGroup] = useState<GroupData | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchGroup(id)
      .then(setGroup)
      .catch((e: Error) => setError(e.message));
  }, [id]);

  if (group === undefined && !error) return <Loading />;

  const link = group ? ExpoLinking.createURL(`/join/${group.invite_code}`) : '';

  const copy = async () => {
    await Clipboard.setStringAsync(link);
    setCopied(true);
  };
  const share = async () => {
    try {
      await Share.share({ message: `Join "${group?.name}" on SomeDaisy: ${link}` });
    } catch {
      await copy();
    }
  };

  return (
    <Screen footer={<Button label="Go to the group" onPress={() => router.replace(`/group/${id}` as never)} />}>
      <TopBar title={group?.name ?? 'Invite'} subtitle="Invite people" backTo={`/group/${id}`} />
      <ErrorNote message={error} />
      {group ? (
        <>
          <Card style={{ padding: 18, gap: 10 }}>
            <T size={16} weight="extra">
              Invite with a link
            </T>
            <T size={14} color={colors.muted}>
              Anyone with the link can join. No account needed.
            </T>
            <View style={{ borderRadius: 16, backgroundColor: colors.ground, padding: 14 }}>
              <T size={14} color={colors.muted} lines={2}>
                {link}
              </T>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button label={copied ? 'Copied' : 'Copy link'} small onPress={copy} style={{ flex: 1 }} />
              {Platform.OS !== 'web' ? <Button label="Share" kind="outline" small onPress={share} style={{ flex: 1 }} /> : null}
            </View>
          </Card>
          <Card style={{ padding: 18, gap: 10 }}>
            <T size={16} weight="extra">
              In this group
            </T>
            {group.members.map((m) => (
              <View key={m.user_id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 }}>
                <Avatar name={m.name} color={m.color} photo={m.photo} size={40} />
                <T weight="extra">{m.user_id === userId ? `${m.name} (you)` : m.name}</T>
              </View>
            ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
