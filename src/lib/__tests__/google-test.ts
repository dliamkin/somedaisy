import { makeNonce, signInWithGoogle } from '../google';
import { db } from '../supabase';

jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));
jest.mock('../supabase', () => ({ db: jest.fn() }));

type Hash = { update: (text: string, encoding: 'utf8') => Hash; digest: (encoding: 'hex') => string };
const { createHash } = jest.requireActual<{ createHash: (algorithm: string) => Hash }>('node:crypto');

const guest = { id: 'guest', name: 'Denya', color: '#CDEFE0' };

/** A stand-in for Supabase. Records the order of what the app asks of it. */
function fakeDb(opts: {
  pass?: string | null;
  signInError?: { message: string; code?: string; status?: number };
  hasProfile?: boolean;
  moveError?: boolean;
  upsertThrows?: boolean;
} = {}) {
  const order: string[] = [];
  const signInWithIdToken = jest.fn(async (_creds: unknown) => {
    order.push('sign-in');
    return opts.signInError ? { data: { user: null }, error: opts.signInError } : { data: { user: { id: 'google-user' } }, error: null };
  });
  const upsert = jest.fn(async (_row: unknown) => {
    if (opts.upsertThrows) throw new Error('network down');
    order.push('name');
    return { error: null };
  });
  const from = jest.fn((_table: string) => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: opts.hasProfile ? { id: 'google-user' } : null, error: null }) }) }),
    upsert,
  }));
  const rpc = jest.fn(async (name: string, _args?: unknown) => {
    order.push(name);
    if (name === 'start_transfer') return { data: opts.pass === undefined ? 'one-time-pass' : opts.pass, error: null };
    return { data: 1, error: opts.moveError ? { message: 'That pass is not valid any more' } : null };
  });
  jest.mocked(db).mockReturnValue({ auth: { signInWithIdToken }, from, rpc } as never);
  return { order, signInWithIdToken, upsert, rpc };
}

describe('makeNonce', () => {
  it('gives Google the SHA-256 of what Supabase will be given', async () => {
    const { raw, hashed } = await makeNonce();
    expect(raw.length).toBeGreaterThan(40);
    expect(hashed).toBe(createHash('sha256').update(raw, 'utf8').digest('hex'));
  });

  it('is different every time', async () => {
    expect((await makeNonce()).raw).not.toBe((await makeNonce()).raw);
  });
});

describe('signInWithGoogle', () => {
  it('hands Google\'s note and the secret to Supabase', async () => {
    const { signInWithIdToken } = fakeDb();
    await signInWithGoogle('google-note', 'raw-secret', null);
    expect(signInWithIdToken).toHaveBeenCalledWith({ provider: 'google', token: 'google-note', nonce: 'raw-secret' });
  });

  it('takes the pass while still the guest, then signs in, names a new account, and moves the groups', async () => {
    const { order, upsert, rpc } = fakeDb();
    expect(await signInWithGoogle('google-note', 'raw-secret', guest)).toEqual({ moved: true });
    expect(order).toEqual(['start_transfer', 'sign-in', 'name', 'claim_transfer']);
    expect(upsert).toHaveBeenCalledWith({ id: 'google-user', name: 'Denya', color: '#CDEFE0' });
    expect(rpc).toHaveBeenLastCalledWith('claim_transfer', { p_token: 'one-time-pass' });
  });

  it('leaves the name alone on an account that already has one', async () => {
    const { order, upsert } = fakeDb({ hasProfile: true });
    expect(await signInWithGoogle('google-note', 'raw-secret', guest)).toEqual({ moved: true });
    expect(upsert).not.toHaveBeenCalled();
    expect(order).toEqual(['start_transfer', 'sign-in', 'claim_transfer']);
  });

  it('just signs in when nobody has picked a name on this device', async () => {
    const { order } = fakeDb();
    expect(await signInWithGoogle('google-note', 'raw-secret', null)).toEqual({ moved: true });
    expect(order).toEqual(['sign-in']);
  });

  it('still signs in when no pass can be had', async () => {
    const { order } = fakeDb({ pass: null });
    expect(await signInWithGoogle('google-note', 'raw-secret', guest)).toEqual({ moved: true });
    expect(order).toEqual(['start_transfer', 'sign-in']);
  });

  it('says the groups did not move when the pass is refused or the move breaks', async () => {
    fakeDb({ moveError: true });
    expect(await signInWithGoogle('google-note', 'raw-secret', guest)).toEqual({ moved: false });
    fakeDb({ upsertThrows: true });
    expect(await signInWithGoogle('google-note', 'raw-secret', guest)).toEqual({ moved: false });
  });

  it('fails, and moves nothing, when Supabase does not accept Google\'s note', async () => {
    const { order } = fakeDb({ signInError: { message: 'Unacceptable audience in id_token', status: 400 } });
    await expect(signInWithGoogle('google-note', 'raw-secret', guest)).rejects.toThrow('Unacceptable audience');
    expect(order).toEqual(['start_transfer', 'sign-in']);
  });
});
