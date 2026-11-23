// Push notifications for phones. The database decides when to send one (see
// supabase/updates/001-push-notifications.sql); this file only gets permission, tells the
// database which phone belongs to whom, and opens the right group when a push is tapped.
//
// Pushes need a real build of the app. They are not available on the web or inside Expo Go,
// so every function here quietly does nothing there.

import { isRunningInExpoGo } from 'expo';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { supabase } from './supabase';

/**
 * unavailable: this device cannot get pushes (web, Expo Go).
 * ask: the person has not been asked yet.
 * on: allowed.
 * blocked: refused; only the phone's settings can change it now.
 */
export type PushState = 'unavailable' | 'ask' | 'on' | 'blocked';

type Permissions = { granted: boolean; canAskAgain: boolean; ios?: { status?: number | null } | null };

// iOS can deliver quietly without having asked ("provisional"), which counts as allowed.
const IOS_PROVISIONAL = 3;

export function stateFromPermissions(p: Permissions): PushState {
  if (p.granted || p.ios?.status === IOS_PROVISIONAL) return 'on';
  return p.canAskAgain ? 'ask' : 'blocked';
}

/**
 * The in-app path a tapped push should open, or null if it does not carry one we trust.
 * A push always names a group; one about a comment also names the idea, and opens its comments.
 */
export function routeFromPush(data: unknown): string | null {
  const { url, idea } = (data ?? {}) as { url?: unknown; idea?: unknown };
  if (typeof url !== 'string' || !/^\/group\/[0-9a-f-]{36}$/i.test(url)) return null;
  return typeof idea === 'string' && /^[0-9a-f-]{36}$/i.test(idea) ? `${url}/comments?idea=${idea}` : url;
}

/** The phone's time zone, e.g. "America/New_York", so dates in a push read in local time. */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export const pushAvailable = Platform.OS !== 'web' && !isRunningInExpoGo();

// Loaded only when needed, so the web and Expo Go never touch the native module.
const notifications = () => import('expo-notifications');

let knownToken: string | null = null;

export async function getPushState(): Promise<PushState> {
  if (!pushAvailable) return 'unavailable';
  const N = await notifications();
  return stateFromPermissions(await N.getPermissionsAsync());
}

async function deviceToken(): Promise<string> {
  if (knownToken) return knownToken;
  const N = await notifications();
  if (Platform.OS === 'android') {
    // Android shows nothing, and gives no token, until a channel exists.
    await N.setNotificationChannelAsync('default', {
      name: 'Groups and plans',
      importance: N.AndroidImportance.DEFAULT,
    });
  }
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) throw new Error('Notifications are not set up for this build yet.');
  knownToken = (await N.getExpoPushTokenAsync({ projectId })).data;
  return knownToken;
}

/** Tell the database this phone belongs to the signed-in person. */
async function registerDevice(): Promise<void> {
  if (!supabase) return;
  const token = await deviceToken();
  const { error } = await supabase.rpc('register_push_token', {
    p_token: token,
    p_platform: Platform.OS,
    p_timezone: deviceTimeZone(),
  });
  if (error) throw new Error(error.message);
}

/** Ask for permission if needed and register the phone. Returns the state afterwards. */
export async function enablePush(): Promise<PushState> {
  if (!pushAvailable) return 'unavailable';
  const N = await notifications();
  let permissions = await N.getPermissionsAsync();
  if (stateFromPermissions(permissions) === 'ask') permissions = await N.requestPermissionsAsync();
  const state = stateFromPermissions(permissions);
  if (state === 'on') await registerDevice();
  return state;
}

/**
 * Keep the database in step when the app starts or a different person signs in.
 * Never asks for permission and never fails loudly: notifications are a nicety.
 */
export async function syncPush(): Promise<void> {
  try {
    if ((await getPushState()) === 'on') await registerDevice();
  } catch {
    // Offline, or the update SQL has not been run yet. Try again next launch.
  }
}

/** Stop pushes to this phone for the person who is about to sign out. */
export async function forgetDevice(): Promise<void> {
  try {
    if (!supabase || (await getPushState()) !== 'on') return;
    await supabase.rpc('unregister_push_token', { p_token: await deviceToken() });
  } catch {
    // Signing out must still work without a connection.
  }
}

/** Which notifications a person wants. These follow the person, not the phone. */
export type NotificationSettings = {
  /** Someone reacted to an idea I added. */
  reactions: boolean;
  /** Someone commented on an idea I added. */
  comments: boolean;
  /** A plan is about two hours away. */
  reminders: boolean;
  /** A friend watered an idea I have not voted on, in the garden. */
  nudges: boolean;
};

export const defaultNotificationSettings: NotificationSettings = { reactions: true, comments: true, reminders: true, nudges: true };

/**
 * Said when nudges cannot be switched off because the database does not have update 024. It names
 * the update on purpose: only whoever looks after the database can put this right.
 */
export const NO_NUDGES = 'Nudges cannot be switched off yet. The database is missing update 024 (nudges).';

/** The signed-in person's choices. Someone who never chose has everything on. */
export async function getNotificationSettings(): Promise<NotificationSettings> {
  if (!supabase) return defaultNotificationSettings;
  const { data, error } = await supabase.from('notification_settings').select('*').maybeSingle();
  if (error) throw new Error(error.message);
  return {
    reactions: data?.reactions !== false,
    comments: data?.comments !== false,
    reminders: data?.reminders !== false,
    nudges: data?.nudges !== false,
  };
}

export async function saveNotificationSettings(settings: NotificationSettings): Promise<void> {
  if (!supabase) throw new Error('Not connected.');
  const choices = { p_reactions: settings.reactions, p_reminders: settings.reminders, p_comments: settings.comments };
  let { error } = await supabase.rpc('set_notification_settings', { ...choices, p_nudges: settings.nudges });
  // PGRST202 is the database saying it has no function that takes the choice about nudges:
  // update 024 has not been run. The other choices are still saved. Nudges cannot be sent
  // without that update either, so only switching them off is worth an error.
  if (error && (error as { code?: string }).code === 'PGRST202') {
    ({ error } = await supabase.rpc('set_notification_settings', choices));
    if (!error && !settings.nudges) throw new Error(NO_NUDGES);
  }
  if (error) throw new Error(error.message);
}

/** Show pushes that arrive while the app is open, instead of swallowing them. Call once at start-up. */
export async function showPushesWhileOpen(): Promise<void> {
  if (!pushAvailable) return;
  const N = await notifications();
  N.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Open the group a push is about when it is tapped, including the tap that launched the app.
 * Returns a function that stops listening.
 */
export function onPushTapped(open: (route: string) => void): () => void {
  if (!pushAvailable) return () => {};
  let stopped = false;
  let subscription: { remove: () => void } | null = null;
  void notifications().then((N) => {
    if (stopped) return;
    const handle = (data: unknown) => {
      const route = routeFromPush(data);
      if (route) open(route);
      N.clearLastNotificationResponse();
    };
    const launchedBy = N.getLastNotificationResponse();
    if (launchedBy) handle(launchedBy.notification.request.content.data);
    subscription = N.addNotificationResponseReceivedListener((response) => handle(response.notification.request.content.data));
  });
  return () => {
    stopped = true;
    subscription?.remove();
  };
}
