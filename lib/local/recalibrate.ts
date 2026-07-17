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
}

export function mergePerformanceLogsWithQueue(
  performanceLogs: readonly PerformanceLogEntry[],
  queue: readonly PerformanceQueueItem[],
): PerformanceLogEntry[] {
  const byId = new Map<string, PerformanceLogEntry>();

  for (const log of performanceLogs) {
    byId.set(log.id, log);
  }

  for (const item of queue) {
    const log = item.session ?? performanceLogFromQueueItem(item);
    if (log) {
      byId.set(log.id, log);
    }
  }

  return [...byId.values()].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

function reportedRirFromRpe(rpe: number | null | undefined): number | null {
  if (rpe == null || !Number.isFinite(rpe)) return null;
  return Math.min(4, Math.max(0, Math.round(10 - rpe)));
}

function performanceLogFromQueueItem(item: PerformanceQueueItem): PerformanceLogEntry | null {
  if (item.type === 'session' && item.data) {
    return {
      id: item.data.sessionId,
      type: 'session',
      data: item.data,
      pillar: 'iron',
      block_id: item.data.blockId,
      timestamp: item.data.completedAt,
    };
  }

  const { input } = item;
  if (input.pillar !== 'iron' || !input.exercise_id) return null;

  return {
    id: `performance-queue-${item.id}`,
    pillar: 'iron',
    block_id: input.block_id,
    timestamp: item.created_at,
    iron: {
      block_id: input.block_id,
      exercise_name: input.exercise_id,
      exercise_id: input.exercise_id,
      completed_at: item.created_at,
      sets: [
        {
          set_index: 1,
          weight_kg: input.weight_used ?? 0,
          reps: input.reps_completed ?? 1,
          target_reps: input.reps_completed ?? 1,
          reported_rir: reportedRirFromRpe(input.rpe_score),
          target_rir: input.target_rir ?? null,
          rest_seconds_used: input.actual_rest_seconds ?? 0,
          logged_at: item.created_at,
        },
      ],
    },
  };
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
    return { processedCount: 0, gameplan: null, source: null };
  }

  if (context.recalibrate === false) {
    return {
      processedCount: queue.length,
      gameplan: null,
      source: null,
    };
  }

  const mergedLogs = mergePerformanceLogsWithQueue(context.performanceLogs, queue);

  try {
    const result = await fetchDailyGameplan({
      focus: context.focus,
      equipment: context.equipment,
      forceRefresh: true,
      biological: context.biological,
      userStats: context.userStats,
      performanceLogs: mergedLogs,
    });

    return {
      processedCount: queue.length,
      gameplan: result.gameplan,
      source: result.source,
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
    };
  }
}
