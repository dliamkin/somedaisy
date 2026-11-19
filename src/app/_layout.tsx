import { Nunito_500Medium } from '@expo-google-fonts/nunito/500Medium';
import { Nunito_700Bold } from '@expo-google-fonts/nunito/700Bold';
import { Nunito_800ExtraBold } from '@expo-google-fonts/nunito/800ExtraBold';
import { Nunito_900Black } from '@expo-google-fonts/nunito/900Black';
import { useFonts } from 'expo-font';
import { router, Stack } from 'expo-router';
import { NavigationBar } from 'expo-navigation-bar';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { Launch } from '@/components/launch';
import { Loading } from '@/components/ui';
import { AppearanceProvider, paintFirstWebPage, useAppearance } from '@/lib/appearance';
import { onPushTapped, showPushesWhileOpen } from '@/lib/push';
import { SessionProvider } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import { steadyWebPage } from '@/lib/web-page';

// Once, when the website opens. Does nothing in the phone app.
steadyWebPage();
paintFirstWebPage();

export default function RootLayout() {
  // Light or dark mode for everything inside.
  return (
    <AppearanceProvider>
      <Root />
    </AppearanceProvider>
  );
}

function Root() {
  const { colors, dark } = useTheme();
  // On a phone, the saved choice of light or dark takes a moment to read.
  const { ready } = useAppearance();
  const [loaded] = useFonts({ Nunito_500Medium, Nunito_700Bold, Nunito_800ExtraBold, Nunito_900Black });

  // Tapping a notification opens the group it is about. Waits for the fonts so the screens can render.
  useEffect(() => {
    if (!loaded) return;
    void showPushesWhileOpen();
    return onPushTapped((route) => router.push(route as never));
  }, [loaded]);

  // In the phone app the opening screen stays for a moment, so the name can be read. Without
  // this the fonts are ready so fast that it would be gone before anyone saw it.
  const [opening, setOpening] = useState(Platform.OS !== 'web');
  useEffect(() => {
    const timer = setTimeout(() => setOpening(false), 1100);
    return () => clearTimeout(timer);
  }, []);

  // The opening screen also covers reading the saved mode, so the first real screen is never in the wrong one.
  if (Platform.OS !== 'web' && (!loaded || opening || !ready)) {
    return (
      <>
        <StatusBar style="light" />
        <Launch />
      </>
    );
  }
  // The website starts on whatever page was asked for, so it only waits, with no opening screen.
  if (!loaded) return <Loading />;
  return (
    <SessionProvider>
      {/* The phone's own bars follow the mode: dark words and buttons on a light page, light ones on a dark page. */}
      <StatusBar style={dark ? 'light' : 'dark'} />
      {/* Like the status bar, the style names the colour of the buttons, not of the bar behind them. */}
      {Platform.OS === 'android' ? <NavigationBar style={dark ? 'light' : 'dark'} /> : null}
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
    </SessionProvider>
  );
}
