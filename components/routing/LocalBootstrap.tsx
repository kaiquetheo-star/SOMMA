import { useEffect, useRef } from 'react';

import {
  DEFAULT_LOCAL_BIOLOGICAL,
  DEFAULT_LOCAL_EQUIPMENT,
  defaultLocalFocusPreference,
} from '@/lib/local/defaultAthlete';
import { useStoreHydrated } from '@/hooks/useStoreHydrated';
import { hasCompletedFoundationScan, useSommaStore } from '@/store/useSommaStore';

/**
 * Seeds a default local athlete on first launch and builds the Head Coach protocol on-device.
 */
export function LocalBootstrap() {
  const hydrated = useStoreHydrated();
  const seededRef = useRef(false);

  const userFoundation = useSommaStore((state) => state.user_foundation);
  const userEnvironment = useSommaStore((state) => state.user_environment);
  const userBiological = useSommaStore((state) => state.user_biological);
  const completeFoundationScan = useSommaStore((state) => state.completeFoundationScan);
  const fetchDailyGameplanAsync = useSommaStore((state) => state.fetchDailyGameplanAsync);

  const foundationComplete = hasCompletedFoundationScan({
    user_foundation: userFoundation,
    user_environment: userEnvironment,
    user_biological: userBiological,
  });

  useEffect(() => {
    if (!hydrated || seededRef.current) return;
    seededRef.current = true;

    if (!foundationComplete) {
      completeFoundationScan({
        focus_preference: defaultLocalFocusPreference(),
        available_equipment: [...DEFAULT_LOCAL_EQUIPMENT],
        biological: { ...DEFAULT_LOCAL_BIOLOGICAL },
      });
    }

    void fetchDailyGameplanAsync();
  }, [
    hydrated,
    foundationComplete,
    completeFoundationScan,
    fetchDailyGameplanAsync,
  ]);

  return null;
}
