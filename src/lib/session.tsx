import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Profile } from './data';
import { googlePhoto } from './google';
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
  /** The picture from their Google account, whether or not they show it. Null without Google. */
  googlePhoto: string | null;
  saveProfile: (name: string, color: string) => Promise<void>;
  /** Show or hide the Google picture on this person's circle. */
  showPhoto: (show: boolean) => Promise<void>;
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
  googlePhoto: null,
  saveProfile: async () => {},
  showPhoto: async () => {},
  refresh: async () => {},
});

type Who = { userId: string; email: string | null; profile: Profile | null; googlePhoto: string | null };

/** No account needed: everyone starts as a guest. */
async function startGuest(client: SupabaseClient) {
  const res = await client.auth.signInAnonymously();
  if (res.error) throw new Error(res.error.message);
  if (!res.data.session) throw new Error('Could not start a session.');
  return res.data.session;
}

const readProfile = (client: SupabaseClient, id: string) =>
  // "*" takes whatever the profile has, so this works before and after update 004 (photos).
  client.from('profiles').select('*').eq('id', id).maybeSingle();

/**
 * Keep the profile's photo the same as the Google account's, unless they chose to hide it.
 * Friends see the profile, not the account, so this is what puts the picture on their screens.
 * Without update 004 the save fails, and the profile is returned as it was.
 */
async function withPhoto(client: SupabaseClient, profile: Profile | null, photo: string | null): Promise<Profile | null> {
  if (!profile || !photo || profile.photo_hidden || profile.photo_url === photo) return profile;
  const { error } = await client.from('profiles').update({ photo_url: photo }).eq('id', profile.id);
  return error ? profile : { ...profile, photo_url: photo };
}

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
  const photo = user.is_anonymous ? null : googlePhoto(user);
  return {
    userId: user.id,
    email: user.is_anonymous ? null : (user.email ?? null),
    profile: await withPhoto(client, (p as Profile | null) ?? null, photo),
    googlePhoto: photo,
  };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  // Without a Supabase client there is nothing to load, so the session is ready immediately.
  const [ready, setReady] = useState(!supabase);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const mounted = useRef(true);

  const show = useCallback((who: Who) => {
    if (!mounted.current) return;
    setUserId(who.userId);
    setEmail(who.email);
    setProfile(who.profile);
    setPhoto(who.googlePhoto);
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
      // Someone naming themselves for the first time after signing in with Google gets their photo too.
      const saved = await withPhoto(supabase, { ...profile, ...row }, photo).catch(() => ({ ...profile, ...row }));
      setProfile(saved);
      void syncPush();
    },
    [userId, profile, photo],
  );

  const showPhoto = useCallback(
    async (show: boolean) => {
      if (!supabase || !profile) throw new Error('Not connected yet.');
      const change = show ? { photo_hidden: false, photo_url: photo } : { photo_hidden: true, photo_url: null };
      const { error: err } = await supabase.from('profiles').update(change).eq('id', profile.id);
      if (err) throw new Error(err.message);
      setProfile({ ...profile, ...change });
    },
    [profile, photo],
  );

  const value = useMemo(
    () => ({ ready, configured: isConfigured, error, userId, email, profile, googlePhoto: photo, saveProfile, showPhoto, refresh }),
    [ready, error, userId, email, profile, photo, saveProfile, showPhoto, refresh],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  return useContext(SessionContext);
}
