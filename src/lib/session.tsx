import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { Profile } from './data';
import { isConfigured, supabase } from './supabase';

type SessionValue = {
  ready: boolean;
  configured: boolean;
  error: string | null;
  userId: string | null;
  profile: Profile | null;
  saveProfile: (name: string, color: string) => Promise<void>;
};

const SessionContext = createContext<SessionValue>({
  ready: false,
  configured: isConfigured,
  error: null,
  userId: null,
  profile: null,
  saveProfile: async () => {},
});

export function SessionProvider({ children }: { children: ReactNode }) {
  // Without a Supabase client there is nothing to load, so the session is ready immediately.
  const [ready, setReady] = useState(!supabase);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let alive = true;
    (async () => {
      try {
        let { data: sessionData } = await client.auth.getSession();
        let session = sessionData.session;
        if (!session) {
          // No account needed: everyone starts as a guest.
          const res = await client.auth.signInAnonymously();
          if (res.error) throw new Error(res.error.message);
          session = res.data.session;
        }
        if (!session) throw new Error('Could not start a session.');
        const uid = session.user.id;
        const { data: p, error: pErr } = await client.from('profiles').select('id, name, color').eq('id', uid).maybeSingle();
        if (pErr) throw new Error(pErr.message);
        if (!alive) return;
        setUserId(uid);
        setProfile((p as Profile | null) ?? null);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'Something went wrong.');
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const saveProfile = useCallback(
    async (name: string, color: string) => {
      if (!supabase || !userId) throw new Error('Not connected yet.');
      const row = { id: userId, name: name.trim(), color };
      const { error: err } = await supabase.from('profiles').upsert(row);
      if (err) throw new Error(err.message);
      setProfile(row);
    },
    [userId],
  );

  const value = useMemo(
    () => ({ ready, configured: isConfigured, error, userId, profile, saveProfile }),
    [ready, error, userId, profile, saveProfile],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  return useContext(SessionContext);
}
