import type { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { isSupabaseConfigured } from '@/lib/config';
import {
  signInWithEmailOtp,
  signInWithGoogle as oauthSignInWithGoogle,
  signOut as supabaseSignOut,
} from '@/lib/supabase/auth';
import { getSupabase } from '@/lib/supabase/client';
import {
  fetchRemoteUserSnapshot,
  hydrateLocalStoreFromRemote,
} from '@/lib/supabase/profile';
import { createSessionFromUrl } from '@/lib/supabase/session';

interface AuthContextValue {
  isConfigured: boolean;
  isLoading: boolean;
  session: Session | null;
  user: User | null;
  signInWithEmail: (email: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshRemoteProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/** Defer async work out of Supabase auth callbacks (prevents getSession() deadlock on web). */
function deferAuthSideEffect(task: () => void | Promise<void>): void {
  setTimeout(() => {
    void Promise.resolve(task()).catch(() => undefined);
  }, 0);
}

async function handleDeepLink(url: string): Promise<void> {
  if (!url.includes('access_token') && !url.includes('code=')) return;
  await createSessionFromUrl(url);
}

async function hydrateRemoteProfile(userId: string): Promise<void> {
  try {
    const snapshot = await fetchRemoteUserSnapshot(userId, { skipSessionProbe: true });
    if (snapshot) hydrateLocalStoreFromRemote(snapshot);
  } catch {
    // Offline, RLS, or schema not deployed — local Zustand remains source of truth
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);
  const lastHydratedUserId = useRef<string | null>(null);

  const refreshRemoteProfile = useCallback(async () => {
    const userId = session?.user?.id;
    if (!userId) return;
    await hydrateRemoteProfile(userId);
    lastHydratedUserId.current = userId;
  }, [session?.user?.id]);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    let mounted = true;

    const bootstrap = async () => {
      try {
        const {
          data: { session: initialSession },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.warn('[SOMMA] getSession error:', error.message);
        }

        if (!mounted) return;
        setSession(initialSession ?? null);
      } catch (err) {
        console.warn(
          '[SOMMA] Auth bootstrap failed:',
          err instanceof Error ? err.message : err,
        );
        if (mounted) setSession(null);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    void bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      // Never await Supabase or getSession() inside this callback — it deadlocks on web.
    });

    const linkSub = Linking.addEventListener('url', ({ url }) => {
      deferAuthSideEffect(() => handleDeepLink(url));
    });

    Linking.getInitialURL()
      .then((url) => {
        if (url) deferAuthSideEffect(() => handleDeepLink(url));
      })
      .catch(() => undefined);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      linkSub.remove();
    };
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const userId = session?.user?.id;
    if (!userId) {
      lastHydratedUserId.current = null;
      return;
    }

    if (lastHydratedUserId.current === userId) return;

    deferAuthSideEffect(async () => {
      await hydrateRemoteProfile(userId);
      lastHydratedUserId.current = userId;
    });
  }, [isLoading, session?.user?.id]);

  const signInWithEmail = useCallback(async (email: string) => {
    await signInWithEmailOtp(email);
  }, []);

  const signInWithGoogle = useCallback(async () => {
    await oauthSignInWithGoogle();
  }, []);

  const signOut = useCallback(async () => {
    await supabaseSignOut();
    setSession(null);
    lastHydratedUserId.current = null;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isConfigured: isSupabaseConfigured,
      isLoading,
      session,
      user: session?.user ?? null,
      signInWithEmail,
      signInWithGoogle,
      signOut,
      refreshRemoteProfile,
    }),
    [isLoading, session, signInWithEmail, signInWithGoogle, signOut, refreshRemoteProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
