// Sign in with Google. Works on the web for now; phones need their own build first.
//
// Signing in means leaving for Google and coming back, so the page is loaded afresh on return.
// Before leaving, the app notes what the guest on this device had (a one-time pass for their
// groups, their name and colour). On return it signs in with what Google sent back, then uses
// the note to bring the guest's groups into the account.

import type { SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { startTransfer, toAccountError } from './account';
import type { Profile } from './data';
import { db } from './supabase';

/** What went wrong on the way back from Google, if anything. */
export type GoogleNote = 'google-failed' | 'not-moved' | null;

type Pending = { pass: string | null; name: string | null; color: string | null; at: number };
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const KEY = 'somedaisy.google';
// A pass lasts 15 minutes; a note older than that is from a visit to Google that never came back.
const PENDING_MAX_AGE = 15 * 60 * 1000;

export const googleAvailable = Platform.OS === 'web';

// The address the page was opened with, read before the router has a chance to tidy it.
const landedAt = Platform.OS === 'web' && typeof window !== 'undefined' ? (window.location?.href ?? null) : null;

function tabStore(): Store | null {
  try {
    return Platform.OS === 'web' && typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

function takePending(store: Store, now: number): Pending | null {
  try {
    const raw = store.getItem(KEY);
    store.removeItem(KEY);
    const pending = raw ? (JSON.parse(raw) as Pending) : null;
    return pending && typeof pending.at === 'number' && now - pending.at < PENDING_MAX_AGE ? pending : null;
  } catch {
    return null;
  }
}

/** What Google and Supabase sent back, from both halves of the address. */
export function readReturn(url: string): { accessToken?: string; refreshToken?: string; failed: boolean } {
  let params = new URLSearchParams();
  try {
    const parsed = new URL(url);
    params = new URLSearchParams(parsed.hash.replace(/^#/, ''));
    parsed.searchParams.forEach((value, key) => {
      if (!params.has(key)) params.set(key, value);
    });
  } catch {
    return { failed: false };
  }
  return {
    accessToken: params.get('access_token') ?? undefined,
    refreshToken: params.get('refresh_token') ?? undefined,
    failed: params.has('error') || params.has('error_code'),
  };
}

/**
 * Leave for Google. On the web this replaces the page, so nothing after it runs when all is well.
 * `guest` is the profile of the guest on this device, if they have picked a name.
 */
export async function startGoogle(guest: Profile | null, store: Store | null = tabStore()): Promise<void> {
  if (!googleAvailable || !store || typeof window === 'undefined') {
    throw new Error('Signing in with Google works in the browser for now.');
  }
  // Signing in replaces the guest on this device. Take a pass first, so the account can collect
  // the guest's groups once it is signed in.
  const pass = guest ? await startTransfer() : null;
  const pending: Pending = { pass, name: guest?.name ?? null, color: guest?.color ?? null, at: Date.now() };
  store.setItem(KEY, JSON.stringify(pending));
  const { error } = await db().auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}${guest ? '/account' : '/'}` },
  });
  if (error) {
    store.removeItem(KEY);
    throw toAccountError(error);
  }
}

/**
 * Back from Google: sign in with what came back and bring the guest's groups along.
 * Does nothing unless this tab left for Google a moment ago. Never throws.
 */
export async function finishGoogle(
  client: SupabaseClient,
  url: string | null = landedAt,
  store: Store | null = tabStore(),
  now: number = Date.now(),
): Promise<GoogleNote> {
  if (!url || !store) return null;
  const pending = takePending(store, now);
  if (!pending) return null;

  const back = readReturn(url);
  if (!back.accessToken || !back.refreshToken) return back.failed ? 'google-failed' : null;

  let userId: string;
  try {
    const { data, error } = await client.auth.setSession({ access_token: back.accessToken, refresh_token: back.refreshToken });
    if (error || !data.session?.user) return 'google-failed';
    userId = data.session.user.id;
  } catch {
    return 'google-failed';
  }
  hideTokens();
  if (!pending.pass) return null;

  try {
    // Someone new to accounts has no name yet, and needs one to receive the guest's groups.
    if (pending.name && pending.color) {
      const { data: existing } = await client.from('profiles').select('id').eq('id', userId).maybeSingle();
      if (!existing) await client.from('profiles').upsert({ id: userId, name: pending.name, color: pending.color });
    }
    const { error: moveError } = await client.rpc('claim_transfer', { p_token: pending.pass });
    return moveError ? 'not-moved' : null;
  } catch {
    return 'not-moved';
  }
}

/** Take the sign-in details out of the address bar and the browser's history. */
function hideTokens(): void {
  try {
    if (typeof window !== 'undefined' && window.location.hash.includes('access_token')) {
      window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
    }
  } catch {
    // Leaving the address as it is does no harm beyond looks.
  }
}
