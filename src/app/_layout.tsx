import { Nunito_500Medium } from '@expo-google-fonts/nunito/500Medium';
import { Nunito_700Bold } from '@expo-google-fonts/nunito/700Bold';
import { Nunito_800ExtraBold } from '@expo-google-fonts/nunito/800ExtraBold';
import { Nunito_900Black } from '@expo-google-fonts/nunito/900Black';
import { useFonts } from 'expo-font';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { Loading } from '@/components/ui';
import { onPushTapped, showPushesWhileOpen } from '@/lib/push';
import { SessionProvider } from '@/lib/session';
import { colors } from '@/lib/theme';
import { steadyWebPage } from '@/lib/web-page';

// Once, when the website opens. Does nothing in the phone app.
steadyWebPage();

export default function RootLayout() {
  const [loaded] = useFonts({ Nunito_500Medium, Nunito_700Bold, Nunito_800ExtraBold, Nunito_900Black });

  // Tapping a notification opens the group it is about. Waits for the fonts so the screens can render.
  useEffect(() => {
    if (!loaded) return;
    void showPushesWhileOpen();
    return onPushTapped((route) => router.push(route as never));
  }, [loaded]);

  if (!loaded) return <Loading />;
  return (
    <SessionProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ground } }} />
    </SessionProvider>
  );
}
