import type { DailyGameplan, WorkoutPillar } from '@/types/gameplan';

/** Unique workout pillars completed in today's gameplan */
export function getCompletedPillarsToday(gameplan: DailyGameplan | null): WorkoutPillar[] {
  if (!gameplan) return [];

  const pillars = new Set<WorkoutPillar>();
  for (const block of gameplan.blocks) {
    if (block.status === 'completed') {
      pillars.add(block.pillar);
    }
  }
  return [...pillars];
}

/** Count of completed vs total ritual blocks for Daily Command HUD */
export function getTodayRitualProgress(gameplan: DailyGameplan | null): {
  completedBlocks: number;
  totalBlocks: number;
  completedPillars: WorkoutPillar[];
} {
  if (!gameplan) {
    return { completedBlocks: 0, totalBlocks: 0, completedPillars: [] };
  }

  const completedBlocks = gameplan.blocks.filter((b) => b.status === 'completed').length;
  return {
    completedBlocks,
    totalBlocks: gameplan.blocks.length,
    completedPillars: getCompletedPillarsToday(gameplan),
  };
}

/** Maps workout pillar completion to essence channel index in AttunementOrbs */
export const PILLAR_TO_ESSENCE_INDEX: Record<WorkoutPillar, number> = {
  iron: 0,
  combat: 3,
  spirit: 2,
};
