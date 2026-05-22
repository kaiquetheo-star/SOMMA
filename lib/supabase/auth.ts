import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

import { getSupabase } from '@/lib/supabase/client';
import { createSessionFromUrl } from '@/lib/supabase/session';

WebBrowser.maybeCompleteAuthSession();

export function getAuthRedirectUri(): string {
  return makeRedirectUri({ scheme: 'somma', path: 'auth/callback' });
}

export async function signInWithEmailOtp(email: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error('Supabase is not configured. Add keys to your .env file.');
  }

  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: {
      emailRedirectTo: getAuthRedirectUri(),
    },
  });

  if (error) throw error;
}

export async function signInWithGoogle(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error('Supabase is not configured. Add keys to your .env file.');
  }

  const redirectTo = getAuthRedirectUri();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error) throw error;
  if (!data.url) {
    throw new Error('No OAuth URL returned from Supabase.');
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success' || !result.url) {
    throw new Error('Google sign-in was cancelled.');
  }

  const sessionCreated = await createSessionFromUrl(result.url);
  if (!sessionCreated) {
    throw new Error('Could not establish session from Google redirect.');
  }
}

export async function signOut(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
