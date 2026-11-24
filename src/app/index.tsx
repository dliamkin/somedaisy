import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { ActionIcon } from '@/components/action-icons';
import { Dialog } from '@/components/dialog';
import { GroupCard } from '@/components/group-card';
import { Logo } from '@/components/logo';
import { NameForm } from '@/components/name-form';
import { NotificationsCard } from '@/components/notifications-card';
import { PrivacyLink } from '@/components/privacy-link';
import { Sheet, SheetRow } from '@/components/sheet';
import { Avatar, Button, Card, ErrorNote, Loading, Screen, T } from '@/components/ui';
import { useCoverPhotos } from '@/lib/cover-addresses';
import { uploadedPhoto } from '@/lib/cover-photos';
import { coverOf } from '@/lib/covers';
import { fetchGroups, fetchPlansByGroup, leaveGroup, type GroupSummary, type PlanSummary } from '@/lib/data';
import { deleteGroup, deleteOverview, fetchGroupContents, type GroupContents } from '@/lib/group-files';
import { nextPlan, nextPlanLine } from '@/lib/plans';
import { levelFor, TITLES } from '@/lib/points';
import { useSession } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import { fetchPointsByGroup } from '@/lib/together';

function Brand() {
  return <Logo />;
}

export default function Index() {
  const { colors } = useTheme();
  const { ready, configured, error, profile } = useSession();
  if (!ready) return <Loading />;
  if (!configured) {
    return (
      <Screen>
        <Brand />
        <T size={28} weight="black">
          Almost there
        </T>
        <T weight="medium" color={colors.textMuted}>
          Add your Supabase URL and key to the .env file, then restart the app.
        </T>
      </Screen>
    );
  }
  if (error) {
    return (
      <Screen>
        <Brand />
        <ErrorNote message={`Could not connect: ${error}`} />
        <T weight="medium" color={colors.textMuted}>
          Check that Anonymous sign-ins are turned on in Supabase and that the database setup script has been run.
        </T>
      </Screen>
    );
  }
  return profile ? <Home /> : <Welcome />;
}

function Welcome() {
  const { colors } = useTheme();
  return (
    <Screen>
      <Brand />
      <View style={{ gap: 10, marginTop: 12 }}>
        <T size={34} weight="black" style={{ lineHeight: 38 }}>
          Turn someday into a day
        </T>
        <T size={17} weight="medium" color={colors.textMuted} style={{ lineHeight: 24 }}>
          Collect ideas with friends, vote on them, and stop forgetting the good ones.
        </T>
      </View>
      <NameForm cta="Get started" onDone={() => {}} />
      <T size={14} color={colors.textMuted} center>
        No account needed. Got an invite link? Open it and you will land in the group.
      </T>
      <Button label="I already have an account" kind="ghost" small onPress={() => router.push('/account?mode=signin' as never)} />
      <PrivacyLink />
    </Screen>
  );
}

/** What someone has asked to do to a group from its menu, which they are asked about first. */
type Asked = { group: GroupSummary; what: 'delete' | 'leave' };

