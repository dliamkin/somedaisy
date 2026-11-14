import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { NotificationsCard } from '@/components/notifications-card';
import { Avatar, Button, Card, ErrorNote, Field, Loading, Screen, T, TopBar } from '@/components/ui';
import {
  AccountError,
  cleanEmail,
  confirmEmailForGuest,
  confirmSignIn,
  isCode,
  isEmail,
  requestEmailForGuest,
  requestSignIn,
  signOut,
} from '@/lib/account';
import { forgetDevice } from '@/lib/push';
import { useSession } from '@/lib/session';
import { colors } from '@/lib/theme';

// "keep" adds an email to the guest on this device. "signin" switches this device to an account that already exists.
type Mode = 'keep' | 'signin';

export default function Account() {
  const { ready, email, profile } = useSession();
  if (!ready) return <Loading />;
  return email ? <SignedIn email={email} /> : <Guest hasProfile={Boolean(profile)} />;
}

function SignedIn({ email }: { email: string }) {
  const { profile, refresh } = useSession();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const leave = async () => {
    setBusy(true);
    setError(null);
    try {
      // Must happen while still signed in: it removes this phone from this account's notifications.
      await forgetDevice();
      await signOut();
      await refresh();
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign out.');
      setBusy(false);
    }
  };

  return (
    <Screen>
      <TopBar title="Your account" backTo="/" />
      <Card style={{ padding: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {profile ? <Avatar name={profile.name} color={profile.color} size={44} /> : null}
          <View style={{ flex: 1, gap: 2 }}>
            <T size={18} weight="extra" lines={1}>
              {profile?.name ?? 'Signed in'}
            </T>
            <T size={14} color={colors.muted} lines={1}>
              {email}
            </T>
          </View>
        </View>
        <T size={14} weight="medium" color={colors.muted}>
          Your groups are saved to this email. Sign in with it on any phone or browser to see them.
        </T>
      </Card>
      <NotificationsCard showStatus />
      <ErrorNote message={error} />
      {confirming ? (
        <Card style={{ padding: 18 }}>
          <T size={16} weight="extra">
            Sign out on this device?
          </T>
          <T size={14} weight="medium" color={colors.muted}>
            Your groups stay safe. You will need a code sent to {email} to get back in.
          </T>
          <Button label="Sign out" small onPress={leave} busy={busy} />
          <Button label="Stay signed in" kind="ghost" small onPress={() => setConfirming(false)} disabled={busy} />
        </Card>
      ) : (
        <Button label="Sign out" kind="soft" onPress={() => setConfirming(true)} />
      )}
    </Screen>
  );
}

function Guest({ hasProfile }: { hasProfile: boolean }) {
  const params = useLocalSearchParams<{ mode?: string }>();
  const { refresh } = useSession();
  // Someone who has not picked a name yet has nothing to keep, so they can only sign in.
  const [mode, setMode] = useState<Mode>(hasProfile && params.mode !== 'signin' ? 'keep' : 'signin');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taken, setTaken] = useState(false);

  const fail = (e: unknown, fallback: string) => {
    setTaken(e instanceof AccountError && e.reason === 'email-taken');
    setError(e instanceof Error ? e.message : fallback);
  };

  const send = async (as: Mode = mode) => {
    if (!isEmail(email) || busy) return;
    setBusy(true);
    setError(null);
    setTaken(false);
    try {
      if (as === 'keep') await requestEmailForGuest(email);
      else await requestSignIn(email);
      setMode(as);
      setCode('');
      setSentTo(cleanEmail(email));
    } catch (e) {
      fail(e, 'Could not send the code.');
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!sentTo || !isCode(code) || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === 'keep') await confirmEmailForGuest(sentTo, code);
      else await confirmSignIn(sentTo, code);
      await refresh();
      router.replace('/');
    } catch (e) {
      fail(e, 'Could not check the code.');
      setBusy(false);
    }
  };

  const switchTo = (next: Mode) => {
    setMode(next);
    setSentTo(null);
    setCode('');
    setError(null);
    setTaken(false);
  };

  if (sentTo) {
    return (
      <Screen footer={<Button label={mode === 'keep' ? 'Save my account' : 'Sign in'} onPress={confirm} disabled={!isCode(code)} busy={busy} />}>
        <TopBar title="Check your email" backTo="/" />
        <T weight="medium" color={colors.muted}>
          We sent a code to {sentTo}. It can take a minute to arrive, and it may land in spam.
        </T>
        <Field label="Code from the email" value={code} onChangeText={setCode} placeholder="123456" kind="code" maxLength={12} autoFocus onSubmit={confirm} />
        <ErrorNote message={error} />
        <Button label="Use a different email" kind="ghost" small onPress={() => switchTo(mode)} disabled={busy} />
      </Screen>
    );
  }

  return (
    <Screen footer={<Button label="Email me a code" onPress={() => send()} disabled={!isEmail(email)} busy={busy} />}>
      <TopBar title={mode === 'keep' ? 'Keep your groups' : 'Sign in'} backTo="/" />
      <T weight="medium" color={colors.muted}>
        {mode === 'keep'
          ? 'Right now your groups live only on this device. Add your email and you can get back to them from any phone or browser. No password needed.'
          : 'Enter the email you saved your account with. We will send you a code, no password needed.'}
      </T>
      <Field label="Your email" value={email} onChangeText={setEmail} placeholder="you@example.com" kind="email" maxLength={254} autoFocus onSubmit={() => send()} />
      <ErrorNote message={error} />
      {taken && mode === 'keep' ? (
        <Card style={{ padding: 18 }}>
          <T size={16} weight="extra">
            Sign in to that account instead?
          </T>
          <T size={14} weight="medium" color={colors.muted}>
            You will see that account&apos;s groups. Groups you joined as a guest on this device will not move over, so ask for a new invite link to rejoin them.
          </T>
          <Button label="Send me a sign-in code" small onPress={() => send('signin')} busy={busy} />
        </Card>
      ) : null}
      {mode === 'signin' && hasProfile ? (
        <T size={14} weight="medium" color={colors.muted}>
          Signing in replaces the guest on this device. Groups you joined as a guest here will not move over.
        </T>
      ) : null}
      {hasProfile ? (
        <Button
          label={mode === 'keep' ? 'I already have an account' : 'Save this guest instead'}
          kind="ghost"
          small
          onPress={() => switchTo(mode === 'keep' ? 'signin' : 'keep')}
          disabled={busy}
        />
      ) : null}
    </Screen>
  );
}
