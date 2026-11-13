import { Nunito_500Medium } from '@expo-google-fonts/nunito/500Medium';
import { Nunito_700Bold } from '@expo-google-fonts/nunito/700Bold';
import { Nunito_800ExtraBold } from '@expo-google-fonts/nunito/800ExtraBold';
import { Nunito_900Black } from '@expo-google-fonts/nunito/900Black';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { Loading } from '@/components/ui';
import { SessionProvider } from '@/lib/session';
import { colors } from '@/lib/theme';

export default function RootLayout() {
  const [loaded] = useFonts({ Nunito_500Medium, Nunito_700Bold, Nunito_800ExtraBold, Nunito_900Black });
  if (!loaded) return <Loading />;
  return (
    <SessionProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ground } }} />
    </SessionProvider>
  );
}
