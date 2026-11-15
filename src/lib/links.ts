// Links people pass to each other.

import * as ExpoLinking from 'expo-linking';
import { Platform } from 'react-native';

/** Where the website lives. Links made on a phone point here, so they work for everyone. */
export const SITE = 'https://somedaisy.com';

/**
 * The link that invites someone to a group. It is always a web address: it opens the app on an
 * Android phone that has it (see intentFilters in app.json), and the website everywhere else.
 */
export function inviteLink(code: string): string {
  // On the website, use the address it is being served from, so trying it locally keeps working.
  if (Platform.OS === 'web') return ExpoLinking.createURL(`/join/${code}`);
  return `${SITE}/join/${code}`;
}
