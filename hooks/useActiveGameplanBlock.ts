import { useMemo } from 'react';

import { useSommaStore } from '@/store/useSommaStore';
import type { GameplanBlock } from '@/types/gameplan';

/** Resolve the active ritual block from today's gameplan by route blockId */
export function useActiveGameplanBlock(blockId: string | undefined): GameplanBlock | null {
  const currentGameplan = useSommaStore(
    (state) => state.currentGameplan ?? state.daily_gameplan,
  );

  return useMemo(() => {
    if (!blockId || !currentGameplan) return null;
    return currentGameplan.blocks.find((block) => block.id === blockId) ?? null;
  }, [blockId, currentGameplan]);
}
