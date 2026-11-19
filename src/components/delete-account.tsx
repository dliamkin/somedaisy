import { router } from 'expo-router';
import { useState } from 'react';

import { Button, Card, ErrorNote, T } from '@/components/ui';
import { deleteAccount } from '@/lib/account';
import { useSession } from '@/lib/session';
import { useTheme } from '@/lib/theme';

/**
 * "Delete my account", with a second step so it cannot happen by accident. For a guest, who has
 * no account to speak of, the words are about their data instead. Afterwards the app goes back
 * to its welcome screen, with nobody signed in.
 */
export function DeleteAccount({ guest, disabled }: { guest?: boolean; disabled?: boolean }) {
  const { colors } = useTheme();
  const { refresh } = useSession();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteAccount();
      await refresh();
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete it. Try again.');
      setBusy(false);
    }
  };

  if (!confirming) {
    return <Button label={guest ? 'Delete my data' : 'Delete my account'} kind="ghost" small onPress={() => setConfirming(true)} disabled={disabled} />;
  }
  return (
    <Card style={{ padding: 18, gap: 10 }}>
      <T size={16} weight="extra">
        {guest ? 'Delete everything of yours?' : 'Delete your account?'}
      </T>
      <T size={14} weight="medium" color={colors.textMuted}>
        {guest
          ? 'This removes your name, reactions and comments for good.'
          : 'This removes your name, email, picture, reactions and comments for good.'}{' '}
        Ideas you added stay in your groups for your friends, without your name on them. A group where you are the only member is deleted with
        everything in it.
      </T>
      <T size={14} weight="extra" color={colors.danger}>
        This cannot be undone.
      </T>
      <ErrorNote message={error} />
      <Button label={guest ? 'Delete my data' : 'Delete my account'} kind="danger" small onPress={remove} busy={busy} />
      <Button label={guest ? 'Keep my data' : 'Keep my account'} kind="ghost" small onPress={() => setConfirming(false)} disabled={busy} />
    </Card>
  );
}
