import { router } from 'expo-router';

import { NameForm } from '@/components/name-form';
import { Loading, Screen, T, TopBar } from '@/components/ui';
import { useSession } from '@/lib/session';
import { colors } from '@/lib/theme';

/** Change the name and avatar colour friends see. */
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
      <NameForm cta="Save" onDone={back} initial={profile ?? undefined} />
    </Screen>
  );
}
