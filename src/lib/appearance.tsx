// Light and dark mode: which one the app is drawn in, and the person's choice between
// following the device (Auto), always light, or always dark.
//
// The choice is kept on the device, not on the account: someone may want dark on a phone and
// light on a laptop, and a guest has no account to keep it on. The colours themselves are in
// theme.ts. This file only decides which set every screen gets from `useTheme()`.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SystemUI from 'expo-system-ui';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Platform, useColorScheme } from 'react-native';

import { darkTheme, lightTheme, schemeFor, ThemeContext, toAppearance, type Appearance, type Theme } from './theme';
import { paintWebPage } from './web-page';

/** Where the choice is kept on the device. */
const KEY = 'somedaisy.appearance';

/** The website can read the saved choice at once. A phone has to ask for it (see the provider). */
function savedOnWeb(): Appearance {
  try {
    return toAppearance(globalThis.localStorage?.getItem(KEY));
  } catch {
    // Storage can be switched off in a browser. Then the choice is simply not kept.
    return 'auto';
  }
}

function save(choice: Appearance): void {
  if (Platform.OS === 'web') {
    try {
      globalThis.localStorage?.setItem(KEY, choice);
    } catch {
      // As above.
    }
    return;
  }
  AsyncStorage.setItem(KEY, choice).catch(() => {});
}

/** The parts of the device outside the app's own screens that should match the mode. */
function paintAround(theme: Theme): void {
  if (Platform.OS === 'web') paintWebPage(theme.colors.background, theme.dark);
  // On a phone: what shows behind the screens, such as while one slides over another.
  else SystemUI.setBackgroundColorAsync(theme.colors.background).catch(() => {});
}

/**
 * Website only, and before anything is drawn: colour the page behind the app in the mode the
 * person will get, so it does not start in one mode and jump to the other.
 */
export function paintFirstWebPage(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  const system = window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  paintAround(schemeFor(savedOnWeb(), system) === 'dark' ? darkTheme : lightTheme);
}

type AppearanceState = {
  /** What the person chose: follow the device, always light, or always dark. */
  choice: Appearance;
  /** Change it. Takes effect at once and is remembered on this device. */
  choose: (choice: Appearance) => void;
  /** False for a moment on a phone, until the saved choice has been read. */
  ready: boolean;
};

const AppearanceContext = createContext<AppearanceState>({ choice: 'auto', choose: () => {}, ready: true });

/** The person's choice of mode, and the way to change it. */
export function useAppearance(): AppearanceState {
  return useContext(AppearanceContext);
}

/** Wraps the whole app. Everything inside gets its colours for the right mode from `useTheme()`. */
export function AppearanceProvider({ children }: { children: ReactNode }) {
  // What the phone or the browser is set to. It changes live when the person changes it there.
  const system = useColorScheme();
  const [choice, setChoice] = useState<Appearance>(() => (Platform.OS === 'web' ? savedOnWeb() : 'auto'));
  const [ready, setReady] = useState(Platform.OS === 'web');

  // A phone's storage cannot be read in one go, so the saved choice arrives a moment after the
  // app starts. The opening screen stays up until it has (see _layout.tsx), so the first real
  // screen is already in the right mode.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let alive = true;
    AsyncStorage.getItem(KEY).then(
      (saved) => {
        if (!alive) return;
        setChoice(toAppearance(saved));
        setReady(true);
      },
      () => alive && setReady(true),
    );
    return () => {
      alive = false;
    };
  }, []);

  const theme = schemeFor(choice, system) === 'dark' ? darkTheme : lightTheme;
  useEffect(() => paintAround(theme), [theme]);

  const choose = (next: Appearance) => {
    setChoice(next);
    save(next);
  };

  return (
    <AppearanceContext.Provider value={{ choice, choose, ready }}>
      <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
    </AppearanceContext.Provider>
  );
}

/** Draws what is inside it in light mode whatever the app's mode, for a picture that is shared with other people. */
export function AlwaysLight({ children }: { children: ReactNode }) {
  return <ThemeContext.Provider value={lightTheme}>{children}</ThemeContext.Provider>;
}
