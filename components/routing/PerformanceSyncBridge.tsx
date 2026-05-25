import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { useSommaStore } from '@/store/useSommaStore';

/** Drain local performance queue when the app returns to foreground. */
export function PerformanceSyncBridge() {
  const flushPerformanceQueue = useSommaStore((state) => state.flushPerformanceQueue);
  const queueLength = useSommaStore((state) => state.performanceQueue.length);

  useEffect(() => {
    if (queueLength === 0) return;

    const handleAppState = (next: AppStateStatus) => {
      if (next === 'active') {
        void flushPerformanceQueue().catch((err) => {
          console.warn('[SOMMA] Performance queue flush failed:', err);
        });
      }
    };

    void flushPerformanceQueue().catch((err) => {
      console.warn('[SOMMA] Performance queue flush failed:', err);
    });

    const subscription = AppState.addEventListener('change', handleAppState);
    return () => subscription.remove();
  }, [queueLength, flushPerformanceQueue]);

  return null;
}
