// Whether the garden's sounds are on. They are off until someone turns them on, and the choice is
// kept on the device, not on the group or the account: one person may want birdsong on a tablet
// at home and quiet on a phone on the bus.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/** Where the choice is kept on the device. */
const KEY = 'somedaisy.garden.sound';

/** The saved choice. Off when nothing is saved, or the device will not say. */
export async function readSound(): Promise<boolean> {
  try {
    const saved = Platform.OS === 'web' ? globalThis.localStorage?.getItem(KEY) : await AsyncStorage.getItem(KEY);
    return saved === 'on';
  } catch {
    // Storage can be switched off in a browser. Then the sounds simply start off each time.
    return false;
  }
}

export function saveSound(on: boolean): void {
  const value = on ? 'on' : 'off';
  if (Platform.OS === 'web') {
    try {
      globalThis.localStorage?.setItem(KEY, value);
    } catch {
      // As above.
    }
    return;
  }
  AsyncStorage.setItem(KEY, value).catch(() => {});
}
