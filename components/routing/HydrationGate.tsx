import { useEffect } from 'react';
import type { ReactNode } from 'react';

import { LoadingFallback } from '@/components/routing/LoadingFallback';
import { useSommaStore } from '@/store/useSommaStore';

function finalizeHydration(): void {
  useSommaStore.setState({ _hasHydrated: true });
}

/**
 * Blocks the app until persisted state is rehydrated.
 * Uses `skipHydration` + manual `rehydrate()` to prevent default state overwriting storage.
 */
export function HydrationGate({ children }: { children: ReactNode }) {
  const hasHydrated = useSommaStore((state) => state._hasHydrated);

  useEffect(() => {
    if (useSommaStore.getState()._hasHydrated) return;

    if (useSommaStore.persist.hasHydrated()) {
      finalizeHydration();
      return;
    }

    const unsubscribe = useSommaStore.persist.onFinishHydration(() => {
      finalizeHydration();
    });

    void useSommaStore.persist.rehydrate();

    return unsubscribe;
  }, []);

  if (!hasHydrated) {
    return <LoadingFallback message="Initializing SOMMA OS…" />;
  }

  return <>{children}</>;
}
