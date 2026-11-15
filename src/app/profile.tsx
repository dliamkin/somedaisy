import { router } from 'expo-router';
import { useState } from 'react';
import { Switch, View } from 'react-native';

import { NameForm } from '@/components/name-form';
import { Avatar, Card, ErrorNote, Loading, Screen, T, TopBar } from '@/components/ui';
import { useSession } from '@/lib/session';
import { colors } from '@/lib/theme';

/** Change the name, avatar colour and photo friends see. */
export default function Profile() {
  const { ready, profile } = useSession();
  if (!ready) return <Loading />;

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <Screen>
      <TopBar title="Your name" backTo="/" />
      <T weight="medium" color={colors.muted}>
        This is how you show up to friends in every group.
      </T>
      <PhotoChoice />
      <NameForm cta="Save" onDone={back} initial={profile ?? undefined} />
    </Screen>
  );
}

/** For someone who has signed in with Google: whether their Google picture is their circle. */
function PhotoChoice() {
  const { profile, googlePhoto, showPhoto } = useSession();
  const [error, setError] = useState<string | null>(null);
  // What the switch says while the change is being saved.
  const [pending, setPending] = useState<boolean | null>(null);
  if (!profile || !googlePhoto) return null;

  const shown = pending ?? Boolean(profile.photo_url);
  const change = async (show: boolean) => {
    setPending(show);
    setError(null);
    try {
      await showPhoto(show);
    } catch {
      setError('Could not save that. Try again in a moment.');
    } finally {
      setPending(null);
    }
  };

  return (
    <>
      <Card style={{ padding: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Avatar name={profile.name} color={profile.color} photo={shown ? googlePhoto : null} size={44} />
          <View style={{ flex: 1, gap: 2 }}>
            <T size={16} weight="extra">
              Show my Google photo
            </T>
            <T size={14} weight="medium" color={colors.muted}>
              Friends see it in place of your initial.
            </T>
          </View>
          <Switch
            accessibilityLabel="Show my Google photo"
            value={shown}
            onValueChange={change}
            disabled={pending !== null}
            trackColor={{ false: colors.dash, true: colors.grape }}
            thumbColor={colors.white}
          />
        </View>
      </Card>
      <ErrorNote message={error} />
    </>
  );
}
