import { clampCnsFatigueProfile } from '@/types/biological';
import {
  clampCnsFatigueScore,
  totalCnsDeltaFromQueue,
} from '@/lib/gameplan/engine/clinicalLaws';
import {
  fetchDailyGameplan,
  type GameplanSource,
} from '@/lib/gameplan/fetchDailyGameplan';
import type { DailyGameplan } from '@/types/gameplan';
import type { BiologicalProfile } from '@/types/biological';
import type { PerformanceLogEntry, PerformanceQueueItem } from '@/types/performance';
import type { FocusPreference, EquipmentTag, UserStats } from '@/store/useSommaStore';

export interface LocalRecalibrateResult {
  processedCount: number;
  gameplan: DailyGameplan | null;
  source: GameplanSource | null;
  cns_fatigue_score: number | null;
}

/** Local-only post-workout path — Zustand/AsyncStorage is the sole source of truth. */
export async function recalibrateFromPerformanceQueue(
  queue: PerformanceQueueItem[],
  context: {
    focus: FocusPreference;
    equipment: EquipmentTag[];
    biological: BiologicalProfile;
    userStats: UserStats;
    performanceLogs: PerformanceLogEntry[];
    recalibrate?: boolean;
  },
): Promise<LocalRecalibrateResult> {
  if (queue.length === 0) {
    return { processedCount: 0, gameplan: null, source: null, cns_fatigue_score: null };
  }

  const current = clampCnsFatigueProfile(context.biological.cns_fatigue_score);
  const delta = totalCnsDeltaFromQueue(queue);
  const cnsFatigueScore =
    delta === 0 ? current : clampCnsFatigueScore(current + delta);

  if (context.recalibrate === false) {
    return {
      processedCount: queue.length,
      gameplan: null,
      source: null,
      cns_fatigue_score: cnsFatigueScore,
    };
  }

  const biologicalForRecalibrate =
    cnsFatigueScore != null
      ? { ...context.biological, cns_fatigue_score: cnsFatigueScore }
      : context.biological;

  try {
    const result = await fetchDailyGameplan({
      focus: context.focus,
      equipment: context.equipment,
      forceRefresh: true,
      biological: biologicalForRecalibrate,
      userStats: context.userStats,
      performanceLogs: context.performanceLogs,
    });

    return {
      processedCount: queue.length,
      gameplan: result.gameplan,
      source: result.source,
      cns_fatigue_score: cnsFatigueScore,
    };
  } catch (error) {
    console.warn(
      '[SOMMA] Local recalibration failed:',
      error instanceof Error ? error.message : error,
    );
    return {
      processedCount: queue.length,
      gameplan: null,
      source: 'local',
      cns_fatigue_score: cnsFatigueScore,
    };
  }
}