function Home() {
  const { colors } = useTheme();
  const { profile, email, userId } = useSession();
  const [groups, setGroups] = useState<GroupSummary[] | null>(null);
  // Each group's points, by group id. Null until loaded, and when points are not set up yet.
  const [points, setPoints] = useState<Record<string, number> | null>(null);
  // Each group's plans, by group id, for the "Next:" line. Null until loaded.
  const [plans, setPlans] = useState<Record<string, PlanSummary[]> | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [error, setError] = useState<string | null>(null);
  // Where each group's cover photo loads from, asked for in one go for all of them.
  const photoOf = useCoverPhotos((groups ?? []).map(coverOf));
  // The group whose menu is open, and the one being deleted or left, with what it holds once that is known.
  const [menuFor, setMenuFor] = useState<GroupSummary | null>(null);
  const [asked, setAsked] = useState<Asked | null>(null);
  const [contents, setContents] = useState<Partial<GroupContents> | null>(null);
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);

  // Ask before deleting or leaving. For a delete, what the group holds is counted, to say plainly what goes.
  const ask = (group: GroupSummary, what: Asked['what']) => {
    setMenuFor(null);
    setRefused(null);
    setContents(null);
    setAsked({ group, what });
    if (what !== 'delete') return;
    fetchGroupContents(group.id).then(
      (counted) => setContents({ ideas: counted.ideas ?? undefined, done: counted.done ?? undefined, pictures: counted.pictures ?? undefined }),
      () => setContents({}),
    );
  };

  const goAhead = async () => {
    if (!asked || busy) return;
    setBusy(true);
    setRefused(null);
    try {
      if (asked.what === 'delete') await deleteGroup(asked.group.id);
      else await leaveGroup(asked.group.id);
      const gone = asked.group.id;
      setGroups((current) => current?.filter((g) => g.id !== gone) ?? current);
      setAsked(null);
    } catch (e) {
      setRefused(e instanceof Error && e.message ? e.message : asked.what === 'delete' ? 'Could not delete the group.' : 'Could not leave the group.');
    } finally {
      setBusy(false);
    }
  };
  const putAway = useCallback(() => setAsked(null), []);
  const closeMenu = useCallback(() => setMenuFor(null), []);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      fetchGroups()
        .then((g) => alive && setGroups(g))
        .catch((e: Error) => alive && setError(e.message));
      // Ranks and plans are niceties: the groups show without them.
      fetchPointsByGroup().then(
        (p) => alive && setPoints(p),
        () => {},
      );
      fetchPlansByGroup().then(
        (p) => {
          if (!alive) return;
          setPlans(p);
          setNow(new Date());
        },
        () => {},
      );
      return () => {
        alive = false;
      };
    }, []),
  );

  const overview = asked?.what === 'delete' ? deleteOverview(asked.group, contents, uploadedPhoto(coverOf(asked.group)) !== null, userId) : [];

  return (
    <View style={{ flex: 1 }}>
    <Screen fade footer={<Button label="Start a new group" onPress={() => router.push('/new-group')} />}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Brand />
        {profile ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={email ? 'Your account' : 'Save your account'}
            onPress={() => router.push('/account' as never)}>
            <Avatar name={profile.name} color={profile.color} photo={profile.photo_url} size={44} />
          </Pressable>
        ) : null}
      </View>
      {/* One short line, so the first group starts high on the screen and more of them fit. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <T size={26} weight="black" style={{ lineHeight: 30, letterSpacing: -0.5 }}>
          Your groups
        </T>
        {groups && groups.length > 0 ? (
          <View style={{ paddingHorizontal: 9, paddingVertical: 2, borderRadius: 10, backgroundColor: colors.today }}>
            <T size={13} weight="extra">
              {groups.length}
            </T>
          </View>
        ) : null}
      </View>
      <ErrorNote message={error} />
      {groups === null && !error ? <Loading /> : null}
      {groups?.length === 0 ? (
        <Card style={{ padding: 18 }}>
          <T size={18} weight="extra">
            No groups yet
          </T>
          <T weight="medium" color={colors.textMuted}>
            Start one and invite a friend with a link.
          </T>
        </Card>
      ) : null}
      {groups && groups.length > 0 ? (
        // The cards sit a little closer to each other than the other things on the page.
        <View style={{ gap: 12 }}>
          {groups.map((g) => {
            const level = points ? levelFor(points[g.id] ?? 0) : null;
            const next = plans ? nextPlan(plans[g.id] ?? [], now) : null;
            return (
              <GroupCard
                key={g.id}
                group={g}
                rank={level?.title}
                // One petal for each rank the group has reached. Until the ranks have loaded, the whole daisy.
                petals={level ? level.index + 1 : TITLES.length}
                next={plans ? (next ? `Next: ${nextPlanLine(next.title, next.planned_for, now)}` : null) : undefined}
                photo={photoOf(coverOf(g))}
                onPress={() => router.push(`/group/${g.id}` as never)}
                onMenu={() => setMenuFor(g)}
              />
            );
          })}
        </View>
      ) : null}
      {groups && groups.length > 0 ? <NotificationsCard /> : null}
      {groups && groups.length > 0 ? (
        <Button label="Notification settings" kind="ghost" small onPress={() => router.push('/notifications' as never)} />
      ) : null}
      {!email && groups && groups.length > 0 ? (
        <Card style={{ padding: 18, backgroundColor: colors.today }}>
          <T size={17} weight="extra">
            Keep your groups
          </T>
          <T size={14} weight="medium" color={colors.textMuted}>
            You are a guest, so your groups live only on this device. Add your email to get back to them anywhere.
          </T>
          <Button label="Add my email" small onPress={() => router.push('/account' as never)} />
        </Card>
      ) : null}
    </Screen>

      {/* What can be done with a group, behind the button at the top left of its card. Only its owner can
          delete it. Anyone else can leave it. */}
      {menuFor ? (
        <Sheet title={menuFor.name} onClose={closeMenu}>
          <View style={{ gap: 2 }}>
            <SheetRow
              icon={<ActionIcon name="share" />}
              label="Share group"
              onPress={() => {
                const id = menuFor.id;
                setMenuFor(null);
                router.push(`/group/${id}/invite` as never);
              }}
            />
            {menuFor.owner === userId ? (
              <SheetRow icon={<ActionIcon name="trash" color={colors.danger} />} label="Delete group" onPress={() => ask(menuFor, 'delete')} />
            ) : (
              <SheetRow icon={<ActionIcon name="leave" />} label="Leave group" onPress={() => ask(menuFor, 'leave')} />
            )}
          </View>
        </Sheet>
      ) : null}

      {asked?.what === 'delete' ? (
        <Dialog title={`Delete ${asked.group.name}?`} onClose={putAway} locked={busy}>
          <T size={15} weight="medium">
            This deletes the group for everyone in it, and everything in it goes too:
          </T>
          <View style={{ gap: 6 }}>
            {overview.map((line) => (
              <View key={line} style={{ flexDirection: 'row', gap: 8 }}>
                <T size={15} weight="extra" color={colors.danger}>
                  •
                </T>
                <T size={15} weight="medium" style={{ flex: 1 }}>
                  {line}
                </T>
              </View>
            ))}
          </View>
          <T size={15} weight="extra" color={colors.danger}>
            This cannot be undone.
          </T>
          <ErrorNote message={refused} />
          <Button label="Yes, delete it" kind="danger" onPress={() => void goAhead()} busy={busy} />
          <Button label="Cancel" kind="ghost" small onPress={putAway} disabled={busy} />
        </Dialog>
      ) : null}

      {asked?.what === 'leave' ? (
        <Dialog title={`Leave ${asked.group.name}?`} onClose={putAway} locked={busy}>
          <T size={15} weight="medium">
            You stop seeing this group and your reactions are removed. Ideas and comments you added stay for your friends. You can come back with an invite link.
          </T>
          <ErrorNote message={refused} />
          <Button label="Leave group" kind="danger" onPress={() => void goAhead()} busy={busy} />
          <Button label="Stay" kind="ghost" small onPress={putAway} disabled={busy} />
        </Dialog>
      ) : null}
    </View>
  );
}
