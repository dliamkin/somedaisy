import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Profile } from './data';
import { finishGoogle, type GoogleNote } from './google';
import { syncPush } from './push';
import { isConfigured, supabase } from './supabase';

type SessionValue = {
  ready: boolean;
  configured: boolean;
  error: string | null;
  userId: string | null;
  /** The account's email, or null for a guest. */
  email: string | null;
  profile: Profile | null;
  /** Something to tell the person after coming back from Google, if it did not all go well. */
  note: GoogleNote;
  saveProfile: (name: string, color: string) => Promise<void>;
  /** Re-read who is signed in. Call after signing in, signing out, or adding an email. */
  refresh: () => Promise<void>;
};

const SessionContext = createContext<SessionValue>({
  ready: false,
  configured: isConfigured,
  error: null,
  userId: null,
  email: null,
  profile: null,
  note: null,
  saveProfile: async () => {},
  refresh: async () => {},
});

type Who = { userId: string; email: string | null; profile: Profile | null };

/** No account needed: everyone starts as a guest. */
async function startGuest(client: SupabaseClient) {
  const res = await client.auth.signInAnonymously();
  if (res.error) throw new Error(res.error.message);
  if (!res.data.session) throw new Error('Could not start a session.');
  return res.data.session;
}

const readProfile = (client: SupabaseClient, id: string) =>
  client.from('profiles').select('id, name, color').eq('id', id).maybeSingle();

/**
 * True when the saved sign-in belongs to a user Supabase no longer has. The device keeps working
 * with its saved pass for up to an hour after the user is removed, so ask the server directly.
 * A failed connection is not an answer, and keeps the sign-in.
 */
async function userIsGone(client: SupabaseClient): Promise<boolean> {
  const { error } = await client.auth.getUser();
  if (!error) return false;
  return error.code === 'user_not_found' || error.status === 401 || error.status === 403 || error.status === 404;
}

/** Find out who is using this device, starting a guest if nobody is signed in. */
export async function readSession(client: SupabaseClient): Promise<Who> {
  const { data: sessionData } = await client.auth.getSession();
  let session = sessionData.session ?? (await startGuest(client));
  let { data: p, error: pErr } = await readProfile(client, session.user.id);
  if (pErr) throw new Error(pErr.message);
  // A sign-in with no name is either someone new or a user who has been removed. Only the first
  // can save a name, so check, and give a removed user a fresh start as a guest.
  if (!p && (await userIsGone(client))) {
    await client.auth.signOut({ scope: 'local' });
    session = await startGuest(client);
    ({ data: p, error: pErr } = await readProfile(client, session.user.id));
    if (pErr) throw new Error(pErr.message);
  }
  const user = session.user;
  return {
    userId: user.id,
    email: user.is_anonymous ? null : (user.email ?? null),
    profile: (p as Profile | null) ?? null,
  };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  // Without a Supabase client there is nothing to load, so the session is ready immediately.
  const [ready, setReady] = useState(!supabase);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [note, setNote] = useState<GoogleNote>(null);
  const mounted = useRef(true);

  const show = useCallback((who: Who) => {
    if (!mounted.current) return;
    setUserId(who.userId);
    setEmail(who.email);
    setProfile(who.profile);
    setError(null);
    setReady(true);
    // If this phone already allows notifications, make sure they go to whoever is signed in now.
    if (who.profile) void syncPush();
  }, []);

  const showError = useCallback((e: unknown) => {
    if (!mounted.current) return;
    setError(e instanceof Error ? e.message : 'Something went wrong.');
    setReady(true);
  }, []);

  const refresh = useCallback(async () => {
    if (!supabase) return;
    await readSession(supabase).then(show, showError);
  }, [show, showError]);

  useEffect(() => {
    mounted.current = true;
    if (supabase) {
      const client = supabase;
      // Coming back from Google? Finish signing in before working out who is here.
      void finishGoogle(client).then((result) => {
        if (mounted.current) setNote(result);
        return readSession(client).then(show, showError);
      });
    }
    return () => {
      mounted.current = false;
    };
  }, [show, showError]);

  const saveProfile = useCallback(
    async (name: string, color: string) => {
      if (!supabase || !userId) throw new Error('Not connected yet.');
      const row = { id: userId, name: name.trim(), color };
      const { error: err } = await supabase.from('profiles').upsert(row);
      if (err) throw new Error(err.message);
      setProfile(row);
      void syncPush();
    },
    [userId],
  );

  const value = useMemo(
    () => ({ ready, configured: isConfigured, error, userId, email, profile, note, saveProfile, refresh }),
    [ready, error, userId, email, profile, note, saveProfile, refresh],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  return useContext(SessionContext);
}
