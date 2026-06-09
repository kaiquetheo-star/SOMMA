import { useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';

import { hasCompletedFoundationScan, useSommaStore } from '@/store/useSommaStore';

/**
 * Post-hydration routing — never evaluates passport state until `_hasHydrated` is true.
 */
export function PassportNavigationGuard() {
  const router = useRouter();
  const segments = useSegments();

  const hasHydrated = useSommaStore((state) => state._hasHydrated);
  const userFoundation = useSommaStore((state) => state.user_foundation);
  const userEnvironment = useSommaStore((state) => state.user_environment);
  const userBiological = useSommaStore((state) => state.user_biological);

  const passportComplete = hasCompletedFoundationScan({
    user_foundation: userFoundation,
    user_environment: userEnvironment,
    user_biological: userBiological,
  });

  const rootSegment = segments[0];

  useEffect(() => {
    if (!hasHydrated) return;

    if (passportComplete && rootSegment === '(auth)') {
      router.replace('/(tabs)/home');
      return;
    }

    if (!passportComplete && rootSegment === '(tabs)') {
      router.replace('/(auth)/foundation');
    }
  }, [hasHydrated, passportComplete, rootSegment, router]);

  return null;
}
