// CLINICAL ENGINE: DETERMINISTIC ONLY. NO RANDOMNESS ALLOWED. IF INPUTS ARE CONSTANT, OUTPUT MUST BE CONSTANT.
import { fetchLibraryExercises } from '@/lib/catalog/library';
import { applyNeuroMechanicalOrderingToMicrocycle } from '@/lib/gameplan/engine/clinicalLaws';
import { generateDeterministicGameplan } from '@/lib/gameplan/engine/generateDeterministicGameplan';
import { getMicrocycleDay, getTodayDayIndex } from '@/lib/gameplan/microcycleWeek';
import { GameplanFetchError } from '@/lib/gameplan/gameplanErrors';
import { assessMicrocycleHealth } from '@/lib/gameplan/microcycleValidation';
import { deriveTrainingDaysFromFrequencies } from '@/types/biological';
import type { BiologicalProfile } from '@/types/biological';
import type { DailyGameplan } from '@/types/gameplan';
import type { PerformanceLogEntry } from '@/types/performance';
import type { FocusPreference, EquipmentTag, UserStats } from '@/store/useSommaStore';

export type GameplanSource = 'ai' | 'deterministic' | 'fallback' | 'stub' | 'local';

export function parseGameplanSource(value: unknown): GameplanSource | null {
  if (
    value === 'ai' ||
    value === 'deterministic' ||
    value === 'fallback' ||
    value === 'stub' ||
    value === 'local'
  ) {
    return value;
  }
  return null;
}

async function finalizeGameplanOrdering(gameplan: DailyGameplan): Promise<DailyGameplan> {
  const catalog = await fetchLibraryExercises();
  const microcycle = applyNeuroMechanicalOrderingToMicrocycle(gameplan.microcycle, catalog);
  const todayIndex = getTodayDayIndex(gameplan.week_start_date);
  const blocks = getMicrocycleDay(microcycle, todayIndex)?.blocks ?? gameplan.blocks;
  return { ...gameplan, microcycle, blocks };
}

export interface FetchDailyGameplanInput {
  focus: FocusPreference;
  equipment: EquipmentTag[];
  forceRefresh?: boolean;
  biological: BiologicalProfile;
  userStats: UserStats;
  performanceLogs: PerformanceLogEntry[];
}

export interface FetchDailyGameplanResult {
  gameplan: DailyGameplan;
  source: GameplanSource;
  fromCache: boolean;
}

/**
 * Local-first Head Coach — deterministic engine only ($0 API, no cloud).
 */
export async function fetchDailyGameplan({
  focus,
  equipment,
  biological,
  userStats,
  performanceLogs,
}: FetchDailyGameplanInput): Promise<FetchDailyGameplanResult> {
  const trainingDaysPerWeek = deriveTrainingDaysFromFrequencies(biological);

  try {
    console.log('[SOMMA] Local deterministic Head Coach — device-only path');
    const generated = await generateDeterministicGameplan({
      focus,
      equipment,
      biological,
      userStats,
      performanceLogs,
    });
    const gameplan = await finalizeGameplanOrdering(generated);

    const health = assessMicrocycleHealth(gameplan.microcycle, trainingDaysPerWeek);
    console.log('[SOMMA] Local microcycle generated', { health, trainingDaysPerWeek });

    return { gameplan, source: 'local', fromCache: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Local generation failed';
    console.error('[SOMMA] Local Head Coach failed:', message);
    throw new GameplanFetchError(message, {
      code: message.startsWith('INSUFFICIENT_CATALOG') ? 'INSUFFICIENT_CATALOG' : 'GENERATION_FAILED',
    });
  }
}
