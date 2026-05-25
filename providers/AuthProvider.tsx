import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';

import { LOCAL_ATHLETE_ID } from '@/lib/local/defaultAthlete';
import { useSommaStore } from '@/store/useSommaStore';

/** Minimal local user — no cloud session. */
export interface LocalUser {
  id: string;
  email: string;
}

interface AuthContextValue {
  isConfigured: boolean;
  isLoading: boolean;
  session: { user: LocalUser } | null;
  user: LocalUser | null;
  signInWithEmail: (email: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshRemoteProfile: () => Promise<void>;
}

const LOCAL_USER: LocalUser = {
  id: LOCAL_ATHLETE_ID,
  email: 'local@somma.app',
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const resetStore = useSommaStore((state) => state.resetStore);

  const signOut = useCallback(async () => {
    await resetStore();
  }, [resetStore]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isConfigured: false,
      isLoading: false,
      session: { user: LOCAL_USER },
      user: LOCAL_USER,
      signInWithEmail: async () => {},
      signInWithGoogle: async () => {},
      signOut,
      refreshRemoteProfile: async () => {},
    }),
    [signOut],
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
