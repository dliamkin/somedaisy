import { readSession } from '../session';

jest.mock('../supabase', () => ({ supabase: null, isConfigured: false }));
jest.mock('../push', () => ({ syncPush: jest.fn() }));

type Failure = { message: string; code?: string; status?: number };
type Profile = { id: string; name: string; color: string; photo_url?: string | null; photo_hidden?: boolean };

const session = (id: string, extra: object = {}) => ({ user: { id, is_anonymous: true, email: null, ...extra } });

/**
 * A stand-in for Supabase. `saved` is the sign-in kept on the device, `profiles` the names the
 * database knows, and `getUserError` what the server says when asked whether the user still exists.
 */
function fakeClient(opts: { saved?: ReturnType<typeof session> | null; profiles?: Profile[]; getUserError?: Failure | null; updateError?: Failure | null }) {
  const updates: { id: string; change: unknown }[] = [];
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
    update: (change: unknown) => ({
      eq: async (_column: string, id: string) => {
        if (!opts.updateError) updates.push({ id, change });
        return { error: opts.updateError ?? null };
      },
    }),
    select: () => ({
      eq: (_column: string, id: string) => ({
        maybeSingle: async () => ({ data: (opts.profiles ?? []).find((p) => p.id === id) ?? null, error: null }),
      }),
    }),
  }));
  return { client: { auth, from } as never, auth, updates };
}

describe('readSession', () => {
  it('starts a guest when nobody is signed in', async () => {
    const { client, auth } = fakeClient({});
    expect(await readSession(client)).toEqual({ userId: 'fresh-guest', email: null, profile: null, googlePhoto: null });
    expect(auth.signInAnonymously).toHaveBeenCalledTimes(1);
  });

  it('returns the saved person with their name, without asking the server again', async () => {
    const ann = { id: 'ann', name: 'Ann', color: '#fff' };
    const { client, auth } = fakeClient({ saved: session('ann', { is_anonymous: false, email: 'ann@example.com' }), profiles: [ann] });
    expect(await readSession(client)).toEqual({ userId: 'ann', email: 'ann@example.com', profile: ann, googlePhoto: null });
    expect(auth.getUser).not.toHaveBeenCalled();
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it('keeps a new guest who has not picked a name yet', async () => {
    const { client, auth } = fakeClient({ saved: session('new-guest') });
    expect(await readSession(client)).toEqual({ userId: 'new-guest', email: null, profile: null, googlePhoto: null });
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it('gives a removed user a fresh start as a guest', async () => {
    const { client, auth } = fakeClient({
      saved: session('removed'),
      getUserError: { message: 'User from sub claim in JWT does not exist', code: 'user_not_found', status: 403 },
    });
    expect(await readSession(client)).toEqual({ userId: 'fresh-guest', email: null, profile: null, googlePhoto: null });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('keeps the sign-in when the server cannot be reached', async () => {
    const { client, auth } = fakeClient({ saved: session('offline'), getUserError: { message: 'Failed to fetch', status: 0 } });
    expect(await readSession(client)).toEqual({ userId: 'offline', email: null, profile: null, googlePhoto: null });
    expect(auth.signOut).not.toHaveBeenCalled();
  });
});

describe('the Google photo', () => {
  const PHOTO = 'https://lh3.googleusercontent.com/a/ACg8oc-abc_123=s96-c';
  const google = (id: string, extra: object = {}) =>
    session(id, { is_anonymous: false, email: `${id}@example.com`, user_metadata: { avatar_url: PHOTO }, ...extra });

  it('is put on the profile of someone signed in with Google', async () => {
    const ann = { id: 'ann', name: 'Ann', color: '#fff' };
    const { client, updates } = fakeClient({ saved: google('ann'), profiles: [ann] });
    const who = await readSession(client);
    expect(who.profile).toEqual({ ...ann, photo_url: PHOTO });
    expect(who.googlePhoto).toBe(PHOTO);
    expect(updates).toEqual([{ id: 'ann', change: { photo_url: PHOTO } }]);
  });

  it('is left alone when the profile already has it', async () => {
    const ann = { id: 'ann', name: 'Ann', color: '#fff', photo_url: PHOTO, photo_hidden: false };
    const { client, updates } = fakeClient({ saved: google('ann'), profiles: [ann] });
    expect((await readSession(client)).profile).toEqual(ann);
    expect(updates).toEqual([]);
  });

  it('stays off the profile of someone who chose to hide it, but is still on offer', async () => {
    const ann = { id: 'ann', name: 'Ann', color: '#fff', photo_url: null, photo_hidden: true };
    const { client, updates } = fakeClient({ saved: google('ann'), profiles: [ann] });
    const who = await readSession(client);
    expect(who.profile).toEqual(ann);
    expect(who.googlePhoto).toBe(PHOTO);
    expect(updates).toEqual([]);
  });

  it('is not shown when the database has no place for it yet', async () => {
    const ann = { id: 'ann', name: 'Ann', color: '#fff' };
    const { client } = fakeClient({ saved: google('ann'), profiles: [ann], updateError: { message: 'column "photo_url" does not exist' } });
    expect((await readSession(client)).profile).toEqual(ann);
  });

  it('ignores a picture that is not served by Google', async () => {
    const ann = { id: 'ann', name: 'Ann', color: '#fff' };
    const { client, updates } = fakeClient({
      saved: google('ann', { user_metadata: { avatar_url: 'https://example.com/tracker.png' } }),
      profiles: [ann],
    });
    const who = await readSession(client);
    expect(who.googlePhoto).toBeNull();
    expect(updates).toEqual([]);
  });

  it('is nothing for a guest, or for an email account', async () => {
    const { client } = fakeClient({ saved: session('guest', { user_metadata: { avatar_url: PHOTO } }) });
    expect((await readSession(client)).googlePhoto).toBeNull();
    const email = fakeClient({ saved: session('ann', { is_anonymous: false, email: 'ann@example.com' }) });
    expect((await readSession(email.client)).googlePhoto).toBeNull();
  });
});
