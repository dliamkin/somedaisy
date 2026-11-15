import { finishGoogle, readReturn, startGoogle } from '../google';
import { db } from '../supabase';

jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));
jest.mock('../supabase', () => ({ db: jest.fn() }));

const KEY = 'somedaisy.google';
const NOW = 1_800_000_000_000;
const BACK = 'https://somedaisy.com/account#access_token=AT&refresh_token=RT&token_type=bearer';

/** A stand-in for the browser tab's storage. */
function fakeStore(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
}

const pending = (over: object = {}) =>
  JSON.stringify({ pass: 'one-time-pass', name: 'Denya', color: '#CDEFE0', at: NOW - 30_000, ...over });

/** A stand-in for Supabase on the way back from Google. */
function fakeClient(opts: { sessionError?: boolean; hasProfile?: boolean; moveError?: boolean; moveThrows?: boolean } = {}) {
  const auth = {
    setSession: jest.fn(async (_tokens: unknown) =>
      opts.sessionError ? { data: { session: null }, error: { message: 'bad token' } } : { data: { session: { user: { id: 'google-user' } } }, error: null },
    ),
  };
  const upsert = jest.fn(async (_row: unknown) => ({ error: null }));
  const from = jest.fn((_table: string) => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: opts.hasProfile ? { id: 'google-user' } : null, error: null }) }) }),
    upsert,
  }));
  const rpc = jest.fn(async (_name: string, _args: unknown) => {
    if (opts.moveThrows) throw new Error('network down');
    return { data: 1, error: opts.moveError ? { message: 'That pass is not valid any more' } : null };
  });
  return { client: { auth, from, rpc } as never, auth, upsert, rpc };
}

describe('readReturn', () => {
  it('finds the sign-in details after the #', () => {
    expect(readReturn(BACK)).toEqual({ accessToken: 'AT', refreshToken: 'RT', failed: false });
  });

  it('notices a refusal, wherever it is put', () => {
    expect(readReturn('https://somedaisy.com/account?error=access_denied&error_code=access_denied').failed).toBe(true);
    expect(readReturn('https://somedaisy.com/account#error=server_error&error_description=Oops').failed).toBe(true);
  });

  it('finds nothing in an ordinary address, or in nonsense', () => {
    expect(readReturn('https://somedaisy.com/account?mode=signin')).toEqual({ accessToken: undefined, refreshToken: undefined, failed: false });
    expect(readReturn('not an address')).toEqual({ failed: false });
  });
});

describe('startGoogle', () => {
  const origin = 'https://somedaisy.com';
  let realWindow: unknown;

  beforeEach(() => {
    realWindow = (globalThis as { window?: unknown }).window;
    (globalThis as { window?: unknown }).window = { location: { origin } };
  });
  afterEach(() => {
    (globalThis as { window?: unknown }).window = realWindow;
  });

  function fakeDb(opts: { pass?: string | null; oauthError?: { message: string; status?: number } } = {}) {
    const rpc = jest.fn(async (_name: string) => ({ data: opts.pass ?? null, error: null }));
    const signInWithOAuth = jest.fn(async (_creds: unknown) => ({ error: opts.oauthError ?? null }));
    jest.mocked(db).mockReturnValue({ rpc, auth: { signInWithOAuth } } as never);
    return { rpc, signInWithOAuth };
  }

  it('takes a pass for the guest, notes their name, then leaves for Google', async () => {
    const { rpc, signInWithOAuth } = fakeDb({ pass: 'one-time-pass' });
    const store = fakeStore();
    await startGoogle({ id: 'guest', name: 'Denya', color: '#CDEFE0' }, store);
    expect(rpc).toHaveBeenCalledWith('start_transfer');
    expect(JSON.parse(store.items.get(KEY) as string)).toMatchObject({ pass: 'one-time-pass', name: 'Denya', color: '#CDEFE0' });
    expect(signInWithOAuth).toHaveBeenCalledWith({ provider: 'google', options: { redirectTo: `${origin}/account` } });
  });

  it('asks for no pass when nobody has picked a name on this device', async () => {
    const { rpc, signInWithOAuth } = fakeDb();
    const store = fakeStore();
    await startGoogle(null, store);
    expect(rpc).not.toHaveBeenCalled();
    expect(JSON.parse(store.items.get(KEY) as string)).toMatchObject({ pass: null, name: null });
    expect(signInWithOAuth).toHaveBeenCalledWith({ provider: 'google', options: { redirectTo: `${origin}/` } });
  });

  it('forgets the note and says so when it cannot leave for Google', async () => {
    fakeDb({ oauthError: { message: 'Unsupported provider' } });
    const store = fakeStore();
    await expect(startGoogle(null, store)).rejects.toThrow('Unsupported provider');
    expect(store.items.has(KEY)).toBe(false);
  });
});

