import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Avatar, Button, Card, Chip, ErrorNote, Field, Loading, Screen, T, TopBar } from '@/components/ui';
import {
  fetchGroup,
  leaveGroup,
  markChanged,
  removeList,
  removeMember,
  renameList,
  resetInviteCode,
  updateGroup,
  type GroupData,
  type List,
  type Member,
} from '@/lib/data';
import { useSession } from '@/lib/session';
import { colors, covers } from '@/lib/theme';

// The one thing waiting for a "yes, really" at a time.
type Confirm = { kind: 'leave' } | { kind: 'link' } | { kind: 'member'; member: Member } | null;

/** Rename the group, tidy its lists, see who is in it, and leave. The owner can also remove people and replace the invite link. */
export default function GroupSettings() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useSession();
  const [group, setGroup] = useState<GroupData | null | undefined>(undefined);
  const [name, setName] = useState('');
  const [cover, setCover] = useState('sky');
  const [editing, setEditing] = useState<{ list: List; name: string } | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const show = useCallback((g: GroupData | null) => {
    setGroup(g);
    if (g) {
      setName(g.name);
      setCover(g.cover);
    }
  }, []);

  useEffect(() => {
    if (!id) return;
    fetchGroup(id).then(show, (e: Error) => {
      setError(e.message);
      setGroup(null);
    });
  }, [id, show]);

  // Run one change: show it is happening, reload afterwards, and put any failure on the screen.
  const run = async (change: () => Promise<void>, done?: string) => {
    if (!id || busy) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      await change();
      markChanged(id);
      show(await fetchGroup(id));
      setNote(done ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that. Try again.');
    } finally {
      setBusy(false);
    }
  };

  if (group === undefined) return <Loading />;
  if (!group || !id || !userId) {
    return (
      <Screen footer={<Button label="Back to groups" kind="soft" onPress={() => router.replace('/')} />}>
        <TopBar title="Group settings" backTo="/" />
        <ErrorNote message={error} />
        <T weight="medium" color={colors.muted}>
          That group is not available.
        </T>
      </Screen>
    );
  }

  const isOwner = group.owner === userId;
  const alone = group.members.length === 1;
  const changed = name.trim() !== group.name || cover !== group.cover;

  const leave = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await leaveGroup(id);
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not leave the group.');
      setBusy(false);
    }
  };

  return (
    <Screen>
      <TopBar title="Group settings" subtitle={group.name} backTo={`/group/${id}`} />
      <ErrorNote message={error} />
      {note ? (
        <T size={14} weight="extra" color={colors.mintText} center>
          {note}
        </T>
      ) : null}

      <Card style={{ padding: 18, gap: 14 }}>
        <Field label="Group name" value={name} onChangeText={setName} maxLength={60} />
        <View style={{ gap: 8 }}>
          <T size={14} weight="extra">
            Cover
          </T>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {Object.entries(covers).map(([key, value]) => (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={`${key} cover`}
                accessibilityState={{ selected: key === cover }}
                onPress={() => setCover(key)}
                style={{ flex: 1, height: 52, borderRadius: 16, backgroundColor: value, borderWidth: 3, borderColor: key === cover ? colors.grape : 'transparent' }}
              />
            ))}
          </View>
        </View>
        <Button
          label="Save"
          small
          onPress={() => run(() => updateGroup(id, { name: name.trim(), cover }), 'Saved.')}
          disabled={!changed || !name.trim() || busy}
        />
      </Card>

      <Card style={{ padding: 18, gap: 10 }}>
        <T size={16} weight="extra">
          Lists
        </T>
        <T size={14} weight="medium" color={colors.muted}>
          Tap a list to rename it. A list with nothing on it can be removed.
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {group.lists.map((l) => (
            <Chip key={l.id} label={l.name} selected={editing?.list.id === l.id} onPress={() => setEditing(editing?.list.id === l.id ? null : { list: l, name: l.name })} />
          ))}
        </View>
        {editing ? (
          <View style={{ gap: 8 }}>
            <Field label="List name" value={editing.name} onChangeText={(v) => setEditing({ ...editing, name: v })} maxLength={40} />
            <Button
              label="Rename list"
              small
              onPress={() => {
                const { list, name: next } = editing;
                void run(() => renameList(list.id, next.trim()), 'List renamed.').then(() => setEditing(null));
              }}
              disabled={!editing.name.trim() || editing.name.trim() === editing.list.name || busy}
            />
            <Button
              label="Remove this list"
              kind="ghost"
              small
              onPress={() => {
                const { list } = editing;
                void run(() => removeList(list.id), 'List removed.').then(() => setEditing(null));
              }}
              disabled={busy}
            />
          </View>
        ) : null}
      </Card>

      <Card style={{ padding: 18, gap: 10 }}>
        <T size={16} weight="extra">
          In this group
        </T>
        {group.members.map((m) => {
          const tags = [m.user_id === userId ? 'you' : null, m.user_id === group.owner ? 'owner' : null].filter(Boolean).join(', ');
          return (
            <View key={m.user_id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 }}>
              <Avatar name={m.name} color={m.color} photo={m.photo} size={40} />
              <T weight="extra" lines={1} style={{ flex: 1 }}>
                {tags ? `${m.name} (${tags})` : m.name}
              </T>
              {isOwner && m.user_id !== userId ? (
                <Button label="Remove" kind="ghost" small onPress={() => setConfirm({ kind: 'member', member: m })} disabled={busy} style={{ paddingHorizontal: 8 }} />
              ) : null}
            </View>
          );
        })}
        {confirm?.kind === 'member' ? (
          <View style={{ gap: 8, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12 }}>
            <T size={16} weight="extra">
              Remove {confirm.member.name}?
            </T>
            <T size={14} weight="medium" color={colors.muted}>
              They lose access to this group and their reactions are removed. Ideas and comments they added stay. They could rejoin with the invite
              link, so get a new link below if you do not want that.
            </T>
            <Button
              label={`Remove ${confirm.member.name}`}
              kind="danger"
              small
              busy={busy}
              onPress={() => {
                const { member } = confirm;
                void run(() => removeMember(id, member.user_id), `${member.name} was removed.`).then(() => setConfirm(null));
              }}
            />
            <Button label="Keep them" kind="ghost" small onPress={() => setConfirm(null)} disabled={busy} />
          </View>
        ) : null}
      </Card>

      {isOwner ? (
        <Card style={{ padding: 18, gap: 10 }}>
          <T size={16} weight="extra">
            Invite link
          </T>
          {confirm?.kind === 'link' ? (
            <>
              <T size={14} weight="medium" color={colors.muted}>
                The link you have shared stops working. Everyone already in the group stays. You will need to send the new link to anyone who has
                not joined yet.
              </T>
              <Button
                label="Get a new link"
                small
                busy={busy}
                onPress={() => void run(async () => void (await resetInviteCode(id)), 'The invite link is new. Share it from the Invite screen.').then(() => setConfirm(null))}
              />
              <Button label="Keep the current link" kind="ghost" small onPress={() => setConfirm(null)} disabled={busy} />
            </>
          ) : (
            <>
              <T size={14} weight="medium" color={colors.muted}>
                If the link has reached someone it should not have, replace it with a new one.
              </T>
              <Button label="Replace the invite link" kind="outline" small onPress={() => setConfirm({ kind: 'link' })} disabled={busy} />
            </>
          )}
        </Card>
      ) : null}

      {confirm?.kind === 'leave' ? (
        <Card style={{ padding: 18, gap: 10 }}>
          <T size={16} weight="extra">
            {alone ? 'Leave and delete this group?' : 'Leave this group?'}
          </T>
          <T size={14} weight="medium" color={colors.muted}>
            {alone
              ? 'You are the only one here, so the group is deleted with everything in it.'
              : 'You stop seeing this group and your reactions are removed. Ideas and comments you added stay for your friends. You can come back with an invite link.'}
          </T>
          {alone ? (
            <T size={14} weight="extra" color={colors.danger}>
              This cannot be undone.
            </T>
          ) : null}
          <Button label={alone ? 'Leave and delete' : 'Leave group'} kind="danger" small onPress={leave} busy={busy} />
          <Button label="Stay" kind="ghost" small onPress={() => setConfirm(null)} disabled={busy} />
        </Card>
      ) : (
        <Button label="Leave this group" kind="ghost" small onPress={() => setConfirm({ kind: 'leave' })} disabled={busy} />
      )}
    </Screen>
  );
}
