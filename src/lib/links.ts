// Links people pass to each other.

import * as ExpoLinking from 'expo-linking';
import { Linking, Platform } from 'react-native';

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

/** The words sent along with an invite link, in a chat or wherever the person chooses to share it. */
export function inviteMessage(groupName: string | null | undefined, link: string): string {
  const name = groupName?.trim();
  return name ? `Join "${name}" on SomeDaisy: ${link}` : `Join my group on SomeDaisy: ${link}`;
}

/** The longest link and note an idea can carry. The database enforces the same limits (update 006). */
export const LINK_MAX = 2000;
export const NOTE_MAX = 1000;

const WEB_ADDRESS = /^https?:\/\/[^\s/?#:@]+\.[^\s/?#:@.]{2,}(:\d{1,5})?([/?#]\S*)?$/i;

/**
 * Tidy the link someone typed for an idea. People paste "youtube.com/watch..." without the
 * "https://", so that is added for them. Only ordinary web addresses are accepted: the link is
 * opened on friends' phones, so nothing that dials, texts or runs something gets through.
 * An empty box is fine and means no link.
 */
export function tidyLink(input: string): { ok: boolean; link: string | null } {
  const typed = input.trim();
  if (!typed) return { ok: true, link: null };
  const bad = { ok: false, link: null };
  let link = typed;
  if (/^https?:\/\//i.test(typed)) link = typed.replace(/^https?/i, (scheme) => scheme.toLowerCase());
  else if (/^[a-z][a-z0-9+.-]*:\/\//i.test(typed) || /^(mailto|tel|sms|javascript|data|file|intent|about|blob):/i.test(typed)) return bad;
  else link = `https://${typed}`;
  if (link.length > LINK_MAX || !WEB_ADDRESS.test(link)) return bad;
  return { ok: true, link };
}

/** Open an idea's link, if it is a web address. Links saved before they were tidied are tidied now. */
export function openLink(link: string): void {
  const tidy = tidyLink(link);
  if (!tidy.ok || !tidy.link) return;
  // A phone with no browser, or a blocked pop-up, is not worth an error on the screen.
  Promise.resolve(Linking.openURL(tidy.link)).catch(() => {});
}
