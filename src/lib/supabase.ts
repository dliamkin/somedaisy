import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;

export const isConfigured = Boolean(url && key);

// On the web the Supabase client keeps the session in the browser's own storage.
// On phones it needs AsyncStorage.
export const supabase: SupabaseClient | null = isConfigured
  ? createClient(url as string, key as string, {
      auth: {
        ...(Platform.OS === 'web' ? {} : { storage: AsyncStorage }),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

export function db(): SupabaseClient {
  if (!supabase) throw new Error('Supabase is not configured. Add the URL and key to .env.');
  return supabase;
}
