import * as QueryParams from 'expo-auth-session/build/QueryParams';

import { getSupabase } from '@/lib/supabase/client';

/** Parse access/refresh tokens from OAuth or magic-link deep links */
export async function createSessionFromUrl(url: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  const { params, errorCode } = QueryParams.getQueryParams(url);
  if (errorCode) {
    throw new Error(errorCode);
  }

  const access_token = params.access_token;
  const refresh_token = params.refresh_token;

  if (!access_token || !refresh_token) {
    return false;
  }

  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) throw error;
  return true;
}
