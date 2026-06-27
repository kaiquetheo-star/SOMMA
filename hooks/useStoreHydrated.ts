import { useSommaStore } from '@/store/useSommaStore';

/** True after offline store rehydration — safe to read/write persisted fields. */
export function useStoreHydrated(): boolean {
  return useSommaStore((state) => state._hasHydrated && !state.isHydrating);
}

/** True while SecureStore persist rehydration is still in flight. */
export function useStoreHydrating(): boolean {
  return useSommaStore((state) => state.isHydrating);
}