describe('finishGoogle', () => {
  it('does nothing on an ordinary visit, even if the address carries sign-in details', async () => {
    const { client, auth } = fakeClient();
    expect(await finishGoogle(client, BACK, fakeStore(), NOW)).toBeNull();
    expect(auth.setSession).not.toHaveBeenCalled();
  });

  it('signs in, gives a new account the guest\'s name, and brings the groups along', async () => {
    const { client, auth, upsert, rpc } = fakeClient();
    const store = fakeStore({ [KEY]: pending() });
    expect(await finishGoogle(client, BACK, store, NOW)).toBeNull();
    expect(auth.setSession).toHaveBeenCalledWith({ access_token: 'AT', refresh_token: 'RT' });
    expect(upsert).toHaveBeenCalledWith({ id: 'google-user', name: 'Denya', color: '#CDEFE0' });
    expect(rpc).toHaveBeenCalledWith('claim_transfer', { p_token: 'one-time-pass' });
    expect(store.items.has(KEY)).toBe(false);
  });

  it('leaves the name alone on an account that already has one', async () => {
    const { client, upsert, rpc } = fakeClient({ hasProfile: true });
    expect(await finishGoogle(client, BACK, fakeStore({ [KEY]: pending() }), NOW)).toBeNull();
    expect(upsert).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('just signs in when there was no guest to bring', async () => {
    const { client, auth, upsert, rpc } = fakeClient();
    expect(await finishGoogle(client, BACK, fakeStore({ [KEY]: pending({ pass: null, name: null, color: null }) }), NOW)).toBeNull();
    expect(auth.setSession).toHaveBeenCalledTimes(1);
    expect(upsert).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('says the groups did not move when the pass is refused or the move breaks', async () => {
    expect(await finishGoogle(fakeClient({ moveError: true }).client, BACK, fakeStore({ [KEY]: pending() }), NOW)).toBe('not-moved');
    expect(await finishGoogle(fakeClient({ moveThrows: true }).client, BACK, fakeStore({ [KEY]: pending() }), NOW)).toBe('not-moved');
  });

  it('says Google did not finish when it was refused there, and stays the guest', async () => {
    const { client, auth } = fakeClient();
    const url = 'https://somedaisy.com/account?error=access_denied&error_description=cancelled';
    expect(await finishGoogle(client, url, fakeStore({ [KEY]: pending() }), NOW)).toBe('google-failed');
    expect(auth.setSession).not.toHaveBeenCalled();
  });

  it('says Google did not finish when the details that came back do not work', async () => {
    const { client, rpc } = fakeClient({ sessionError: true });
    expect(await finishGoogle(client, BACK, fakeStore({ [KEY]: pending() }), NOW)).toBe('google-failed');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('ignores a note left by a visit to Google that never came back', async () => {
    const { client, auth } = fakeClient();
    const store = fakeStore({ [KEY]: pending({ at: NOW - 16 * 60 * 1000 }) });
    expect(await finishGoogle(client, BACK, store, NOW)).toBeNull();
    expect(auth.setSession).not.toHaveBeenCalled();
    expect(store.items.has(KEY)).toBe(false);
  });

  it('is quiet when the person simply came back without signing in', async () => {
    const { client } = fakeClient();
    expect(await finishGoogle(client, 'https://somedaisy.com/account', fakeStore({ [KEY]: pending() }), NOW)).toBeNull();
  });
});
