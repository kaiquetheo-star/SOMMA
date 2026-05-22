import { useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';

import { isSupabaseConfigured } from '@/lib/config';
import { useAuth } from '@/providers/AuthProvider';
import { hasCompletedFoundationScan, useSommaStore } from '@/store/useSommaStore';

/**
 * Smart redirect: authenticated (or configured) users without foundation data
 * cannot remain on Sanctuary tabs — sent to Foundation Scan.
 */
export function FoundationGuard() {
  const router = useRouter();
  const segments = useSegments();
  const { session, isLoading, isConfigured } = useAuth();

  const userFoundation = useSommaStore((state) => state.user_foundation);
  const userEnvironment = useSommaStore((state) => state.user_environment);
  const userBiological = useSommaStore((state) => state.user_biological);

  const foundationComplete = hasCompletedFoundationScan({
    user_foundation: userFoundation,
    user_environment: userEnvironment,
    user_biological: userBiological,
  });

  const inTabs = segments[0] === '(tabs)';

  useEffect(() => {
    if (!inTabs || foundationComplete) return;

    if (isConfigured && isLoading) return;

    const requiresAuthFirst = isConfigured && !session;
    if (requiresAuthFirst) {
      router.replace('/(auth)');
      return;
    }

    router.replace('/(auth)/foundation');
  }, [
    foundationComplete,
    inTabs,
    isConfigured,
    isLoading,
    router,
    session,
    userEnvironment.available_equipment.length,
    userFoundation.focus_preference,
  ]);

  return null;
}
