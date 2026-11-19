import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { RankDaisy } from '@/components/daisy';
import { FlowerOutlines } from '@/components/flower-outlines';
import { Logo } from '@/components/logo';
import { NameForm } from '@/components/name-form';
import { NotificationsCard } from '@/components/notifications-card';
import { PrivacyLink } from '@/components/privacy-link';
import { Avatar, Button, Card, ErrorNote, Loading, Screen, T } from '@/components/ui';
import { fetchGroups, fetchPlansByGroup, type GroupSummary, type PlanSummary } from '@/lib/data';
import { nextPlan, nextPlanLine } from '@/lib/plans';
import { levelFor, TITLES } from '@/lib/points';
import { useSession } from '@/lib/session';
import { covers, useTheme } from '@/lib/theme';
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

function Home() {
  const { colors } = useTheme();
  const { profile, email } = useSession();
  const [groups, setGroups] = useState<GroupSummary[] | null>(null);
  // Each group's points, by group id. Null until loaded, and when points are not set up yet.
  const [points, setPoints] = useState<Record<string, number> | null>(null);
  // Each group's plans, by group id, for the "Next:" line. Null until loaded.
  const [plans, setPlans] = useState<Record<string, PlanSummary[]> | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [error, setError] = useState<string | null>(null);

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

  return (
    <Screen footer={<Button label="Start a new group" onPress={() => router.push('/new-group')} />}>
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
      <View style={{ gap: 4 }}>
        <T size={32} weight="black" style={{ lineHeight: 36 }}>
          Who are you making plans with?
        </T>
        <T weight="medium" color={colors.textMuted}>
          Pick a group to see your shared lists.
        </T>
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
      {groups?.map((g) => {
        const level = points ? levelFor(points[g.id] ?? 0) : null;
        const next = plans ? nextPlan(plans[g.id] ?? [], now) : null;
        return (
          <Pressable key={g.id} accessibilityRole="button" accessibilityLabel={`Open ${g.name}`} onPress={() => router.push(`/group/${g.id}` as never)}>
            <Card style={{ padding: 0, gap: 0, overflow: 'hidden' }}>
              <View style={{ height: 68, backgroundColor: covers[g.cover] ?? colors.sky, alignItems: 'flex-end', justifyContent: 'center', paddingRight: 18 }}>
                <FlowerOutlines />
                {/* One petal for each rank the group has reached. Until the ranks have loaded, the whole daisy. */}
                <RankDaisy earned={level ? level.index + 1 : TITLES.length} />
              </View>
              <View style={{ paddingTop: 12, paddingBottom: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <T size={20} weight="extra" lines={1}>
                    {g.name}
                  </T>
                  {level || plans ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8 }}>
                      {level ? (
                        <T size={14} weight="extra" color={colors.accentText} lines={1}>
                          {level.title}
                        </T>
                      ) : null}
                      {plans ? (
                        <T size={13} color={colors.textMuted} lines={1} style={{ flexShrink: 1 }}>
                          {next ? `Next: ${nextPlanLine(next.title, next.planned_for, now)}` : 'Nothing planned yet'}
                        </T>
                      ) : null}
                    </View>
                  ) : null}
                </View>
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  {g.members.slice(0, 4).map((m) => (
                    <Avatar key={m.user_id} name={m.name} color={m.color} photo={m.photo} />
                  ))}
                </View>
              </View>
            </Card>
          </Pressable>
        );
      })}
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
  );
}
