import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Switch, View } from 'react-native';

import { Cover } from '@/components/cover';
import { ListLookPicker, type LookChoice } from '@/components/list-look-picker';
import { ListOptionsPicker } from '@/components/list-options-picker';
import { Avatar, Button, Card, Chip, ErrorNote, Field, Loading, Screen, T, TopBar } from '@/components/ui';
import {
  fetchGroup,
  fetchMuted,
  leaveGroup,
  markChanged,
  removeList,
  removeMember,
  renameList,
  setListLook,
  setListOptions,
  resetInviteCode,
  setGroupMuted,
  updateGroup,
  type GroupData,
  type List,
  type Member,
} from '@/lib/data';
import { optionsOf, type ListOptions } from '@/lib/list-options';
import { cleanHex, isIcon } from '@/lib/looks';
import { useSession } from '@/lib/session';
import { useCoverPhotos } from '@/lib/cover-addresses';
import { uploadedPhoto } from '@/lib/cover-photos';
import { coverOf, NAME_MAX } from '@/lib/covers';
import { removeCover } from '@/lib/picture-files';
import { levelFor, TITLES } from '@/lib/points';
import { useTheme } from '@/lib/theme';

// The one thing waiting for a "yes, really" at a time.
type Confirm = { kind: 'leave' } | { kind: 'link' } | { kind: 'member'; member: Member } | null;

