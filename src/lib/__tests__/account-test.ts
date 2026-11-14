import {
  AccountError,
  cleanCode,
  cleanEmail,
  confirmEmailForGuest,
  confirmSignIn,
  isCode,
  isEmail,
  requestEmailForGuest,
  requestSignIn,
  signOut,
  toAccountError,
} from '../account';
import { db } from '../supabase';

jest.mock('../supabase', () => ({ db: jest.fn() }));

type Failure = { message: string; code?: string; status?: number } | null;

/** A stand-in for Supabase auth. Every call succeeds unless `error` is given. */
function fakeAuth(error: Failure = null) {
  const auth = {
    updateUser: jest.fn(async (_attrs: unknown) => ({ error })),
    signInWithOtp: jest.fn(async (_creds: unknown) => ({ error })),
    verifyOtp: jest.fn(async (_params: unknown) => ({ error })),
    signOut: jest.fn(async (_opts: unknown) => ({ error })),
  };
  jest.mocked(db).mockReturnValue({ auth } as never);
  return auth;
}

describe('isEmail / cleanEmail', () => {
  it('accepts ordinary addresses, with spaces around them', () => {
    expect(isEmail('ann@example.com')).toBe(true);
    expect(isEmail('  ann.b+daisy@mail.example.co.uk ')).toBe(true);
  });

  it('rejects things that are not addresses', () => {
    for (const bad of ['', 'ann', 'ann@', '@example.com', 'ann@example', 'ann @example.com', 'ann@exa mple.com']) {
      expect(isEmail(bad)).toBe(false);
    }
  });

  it('trims and lower-cases, so the same address always matches', () => {
    expect(cleanEmail('  Ann@Example.COM ')).toBe('ann@example.com');
  });
});

describe('isCode / cleanCode', () => {
  it('keeps only the digits of a pasted code', () => {
    expect(cleanCode(' 123 456 ')).toBe('123456');
    expect(cleanCode('123-456')).toBe('123456');
  });

  it('needs at least six digits', () => {
    expect(isCode('12345')).toBe(false);
    expect(isCode('123456')).toBe(true);
    expect(isCode('1234 5678')).toBe(true);
    expect(isCode('abcdef')).toBe(false);
  });
});

describe('toAccountError', () => {
  const reasonFor = (code?: string, status?: number) => toAccountError({ message: 'raw message', code, status }).reason;

  it('recognises an email that already has an account', () => {
    expect(reasonFor('email_exists')).toBe('email-taken');
    expect(reasonFor('user_already_exists')).toBe('email-taken');
  });

  it('recognises an email with no account, as reported when sign-in may not create one', () => {
    expect(reasonFor('otp_disabled')).toBe('no-account');
    expect(reasonFor('user_not_found')).toBe('no-account');
  });

  it('recognises a wrong or expired code', () => {
    expect(reasonFor('otp_expired')).toBe('bad-code');
  });

  it('recognises rate limits, by code or by status', () => {
    expect(reasonFor('over_email_send_rate_limit')).toBe('too-many');
    expect(reasonFor(undefined, 429)).toBe('too-many');
  });

  it('passes an unknown error through with its own message', () => {
    const e = toAccountError({ message: 'Database is on fire', code: 'unexpected_failure', status: 500 });
    expect(e).toBeInstanceOf(AccountError);
    expect(e.reason).toBe('other');
    expect(e.message).toBe('Database is on fire');
  });

  it('never shows the raw message for a problem it knows', () => {
    expect(toAccountError({ message: 'raw message', code: 'otp_expired' }).message).not.toContain('raw message');
  });
});

describe('keeping a guest account', () => {
  it('attaches the cleaned email to the current guest', async () => {
    const auth = fakeAuth();
    await requestEmailForGuest(' Ann@Example.com ');
    expect(auth.updateUser).toHaveBeenCalledWith({ email: 'ann@example.com' });
    expect(auth.signInWithOtp).not.toHaveBeenCalled();
  });

  it('confirms with the email-change kind of code', async () => {
    const auth = fakeAuth();
    await confirmEmailForGuest('Ann@Example.com', '123 456');
    expect(auth.verifyOtp).toHaveBeenCalledWith({ email: 'ann@example.com', token: '123456', type: 'email_change' });
  });

  it('reports an email that is already taken', async () => {
    fakeAuth({ message: 'A user with this email address has already been registered', code: 'email_exists', status: 422 });
    await expect(requestEmailForGuest('ann@example.com')).rejects.toMatchObject({ reason: 'email-taken' });
  });
});

describe('signing in to an existing account', () => {
  it('asks for a code without ever creating a new account', async () => {
    const auth = fakeAuth();
    await requestSignIn(' Ann@Example.com ');
    expect(auth.signInWithOtp).toHaveBeenCalledWith({ email: 'ann@example.com', options: { shouldCreateUser: false } });
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it('confirms with the sign-in kind of code', async () => {
    const auth = fakeAuth();
    await confirmSignIn('ann@example.com', '123456');
    expect(auth.verifyOtp).toHaveBeenCalledWith({ email: 'ann@example.com', token: '123456', type: 'email' });
  });

  it('reports a wrong code', async () => {
    fakeAuth({ message: 'Token has expired or is invalid', code: 'otp_expired', status: 403 });
    await expect(confirmSignIn('ann@example.com', '000000')).rejects.toMatchObject({ reason: 'bad-code' });
  });
});

describe('signOut', () => {
  it('signs out this device only', async () => {
    const auth = fakeAuth();
    await signOut();
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });
});
