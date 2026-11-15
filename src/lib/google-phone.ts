// The website's stand-in for google-phone.native.ts, which is what phones load instead of this
// file. The website signs in with Google's own button (google-button.tsx) and never calls this.

export type GoogleAnswer = { credential: string; rawNonce: string };

export async function askGoogle(): Promise<GoogleAnswer | null> {
  throw new Error('This way of signing in with Google is for the phone app.');
}
