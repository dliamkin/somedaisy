import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Daisy } from '@/components/daisy';
import { NameForm } from '@/components/name-form';
import { Button, ErrorNote, Loading, Screen, T } from '@/components/ui';
import { joinGroup, previewGroup } from '@/lib/data';
import { useSession } from '@/lib/session';
import { colors, covers } from '@/lib/theme';

export default function Join() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { ready, error: sessionError, profile, userId, ensureUser } = useSession();
  const [preview, setPreview] = useState<{ name: string; cover: string; member_count: number } | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ready || !code) return;
    if (!userId) {
      // Opening an invite is what makes a visitor a guest: the group cannot be shown without one.
      ensureUser().catch((e: Error) => setError(e.message));
      return;
    }
    previewGroup(code)
      .then(setPreview)
      .catch((e: Error) => setError(e.message));
  }, [ready, userId, code, ensureUser]);

  const join = async () => {
    if (!code) return;
    setBusy(true);
    setError(null);
    try {
      const id = await joinGroup(code);
      router.replace(`/group/${id}` as never);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not join the group.');
      setBusy(false);
    }
  };

  if (!ready || (preview === undefined && !error && !sessionError)) return <Loading />;

  if (sessionError || preview === null || (preview === undefined && error)) {
    return (
      <Screen footer={<Button label="Go to SomeDaisy" kind="soft" onPress={() => router.replace('/')} />}>
        <T size={28} weight="black">
          {preview === null ? 'This invite link is not valid' : 'Could not connect'}
        </T>
        <T weight="medium" color={colors.muted}>
          {preview === null ? 'Ask your friend to send the link again.' : (sessionError ?? error)}
        </T>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ alignItems: 'center', gap: 6, marginTop: 12 }}>
        <View style={{ width: 88, height: 88, borderRadius: 28, backgroundColor: covers[preview?.cover ?? 'sky'] ?? colors.sky, alignItems: 'center', justifyContent: 'center' }}>
          <Daisy size={52} petal={colors.white} />
        </View>
        <T color={colors.muted} style={{ marginTop: 8 }}>
          You are invited to
        </T>
        <T size={34} weight="black" center>
          {preview?.name ?? 'a group'}
        </T>
        {preview ? (
          <T size={14} color={colors.muted}>
            {preview.member_count === 1 ? '1 person so far' : `${preview.member_count} people so far`}
          </T>
        ) : null}
      </View>
      <ErrorNote message={error} />
      {profile ? (
        <Button label="Join group" onPress={join} busy={busy} />
      ) : (
        <>
          <NameForm cta="Join group" onDone={join} />
          <T size={14} color={colors.muted} center>
            No account needed.
          </T>
        </>
      )}
    </Screen>
  );
}
