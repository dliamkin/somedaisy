import { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';

import { NotificationsCard } from '@/components/notifications-card';
import { Card, ErrorNote, Loading, Screen, T, TopBar } from '@/components/ui';
import {
  getNotificationSettings,
  type NotificationSettings,
  pushAvailable,
  saveNotificationSettings,
} from '@/lib/push';
import { useSession } from '@/lib/session';
import { colors } from '@/lib/theme';

/** Choose which notifications to get. The choices follow the person to every phone they use. */
export default function Notifications() {
  const { ready, profile } = useSession();
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const signedIn = ready && Boolean(profile);

  useEffect(() => {
    if (!signedIn) return;
    let alive = true;
    getNotificationSettings().then(
      (s) => alive && setSettings(s),
      (e: unknown) => alive && setError(e instanceof Error ? e.message : 'Could not load your choices.'),
    );
    return () => {
      alive = false;
    };
  }, [signedIn]);

  // Shows the new value straight away, and puts the old one back if it could not be saved.
  const change = (next: NotificationSettings) => {
    const before = settings;
    setSettings(next);
    setError(null);
    saveNotificationSettings(next).catch((e: unknown) => {
      setSettings(before);
      setError(e instanceof Error ? e.message : 'Could not save your choice.');
    });
  };

  if (!ready) return <Loading />;

  return (
    <Screen>
      <TopBar title="Notifications" backTo="/" />
      <T weight="medium" color={colors.muted}>
        SomeDaisy only nudges you about the things below. Switch off any you do not want.
      </T>
      <NotificationsCard showStatus />
      {!pushAvailable ? (
        <T size={14} weight="medium" color={colors.muted}>
          Notifications arrive on phones with the SomeDaisy app installed. Your choices here apply to every phone you use.
        </T>
      ) : null}
      <ErrorNote message={error} />
      {settings ? (
        <Card style={{ padding: 18, gap: 18 }}>
          <Choice
            title="Reactions to your ideas"
            detail="When a friend reacts to an idea you added."
            value={settings.reactions}
            onChange={(reactions) => change({ ...settings, reactions })}
          />
          <View style={{ height: 1, backgroundColor: colors.line }} />
          <Choice
            title="Plan reminders"
            detail="About two hours before a plan starts."
            value={settings.reminders}
            onChange={(reminders) => change({ ...settings, reminders })}
          />
        </Card>
      ) : error ? null : (
        <Loading />
      )}
    </Screen>
  );
}

function Choice({ title, detail, value, onChange }: { title: string; detail: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <T size={16} weight="extra">
          {title}
        </T>
        <T size={14} weight="medium" color={colors.muted}>
          {detail}
        </T>
      </View>
      <Switch
        accessibilityLabel={title}
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.dash, true: colors.grape }}
        thumbColor={colors.white}
      />
    </View>
  );
}
