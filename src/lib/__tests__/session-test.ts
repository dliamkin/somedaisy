import { readSession } from '../session';

jest.mock('../supabase', () => ({ supabase: null, isConfigured: false }));
jest.mock('../push', () => ({ syncPush: jest.fn() }));

type Failure = { message: string; code?: string; status?: number };
type Profile = { id: string; name: string; color: string };

const session = (id: string, extra: object = {}) => ({ user: { id, is_anonymous: true, email: null, ...extra } });

/**
 * A stand-in for Supabase. `saved` is the sign-in kept on the device, `profiles` the names the
 * database knows, and `getUserError` what the server says when asked whether the user still exists.
 */
function fakeClient(opts: { saved?: ReturnType<typeof session> | null; profiles?: Profile[]; getUserError?: Failure | null }) {
  let current = opts.saved ?? null;
  const auth = {
    getSession: jest.fn(async () => ({ data: { session: current } })),
    getUser: jest.fn(async () => ({ error: opts.getUserError ?? null })),
    signOut: jest.fn(async (_opts: unknown) => {
      current = null;
      return { error: null };
    }),
    signInAnonymously: jest.fn(async () => {
      current = session('fresh-guest');
      return { data: { session: current }, error: null };
    }),
  };
  const from = jest.fn((_table: string) => ({
    select: () => ({
      eq: (_column: string, id: string) => ({
        maybeSingle: async () => ({ data: (opts.profiles ?? []).find((p) => p.id === id) ?? null, error: null }),
      }),
    }),
  }));
  return { client: { auth, from } as never, auth };
}

describe('readSession', () => {
  it('starts a guest when nobody is signed in', async () => {
    const { client, auth } = fakeClient({});
    expect(await readSession(client)).toEqual({ userId: 'fresh-guest', email: null, profile: null });
    expect(auth.signInAnonymously).toHaveBeenCalledTimes(1);
  });

  it('returns the saved person with their name, without asking the server again', async () => {
    const ann = { id: 'ann', name: 'Ann', color: '#fff' };
    const { client, auth } = fakeClient({ saved: session('ann', { is_anonymous: false, email: 'ann@example.com' }), profiles: [ann] });
    expect(await readSession(client)).toEqual({ userId: 'ann', email: 'ann@example.com', profile: ann });
    expect(auth.getUser).not.toHaveBeenCalled();
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it('keeps a new guest who has not picked a name yet', async () => {
    const { client, auth } = fakeClient({ saved: session('new-guest') });
    expect(await readSession(client)).toEqual({ userId: 'new-guest', email: null, profile: null });
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it('gives a removed user a fresh start as a guest', async () => {
    const { client, auth } = fakeClient({
      saved: session('removed'),
      getUserError: { message: 'User from sub claim in JWT does not exist', code: 'user_not_found', status: 403 },
    });
    expect(await readSession(client)).toEqual({ userId: 'fresh-guest', email: null, profile: null });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('keeps the sign-in when the server cannot be reached', async () => {
    const { client, auth } = fakeClient({ saved: session('offline'), getUserError: { message: 'Failed to fetch', status: 0 } });
    expect(await readSession(client)).toEqual({ userId: 'offline', email: null, profile: null });
    expect(auth.signOut).not.toHaveBeenCalled();
  });
});