/** Rename the group, tidy its lists, see who is in it, and leave. The owner can also remove people and replace the invite link. */
export default function GroupSettings() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useSession();
  const [group, setGroup] = useState<GroupData | null | undefined>(undefined);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<{ list: List; name: string; look: LookChoice; options: ListOptions } | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  // Whether this person has muted the group. Null while unknown, or when muting is not available.
  const [muted, setMuted] = useState<boolean | null>(null);

  useEffect(() => {
    if (!id || !userId) return;
    let alive = true;
    fetchMuted(id, userId).then(
      (m) => alive && setMuted(m),
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [id, userId]);

  const show = useCallback((g: GroupData | null) => {
    setGroup(g);
    if (g) setName(g.name);
  }, []);

  useEffect(() => {
    if (!id) return;
    fetchGroup(id).then(show, (e: Error) => {
      setError(e.message);
      setGroup(null);
    });
  }, [id, show]);

  // The cover is changed on a page of its own. Coming back from it, the group is read again so the
  // new cover shows, and the name is left as it is in case it was half typed.
  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      let alive = true;
      fetchGroup(id).then(
        (g) => alive && g && setGroup(g),
        () => {},
      );
      return () => {
        alive = false;
      };
    }, [id]),
  );

  // Run one change: show it is happening, reload afterwards, and put any failure on the screen.
  // Answers whether it worked, so a confirmation stays open when it did not.
  const run = async (change: () => Promise<void>, done?: string): Promise<boolean> => {
    if (!id || busy) return false;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      await change();
      markChanged(id);
      show(await fetchGroup(id));
      setNote(done ?? null);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that. Try again.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  // Where the cover's photo loads from, when the group has one.
  const photoOf = useCoverPhotos(group ? [coverOf(group)] : []);

  if (group === undefined) return <Loading />;
  if (!group || !id || !userId) {
    return (
      <Screen footer={<Button label="Back to groups" kind="soft" onPress={() => router.replace('/')} />}>
        <TopBar title="Group settings" backTo="/" />
        <ErrorNote message={error} />
        <T weight="medium" color={colors.textMuted}>
          That group is not available.
        </T>
      </Screen>
    );
  }

  const isOwner = group.owner === userId;
  const alone = group.members.length === 1;
  const changed = name.trim() !== group.name;

  // Shows the new setting straight away, and puts the old one back if it could not be saved.
  const mute = (next: boolean) => {
    const before = muted;
    setMuted(next);
    setError(null);
    setGroupMuted(id, next).catch((e: unknown) => {
      setMuted(before);
      setError(e instanceof Error ? e.message : 'Could not save that. Try again.');
    });
  };

  const leave = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      // The last one out takes the group with them, and the database cannot remove a stored file.
      // So the cover photo goes first, while this person is still allowed to remove it.
      if (alone && uploadedPhoto(coverOf(group))) await removeCover(id);
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
        <T size={14} weight="extra" color={colors.good} center>
          {note}
        </T>
      ) : null}

      <Card style={{ padding: 18, gap: 14 }}>
        {/* A name from before the limit came down can be longer, and is not cut short by being edited. */}
        <Field label="Group name" value={name} onChangeText={setName} maxLength={Math.max(NAME_MAX, group.name.length)} />
        <Button
          label="Save name"
          small
          // The cover's word goes along unchanged: it is changed on the cover's own page.
          onPress={() => run(() => updateGroup(id, { name: name.trim(), cover: group.cover }), 'Saved.')}
          disabled={!changed || !name.trim() || busy}
        />
      </Card>

      <Card style={{ padding: 18, gap: 12 }}>
        <T size={16} weight="extra">
          Cover
        </T>
        {/* The cover as it is now, the way it shows on the group's card on Home. */}
        <Cover
          cover={coverOf(group)}
          place="card"
          name={group.name}
          earned={group.points !== null ? levelFor(group.points).index + 1 : TITLES.length}
          photo={photoOf(coverOf(group))}
          style={{ borderRadius: 20 }}
        />
        <Button label="Change cover" kind="outline" small onPress={() => router.push(`/group/${id}/cover` as never)} disabled={busy} />
      </Card>

      {muted !== null ? (
        <Card style={{ padding: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <T size={16} weight="extra">
                Mute this group
              </T>
              <T size={14} weight="medium" color={colors.textMuted}>
                No notifications from this group, for you only. Your other groups are not affected.
              </T>
            </View>
            <Switch
              accessibilityLabel="Mute this group"
              value={muted}
              onValueChange={mute}
              trackColor={{ false: colors.outline, true: colors.button }}
              thumbColor={colors.white}
            />
          </View>
        </Card>
      ) : null}

      <Card style={{ padding: 18, gap: 10 }}>
        <T size={16} weight="extra">
          Lists
        </T>
        <T size={14} weight="medium" color={colors.textMuted}>
          Tap a list to rename it, choose what kind of list it is, or change its icon and colour. A list with nothing on it can be removed.
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {group.lists.map((l) => (
            <Chip
              key={l.id}
              label={l.name}
              selected={editing?.list.id === l.id}
              onPress={() => setEditing(editing?.list.id === l.id ? null : { list: l, name: l.name, look: { icon: isIcon(l.icon) ? l.icon : null, color: cleanHex(l.color) }, options: optionsOf(l) })}
            />
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
                void run(() => renameList(list.id, next.trim()), 'List renamed.').then((ok) => ok && setEditing(null));
              }}
              disabled={!editing.name.trim() || editing.name.trim() === editing.list.name || busy}
            />
            {/* Each switch saves as it is flipped, and goes back if it could not be saved. */}
            <ListOptionsPicker
              value={editing.options}
              onChange={(options) => {
                const { list, options: before } = editing;
                setEditing({ ...editing, options });
                void run(() => setListOptions(list.id, options), 'Saved.').then((ok) => {
                  if (!ok) setEditing((current) => (current && current.list.id === list.id ? { ...current, options: before } : current));
                });
              }}
            />
            <ListLookPicker
              key={editing.list.id}
              name={editing.name}
              place={Math.max(0, group.lists.findIndex((l) => l.id === editing.list.id))}
              value={editing.look}
              onChange={(look) => setEditing({ ...editing, look })}
            />
            <Button
              label="Save icon and colour"
              small
              onPress={() => {
                const { list, look } = editing;
                void run(() => setListLook(list.id, look), 'Icon and colour saved.').then((ok) => ok && setEditing(null));
              }}
              disabled={busy || (editing.look.icon === (isIcon(editing.list.icon) ? editing.list.icon : null) && editing.look.color === cleanHex(editing.list.color))}
            />
            <Button
              label="Remove this list"
              kind="ghost"
              small
              onPress={() => {
                const { list } = editing;
                void run(() => removeList(list.id), 'List removed.').then((ok) => ok && setEditing(null));
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
            <T size={14} weight="medium" color={colors.textMuted}>
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
                void run(() => removeMember(id, member.user_id), `${member.name} was removed.`).then((ok) => ok && setConfirm(null));
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
              <T size={14} weight="medium" color={colors.textMuted}>
                The link you have shared stops working. Everyone already in the group stays. You will need to send the new link to anyone who has
                not joined yet.
              </T>
              <Button
                label="Get a new link"
                small
                busy={busy}
                onPress={() => void run(async () => void (await resetInviteCode(id)), 'The invite link is new. Share it from the Invite screen.').then((ok) => ok && setConfirm(null))}
              />
              <Button label="Keep the current link" kind="ghost" small onPress={() => setConfirm(null)} disabled={busy} />
            </>
          ) : (
            <>
              <T size={14} weight="medium" color={colors.textMuted}>
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
          <T size={14} weight="medium" color={colors.textMuted}>
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
