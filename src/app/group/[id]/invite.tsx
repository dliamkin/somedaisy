import * as Clipboard from 'expo-clipboard';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, Share, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Avatar, Button, Card, ErrorNote, Loading, Screen, T, TopBar } from '@/components/ui';
import { fetchGroup, type GroupData } from '@/lib/data';
import { inviteLink, inviteMessage } from '@/lib/links';
import { useSession } from '@/lib/session';
import { useTheme } from '@/lib/theme';

// Whether this device can hand the link to its own share sheet. Every phone can. A browser can
// when it has the Web Share feature, which phone browsers do and most desktop ones do not.
const CAN_SHARE = Platform.OS !== 'web' || typeof (globalThis as { navigator?: { share?: unknown } }).navigator?.share === 'function';

/**
 * Invite people to a group. Reached from the group's own page, and straight after making a
 * group (`?new=1`), where it is the second step: a group is for sharing, so the first thing to
 * do with a new one is send its link to someone.
 */
export default function Invite() {
  const { colors } = useTheme();
  const { id, new: fresh } = useLocalSearchParams<{ id: string; new?: string }>();
  const isNew = fresh === '1';
  const { userId } = useSession();
  const [group, setGroup] = useState<GroupData | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  // What happened to the link on this visit: handed to the share sheet, or copied.
  const [sent, setSent] = useState<'shared' | 'copied' | null>(null);

  // Keep looking while the screen is open, so someone who taps the link shows up under
  // "In this group" without anything being refreshed.
  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      let alive = true;
      const load = () =>
        fetchGroup(id).then(
          (g) => {
            if (!alive) return;
            setGroup(g);
            setError(null);
          },
          (e: Error) => {
            if (alive) setError(e.message);
          },
        );
      void load();
      const timer = setInterval(() => void load(), 5000);
      return () => {
        alive = false;
        clearInterval(timer);
      };
    }, [id]),
  );

  if (group === undefined && !error) return <Loading />;

  const link = group ? inviteLink(group.invite_code) : '';
  const alone = group ? group.members.length === 1 : false;
  const toGroup = () => router.replace(`/group/${id}` as never);

  const copy = async () => {
    try {
      await Clipboard.setStringAsync(link);
      setSent('copied');
    } catch {
      setError('Could not copy the link. Press and hold it to copy it yourself.');
    }
  };
  const send = async () => {
    if (!CAN_SHARE) return copy();
    try {
      const result = await Share.share({ message: inviteMessage(group?.name, link) });
      // Closing the share sheet without choosing anything is not sending.
      if (result.action !== Share.dismissedAction) setSent('shared');
    } catch (e) {
      // In a browser, closing the share sheet arrives here. Anything else: fall back to copying.
      if (e instanceof Error && e.name === 'AbortError') return;
      await copy();
    }
  };

  // Sending the link happens on its card. What is pinned at the bottom is the way on: quiet until
  // the link has gone out from a brand new group, and the big button once it has.
  const footer =
    !group || (isNew && sent) ? (
      <Button label="Go to the group" onPress={toGroup} />
    ) : (
      <Button label={isNew ? 'Skip for now' : 'Back to the group'} kind="ghost" small onPress={toGroup} />
    );

  return (
    <Screen footer={footer}>
      <TopBar title={group?.name ?? 'Invite'} subtitle={isNew ? 'Step 2 of 2' : 'Invite people'} backTo={`/group/${id}`} />
      <ErrorNote message={error} />
      {group ? (
        <>
          {isNew || alone ? (
            <View style={{ gap: 6 }}>
              <T size={24} weight="black">
                {isNew ? 'Now bring your people in' : 'It is just you so far'}
              </T>
              <T size={15} weight="medium" color={colors.textMuted}>
                {isNew
                  ? 'Your group is ready. It comes to life when someone else is in it, so send the link below to the people it is for.'
                  : 'Send the link below to the people this group is for, or let them scan the code on this screen.'}
              </T>
            </View>
          ) : null}
          <Card style={{ padding: 18, gap: 10 }}>
            <T size={16} weight="extra">
              Invite with a link
            </T>
            <T size={14} color={colors.textMuted}>
              Whoever taps it is in. No account needed, and no app to install.
            </T>
            <View style={{ borderRadius: 16, backgroundColor: colors.background, padding: 14 }}>
              <T size={14} color={colors.textMuted} lines={2}>
                {link}
              </T>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button label={sent === 'copied' ? 'Copied' : 'Copy link'} kind="outline" small onPress={() => void copy()} style={{ flex: 1 }} />
              {/* The phone's own share sheet. A browser without one can only copy. */}
              {CAN_SHARE ? <Button label="Send link" small onPress={() => void send()} style={{ flex: 1 }} /> : null}
            </View>
            {sent ? (
              <T size={14} weight="extra" color={colors.mintText}>
                {sent === 'copied' ? 'Link copied. Paste it into a chat with your people.' : 'When they tap the link they will show up below.'}
              </T>
            ) : null}
          </Card>
          <Card style={{ padding: 18, gap: 12 }}>
            <T size={16} weight="extra">
              Or scan it in person
            </T>
            {/* The code is the link itself, drawn on this device. Nothing is uploaded or kept. It is
                always dark squares on a white tile, in every mode: a camera reads that best. */}
            <View
              accessible
              accessibilityRole="image"
              accessibilityLabel="A code to scan. It opens the invite link."
              style={{ alignSelf: 'center', padding: 12, borderRadius: 20, backgroundColor: colors.white, borderWidth: 2, borderColor: colors.line }}>
              <QRCode value={link} size={168} color={colors.ink} backgroundColor={colors.white} />
            </View>
            <T size={14} color={colors.textMuted} center>
              Point a phone camera at this. It opens the same link.
            </T>
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
            {alone ? (
              <T size={14} color={colors.textMuted}>
                Nobody else yet. They will appear here as they join.
              </T>
            ) : null}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
