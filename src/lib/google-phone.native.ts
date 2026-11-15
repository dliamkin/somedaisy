// Sign in with Google inside the phone app (Android for now). The website has its own way, in
// google.ts and google-button.tsx.
//
// Android shows its own "choose an account" sheet and hands back the same kind of signed note the
// website gets from Google's button, so the rest of signing in is shared (signInWithGoogle).
//
// Needs, once, in the same Google Cloud project as the website's client ID: an OAuth client of
// type Android with the app's package name and the SHA-1 of the key the build is signed with.
// Without it Android refuses, or closes the sheet as if the person had cancelled.

import * as Crypto from 'expo-crypto';

import { googleClientId } from './google';

export type GoogleAnswer = { credential: string; rawNonce: string };

/**
 * Ask the person which Google account to use. Gives back Google's signed note and the secret
 * that goes with it, or null if they closed the sheet without choosing.
 */
export async function askGoogle(): Promise<GoogleAnswer | null> {
  // Loaded only when asked for, so a build without Google's library still opens the screen.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { GoogleOneTapSignIn, isSuccessResponse } = require('react-native-nitro-google-signin') as typeof import('react-native-nitro-google-signin');

  // A one-time secret tying Google's note to this try: Google gets the hash, Supabase gets the
  // secret itself, and checks one against the other.
  const rawNonce = Array.from(Crypto.getRandomBytes(32), (b) => b.toString(16).padStart(2, '0')).join('');
  const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

  // The ID is the website's ("Web application") one: it is who the note is addressed to, and the
  // one Supabase already accepts.
  GoogleOneTapSignIn.configure({ webClientId: googleClientId, nonce: hashed });
  await GoogleOneTapSignIn.checkPlayServices();
  const response = await GoogleOneTapSignIn.presentExplicitSignIn();
  if (!isSuccessResponse(response)) return null;
  return { credential: response.data.idToken, rawNonce };
}
