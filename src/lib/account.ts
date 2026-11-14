// Email accounts. Everyone starts as a guest; adding an email turns that same guest into a
// real account, so their groups come along and they can sign in again on another device.
// There are no passwords: Supabase emails a short code and the person types it in.

import { db } from './supabase';

/** A problem the person can do something about, with the reason kept for the screen to act on. */
export class AccountError extends Error {
  constructor(
    message: string,
    readonly reason: 'email-taken' | 'no-account' | 'bad-code' | 'too-many' | 'other',
  ) {
    super(message);
    this.name = 'AccountError';
  }
}

type AuthFailure = { message: string; code?: string; status?: number };

/** Turn a Supabase auth error into words for the screen. */
export function toAccountError(error: AuthFailure): AccountError {
  switch (error.code) {
    case 'email_exists':
    case 'user_already_exists':
    case 'identity_already_exists':
      return new AccountError('That email already has an account.', 'email-taken');
    case 'otp_disabled':
    case 'signup_disabled':
    case 'user_not_found':
      // With "create the user if missing" turned off, Supabase answers this way for an unknown email.
      return new AccountError('There is no account with that email yet.', 'no-account');
    case 'otp_expired':
      return new AccountError('That code is wrong or has expired. Check it, or ask for a new one.', 'bad-code');
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return new AccountError('Too many tries. Wait a minute, then try again.', 'too-many');
    case 'email_address_invalid':
    case 'validation_failed':
      return new AccountError('That does not look like an email address.', 'other');
    case 'email_address_not_authorized':
      return new AccountError('Emails cannot be sent to that address yet. The app needs its own email service set up.', 'other');
    default:
      return new AccountError(error.status === 429 ? 'Too many tries. Wait a minute, then try again.' : error.message, error.status === 429 ? 'too-many' : 'other');
  }
}

function check(error: AuthFailure | null): void {
  if (error) throw toAccountError(error);
}

export function cleanEmail(input: string): string {
  return input.trim().toLowerCase();
}

/** A light check that catches typos; Supabase has the final say. */
export function isEmail(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.trim());
}

/** Codes are digits only; people paste them with spaces or dashes. */
export function cleanCode(input: string): string {
  return input.replace(/\D/g, '');
}

export function isCode(input: string): boolean {
  return cleanCode(input).length >= 6;
}

/** Step 1 of keeping a guest's groups: attach an email to the guest. Supabase emails a code. */
export async function requestEmailForGuest(email: string): Promise<void> {
  const { error } = await db().auth.updateUser({ email: cleanEmail(email) });
  check(error);
}

/** Step 2: the code proves the email is theirs. The guest becomes a real account with the same id. */
export async function confirmEmailForGuest(email: string, code: string): Promise<void> {
  const { error } = await db().auth.verifyOtp({ email: cleanEmail(email), token: cleanCode(code), type: 'email_change' });
  check(error);
}

/** Step 1 of signing in to an account that already exists. Never creates a new account. */
export async function requestSignIn(email: string): Promise<void> {
  const { error } = await db().auth.signInWithOtp({ email: cleanEmail(email), options: { shouldCreateUser: false } });
  check(error);
}

/** Step 2: the code signs this device in to the account, replacing the guest it had before. */
export async function confirmSignIn(email: string, code: string): Promise<void> {
  const { error } = await db().auth.verifyOtp({ email: cleanEmail(email), token: cleanCode(code), type: 'email' });
  check(error);
}

/**
 * Before a guest signs in to an existing account: get a one-time pass that lets the account
 * collect the guest's groups afterwards. Returns null when there is nothing to bring or the pass
 * cannot be had; signing in must still go ahead in that case.
 */
export async function startTransfer(): Promise<string | null> {
  try {
    const { data, error } = await db().rpc('start_transfer');
    return error || typeof data !== 'string' || !data ? null : data;
  } catch {
    return null;
  }
}

/** After signing in: move the guest's groups, ideas and reactions into the account. Returns how many groups were added. */
export async function claimTransfer(pass: string): Promise<number> {
  const { data, error } = await db().rpc('claim_transfer', { p_token: pass });
  if (error) throw new AccountError('Your groups from this device could not be moved over.', 'other');
  return typeof data === 'number' ? data : 0;
}

/** Sign out on this device only. The app then starts a fresh guest. */
export async function signOut(): Promise<void> {
  const { error } = await db().auth.signOut({ scope: 'local' });
  check(error);
}
