import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Profile } from './data';
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
  saveProfile: async () => {},
  refresh: async () => {},
});

type Who = { userId: string; email: string | null; profile: Profile | null };

/** Find out who is using this device, starting a guest if nobody is signed in. */
async function readSession(client: SupabaseClient): Promise<Who> {
  const { data: sessionData } = await client.auth.getSession();
  let session = sessionData.session;
  if (!session) {
    // No account needed: everyone starts as a guest.
    const res = await client.auth.signInAnonymously();
    if (res.error) throw new Error(res.error.message);
    session = res.data.session;
  }
  if (!session) throw new Error('Could not start a session.');
  const user = session.user;
  const { data: p, error: pErr } = await client.from('profiles').select('id, name, color').eq('id', user.id).maybeSingle();
  if (pErr) throw new Error(pErr.message);
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
    if (supabase) readSession(supabase).then(show, showError);
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
    () => ({ ready, configured: isConfigured, error, userId, email, profile, saveProfile, refresh }),
    [ready, error, userId, email, profile, saveProfile, refresh],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  return useContext(SessionContext);
}
