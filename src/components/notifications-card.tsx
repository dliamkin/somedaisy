import { useEffect, useState } from 'react';
import { Linking } from 'react-native';

import { enablePush, getPushState, type PushState } from '@/lib/push';
import { useTheme } from '@/lib/theme';

import { Button, Card, ErrorNote, T } from './ui';

/**
 * Offers to turn on notifications. By default it only appears while the person has not decided;
 * with `showStatus` it also says when they are on or blocked. Renders nothing on the web and in Expo Go.
 */
export function NotificationsCard({ showStatus }: { showStatus?: boolean }) {
  const { colors } = useTheme();
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getPushState().then(
      (s) => alive && setState(s),
      () => alive && setState('unavailable'),
    );
    return () => {
      alive = false;
    };
  }, []);

  const turnOn = async () => {
    setBusy(true);
    setError(null);
    try {
      setState(await enablePush());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not turn on notifications.');
    } finally {
      setBusy(false);
    }
  };

  if (state === null || state === 'unavailable') return null;
  if (state !== 'ask' && !showStatus) return null;

  return (
    <Card style={{ padding: 18 }}>
      <T size={17} weight="extra">
        {state === 'on' ? 'Notifications are on' : state === 'blocked' ? 'Notifications are off' : 'Get a nudge'}
      </T>
      <T size={14} weight="medium" color={colors.textMuted}>
        {state === 'on'
          ? 'This phone can hear when a friend reacts to or comments on an idea you added, and shortly before a plan.'
          : state === 'blocked'
            ? "They are switched off for SomeDaisy in this phone's settings."
            : 'Hear when a friend reacts to or comments on an idea you added, and get a reminder before a plan. Nothing else, and you choose which.'}
      </T>
      <ErrorNote message={error} />
      {state === 'ask' ? <Button label="Turn on notifications" small onPress={turnOn} busy={busy} /> : null}
      {state === 'blocked' ? <Button label="Open settings" kind="soft" small onPress={() => void Linking.openSettings()} /> : null}
    </Card>
  );
}
