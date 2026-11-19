import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AppearanceRow } from '@/components/appearance-row';
import { DeleteAccount } from '@/components/delete-account';
import { GoogleButton, OrLine } from '@/components/google-button';
import { PrivacyLink } from '@/components/privacy-link';
import { Avatar, Button, Card, ErrorNote, Field, Loading, Screen, T, TopBar } from '@/components/ui';
import {
  AccountError,
  cleanEmail,
  confirmEmailForGuest,
  claimTransfer,
  confirmSignIn,
  isCode,
  isEmail,
  requestEmailForGuest,
  requestSignIn,
  signOut,
  startTransfer,
} from '@/lib/account';
import type { Profile } from '@/lib/data';
import { googleAvailable, signInWithGoogle } from '@/lib/google';
import { forgetDevice } from '@/lib/push';
import { useSession } from '@/lib/session';
import { useTheme } from '@/lib/theme';

// "keep" adds an email to the guest on this device. "signin" switches this device to an account that already exists.
type Mode = 'keep' | 'signin';

export default function Account() {
  const { ready, email, profile } = useSession();
  if (!ready) return <Loading />;
  return email ? <SignedIn email={email} /> : <Guest guest={profile} />;
}

function SignedIn({ email }: { email: string }) {
  const { colors } = useTheme();
  const { profile, refresh } = useSession();
  const { notice } = useLocalSearchParams<{ notice?: string }>();
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
      {notice === 'not-moved' ? (
        <ErrorNote message="You are signed in, but the groups from this device could not be moved over. Ask for a new invite link to rejoin them." />
      ) : null}
      <Card style={{ padding: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {profile ? <Avatar name={profile.name} color={profile.color} photo={profile.photo_url} size={44} /> : null}
          <View style={{ flex: 1, gap: 2 }}>
            <T size={18} weight="extra" lines={1}>
              {profile?.name ?? 'Signed in'}
            </T>
            <T size={14} color={colors.textMuted} lines={1}>
              {email}
            </T>
          </View>
        </View>
        <T size={14} weight="medium" color={colors.textMuted}>
          Your groups are saved to this email. Sign in with it on any phone or browser to see them.
        </T>
        <Button label="Change name or colour" kind="outline" small onPress={() => router.push('/profile' as never)} />
      </Card>
      <Button label="Notification settings" kind="outline" small onPress={() => router.push('/notifications' as never)} />
      <AppearanceRow />
      <ErrorNote message={error} />
      {confirming ? (
        <Card style={{ padding: 18 }}>
          <T size={16} weight="extra">
            Sign out on this device?
          </T>
          <T size={14} weight="medium" color={colors.textMuted}>
            Your groups stay safe. You will need a code sent to {email} to get back in.
          </T>
          <Button label="Sign out" small onPress={leave} busy={busy} />
          <Button label="Stay signed in" kind="ghost" small onPress={() => setConfirming(false)} disabled={busy} />
        </Card>
      ) : (
        <Button label="Sign out" kind="soft" onPress={() => setConfirming(true)} />
      )}
      <DeleteAccount disabled={busy} />
      <PrivacyLink />
    </Screen>
  );
}

const GOOGLE_FAILED = 'Signing in with Google did not finish. Try again, or use your email.';

function Guest({ guest }: { guest: Profile | null }) {
  const { colors } = useTheme();
  const hasProfile = Boolean(guest);
  const params = useLocalSearchParams<{ mode?: string }>();
  const { refresh } = useSession();
  // Someone who has not picked a name yet has nothing to keep, so they can only sign in.
  const [mode, setMode] = useState<Mode>(hasProfile && params.mode !== 'signin' ? 'keep' : 'signin');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleAttempt, setGoogleAttempt] = useState(0);
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

  // Google's pop-up has closed and told us who this is.
  const google = async (credential: string, rawNonce: string) => {
    if (busy || googleBusy) return;
    setGoogleBusy(true);
    setError(null);
    setTaken(false);
    try {
      const { moved } = await signInWithGoogle(credential, rawNonce, guest);
      await refresh();
      router.replace((moved ? '/' : '/account?notice=not-moved') as never);
    } catch (e) {
      fail(e, GOOGLE_FAILED);
      setGoogleBusy(false);
      // Google's note works once, so draw a fresh button for the next try.
      setGoogleAttempt((n) => n + 1);
    }
  };

  const confirm = async () => {
    if (!sentTo || !isCode(code) || busy) return;
    setBusy(true);
    setError(null);
    try {
      let moved = true;
      if (mode === 'keep') {
        await confirmEmailForGuest(sentTo, code);
      } else {
        // Signing in replaces the guest on this device. Take a pass first, so the account can
        // collect the guest's groups once it is signed in.
        const pass = hasProfile ? await startTransfer() : null;
        await confirmSignIn(sentTo, code);
        if (pass) moved = await claimTransfer(pass).then(() => true, () => false);
      }
      await refresh();
      router.replace((moved ? '/' : '/account?notice=not-moved') as never);
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
        <T weight="medium" color={colors.textMuted}>
          We sent a code to {sentTo}. It can take a minute to arrive, and it may land in spam.
        </T>
        <Field label="Code from the email" value={code} onChangeText={setCode} placeholder="123456" kind="code" maxLength={12} autoFocus onSubmit={confirm} />
        <ErrorNote message={error} />
        <Button label="Use a different email" kind="ghost" small onPress={() => switchTo(mode)} disabled={busy} />
      </Screen>
    );
  }

  return (
    <Screen footer={<Button label="Email me a code" onPress={() => send()} disabled={!isEmail(email) || googleBusy} busy={busy} />}>
      <TopBar title={mode === 'keep' ? 'Keep your groups' : 'Sign in'} backTo="/" />
      {/* Guests choose light or dark here too. It is kept on the device, so it needs no account. */}
      <AppearanceRow />
      <T weight="medium" color={colors.textMuted}>
        {mode === 'keep'
          ? `Right now your groups live only on this device. ${googleAvailable ? 'Continue with Google or add your email' : 'Add your email'} and you can get back to them from any phone or browser. No password needed.`
          : `${googleAvailable ? 'Continue with Google, or enter' : 'Enter'} the email you saved your account with. We will send you a code, no password needed.`}
      </T>
      {googleAvailable ? (
        <>
          <GoogleButton onCredential={google} busy={googleBusy} attempt={googleAttempt} />
          <OrLine />
        </>
      ) : null}
      <Field label="Your email" value={email} onChangeText={setEmail} placeholder="you@example.com" kind="email" maxLength={254} autoFocus={!googleAvailable} onSubmit={() => send()} />
      <ErrorNote message={error} />
      {taken && mode === 'keep' ? (
        <Card style={{ padding: 18 }}>
          <T size={16} weight="extra">
            Sign in to that account instead?
          </T>
          <T size={14} weight="medium" color={colors.textMuted}>
            You will see that account&apos;s groups, and the groups you joined as a guest on this device will come with you.
          </T>
          <Button label="Send me a sign-in code" small onPress={() => send('signin')} busy={busy} />
        </Card>
      ) : null}
      {mode === 'signin' && hasProfile ? (
        <T size={14} weight="medium" color={colors.textMuted}>
          Groups you joined as a guest on this device will come with you into the account.
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
      {hasProfile ? <Button label="Change name or colour" kind="ghost" small onPress={() => router.push('/profile' as never)} disabled={busy} /> : null}
      {hasProfile ? <DeleteAccount guest disabled={busy || googleBusy} /> : null}
      <PrivacyLink />
    </Screen>
  );
}
