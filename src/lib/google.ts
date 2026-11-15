// Sign in with Google, using Google's own button. Works on the web for now; phones need their
// own build first.
//
// Google's button opens a pop-up on this site and hands back a signed note saying who the person
// is. The app passes that note to Supabase, which signs them in. Nothing leaves the page, so the
// guest on this device can hand their groups straight to the account, as with an emailed code.
//
// Needs EXPO_PUBLIC_GOOGLE_CLIENT_ID in .env, and the same client ID listed under "Client IDs"
// on Supabase's Google provider page.

import { Platform } from 'react-native';

import { claimTransfer, startTransfer, toAccountError } from './account';
import type { Profile } from './data';
import { db } from './supabase';

export const googleClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? '';

export const googleAvailable = Platform.OS === 'web' && Boolean(googleClientId);

/** A one-time secret tying Google's note to this page: Google gets `hashed`, Supabase gets `raw`. */
export type Nonce = { raw: string; hashed: string };

export async function makeNonce(): Promise<Nonce> {
  const raw = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  const hashed = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  return { raw, hashed };
}

/** The part of Google's sign-in library the app uses. */
export type GoogleId = {
  initialize: (config: { client_id: string; callback: (response: { credential?: string }) => void; nonce: string }) => void;
  renderButton: (parent: HTMLElement, options: Record<string, string | number>) => void;
};

const SCRIPT = 'https://accounts.google.com/gsi/client';
let loading: Promise<GoogleId> | null = null;

const loaded = (): GoogleId | undefined => (window as unknown as { google?: { accounts?: { id?: GoogleId } } }).google?.accounts?.id;

/** Fetch Google's sign-in library, once. Fails when it is blocked or the connection is down. */
export function loadGoogle(): Promise<GoogleId> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return Promise.reject(new Error('Google sign-in works in the browser for now.'));
  loading ??= new Promise<GoogleId>((resolve, reject) => {
    const ready = loaded();
    if (ready) return resolve(ready);
    const script = document.createElement('script');
    script.src = SCRIPT;
    script.async = true;
    script.onload = () => {
      const id = loaded();
      if (id) resolve(id);
      else reject(new Error('Google sign-in did not load.'));
    };
    script.onerror = () => reject(new Error('Google sign-in did not load.'));
    document.head.appendChild(script);
  }).catch((e) => {
    loading = null; // let the next try fetch it again
    throw e;
  });
  return loading;
}

/**
 * Google has said who this is: sign in to their account, creating it the first time, and bring
 * along the groups of the guest on this device. `guest` is that guest's profile, if they have
 * picked a name. Returns whether the groups came along.
 */
export async function signInWithGoogle(credential: string, rawNonce: string, guest: Profile | null): Promise<{ moved: boolean }> {
  // Signing in replaces the guest on this device. Take a pass first, so the account can collect
  // the guest's groups once it is signed in.
  const pass = guest ? await startTransfer() : null;
  const { data, error } = await db().auth.signInWithIdToken({ provider: 'google', token: credential, nonce: rawNonce });
  if (error) throw toAccountError(error);
  const userId = data.user?.id;
  if (!pass || !guest) return { moved: true };
  if (!userId) return { moved: false };

  try {
    // Someone new to accounts has no name yet, and needs one to receive the guest's groups.
    const { data: existing } = await db().from('profiles').select('id').eq('id', userId).maybeSingle();
    if (!existing) await db().from('profiles').upsert({ id: userId, name: guest.name, color: guest.color });
    await claimTransfer(pass);
    return { moved: true };
  } catch {
    return { moved: false };
  }
}
