import {
  AccountError,
  claimTransfer,
  cleanCode,
  cleanEmail,
  confirmEmailForGuest,
  confirmSignIn,
  deleteAccount,
  isCode,
  isEmail,
  requestEmailForGuest,
  requestSignIn,
  signOut,
  startTransfer,
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

describe('bringing a guest\'s groups into an account', () => {
  function fakeRpc(result: { data?: unknown; error?: { message: string } | null } | Error) {
    const rpc = jest.fn(async (_name: string, _args?: unknown) => {
      if (result instanceof Error) throw result;
      return { data: null, error: null, ...result };
    });
    jest.mocked(db).mockReturnValue({ rpc } as never);
    return rpc;
  }

  it('asks for a pass while still the guest', async () => {
    const rpc = fakeRpc({ data: 'one-time-pass' });
    expect(await startTransfer()).toBe('one-time-pass');
    expect(rpc).toHaveBeenCalledWith('start_transfer');
  });

  it('gives no pass, without failing, when there is nothing to bring or the database refuses', async () => {
    fakeRpc({ data: null });
    expect(await startTransfer()).toBeNull();
    fakeRpc({ error: { message: 'function start_transfer() does not exist' } });
    expect(await startTransfer()).toBeNull();
    fakeRpc(new Error('network down'));
    expect(await startTransfer()).toBeNull();
  });

  it('hands the pass back after signing in and reports how many groups were added', async () => {
    const rpc = fakeRpc({ data: 2 });
    expect(await claimTransfer('one-time-pass')).toBe(2);
    expect(rpc).toHaveBeenCalledWith('claim_transfer', { p_token: 'one-time-pass' });
  });

  it('says so when the groups could not be moved', async () => {
    fakeRpc({ error: { message: 'That pass is not valid any more' } });
    await expect(claimTransfer('stale-pass')).rejects.toThrow('could not be moved over');
  });
});

describe('signOut', () => {
  it('signs out this device only', async () => {
    const auth = fakeAuth();
    await signOut();
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });
});

describe('deleteAccount', () => {
  function fakeDb(opts: { rpcError?: boolean; signOutThrows?: boolean } = {}) {
    const order: string[] = [];
    const rpc = jest.fn(async (name: string) => {
      order.push(name);
      return { data: null, error: opts.rpcError ? { message: 'function delete_account() does not exist' } : null };
    });
    const signOut = jest.fn(async (_opts: unknown) => {
      order.push('sign-out');
      if (opts.signOutThrows) throw new Error('network down');
      return { error: null };
    });
    jest.mocked(db).mockReturnValue({ rpc, auth: { signOut } } as never);
    return { order, rpc, signOut };
  }

  it('asks the database to delete the account, then clears the sign-in on this device only', async () => {
    const { order, rpc, signOut } = fakeDb();
    await deleteAccount();
    expect(rpc).toHaveBeenCalledWith('delete_account');
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(order).toEqual(['delete_account', 'sign-out']);
  });

  it('says so plainly when the account could not be deleted, and stays signed in', async () => {
    const { signOut } = fakeDb({ rpcError: true });
    await expect(deleteAccount()).rejects.toThrow('could not be deleted');
    await expect(deleteAccount()).rejects.toBeInstanceOf(AccountError);
    expect(signOut).not.toHaveBeenCalled();
  });

  it('still counts as deleted when the leftover sign-in cannot be cleared', async () => {
    fakeDb({ signOutThrows: true });
    await expect(deleteAccount()).resolves.toBeUndefined();
  });
});
