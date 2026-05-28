import { useSommaStore } from '@/store/useSommaStore';

/** True after offline store rehydration — safe to read/write persisted fields. */
export function useStoreHydrated(): boolean {
  return useSommaStore((state) => state._hasHydrated);
}
