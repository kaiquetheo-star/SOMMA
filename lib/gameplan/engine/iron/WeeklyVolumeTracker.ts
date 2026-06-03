import type {
  CatalogExercise,
  ExerciseCatalog,
  WeeklyVolumeSnapshot,
} from '@/lib/gameplan/engine/iron/types';
import type { EnginePerformanceRow } from '@/lib/gameplan/engine/performanceLogs';
import type { BiologicalProfile } from '@/types/biological';

/** Minimum effective volume / muscle / week (MEV). */
export const MEV = 10;

/** Soft maximum — scoring penalty zone begins above this. */
export const MRV_SOFT = 18;

/** Hard maximum — exercises that would exceed this are rejected. */
export const MRV_HARD = 22;

/** Synergist muscles receive this fraction of working-set credit. */
export const SYNERGIST_FRACTION = 0.5;

export interface CanAddSetsResult {
  allowed: boolean;
  projected: ReadonlyMap<string, number>;
  projectedVolume: number;
  clampedSets: number;
  reason?: string;
}

export interface WeeklyVolumeTracker {
  readonly snapshot: WeeklyVolumeSnapshot;
  readonly acwr: number | null;
  readonly isRecoveryMode: boolean;
  completedSetsForMuscle(muscle: string): number;
  creditVolume(exercise: CatalogExercise, sets: number): void;
  debitVolume(exercise: CatalogExercise, sets: number): void;
  canAddSets(exercise: CatalogExercise, sets: number): CanAddSetsResult;
  projectSets(exercise: CatalogExercise, sets: number): ReadonlyMap<string, number>;
}

interface MuscleCredit {
  muscle: string;
  fraction: number;
}

function setsFromLog(log: EnginePerformanceRow): number {
  const fromPayload = log.payload?.iron?.sets?.length;
  if (fromPayload != null && fromPayload > 0) return fromPayload;
  return 1;
}

function weekWindowEnd(weekStartDate: string): number {
  const start = Date.parse(weekStartDate);
  if (Number.isNaN(start)) return Date.now();
  return start + 7 * 24 * 60 * 60 * 1000;
}

function isLogInWeek(timestamp: string, weekStartDate: string, weekEndMs: number): boolean {
  const t = Date.parse(timestamp);
  const start = Date.parse(weekStartDate);
  if (Number.isNaN(t) || Number.isNaN(start)) return false;
  return t >= start && t < weekEndMs;
}

function logSRpe(log: EnginePerformanceRow): number {
  const setCount = setsFromLog(log);
  const rpe = log.rpe_score != null && Number.isFinite(log.rpe_score) ? log.rpe_score : 7;
  const durationMinutes = Math.max(1, setCount * 3);
  return rpe * durationMinutes;
}

function computeAcwr(
  logs7d: readonly EnginePerformanceRow[],
  chronicLogs: readonly EnginePerformanceRow[],
): number | null {
  const acuteLoad = logs7d
    .filter((log) => log.pillar === 'iron')
    .reduce((sum, log) => sum + logSRpe(log), 0);
  const chronicLoad = chronicLogs
    .filter((log) => log.pillar === 'iron')
    .reduce((sum, log) => sum + logSRpe(log), 0);

  if (acuteLoad <= 0 || chronicLoad <= 0) return null;

  // Regra 2.2: ACWR = acute 7d load / chronic 28d weekly average.
  const chronicWeeklyAverage = chronicLoad / 4;
  if (chronicWeeklyAverage <= 0) return null;

  return Math.round((acuteLoad / chronicWeeklyAverage) * 100) / 100;
}

type RecoveryBiologicalProfile = Partial<BiologicalProfile> & {
  hormonal_transition?: boolean | null;
};

function muscleCreditsForExercise(exercise: CatalogExercise): readonly MuscleCredit[] {
  const credits: MuscleCredit[] = [{ muscle: exercise.primary_muscle, fraction: 1 }];
  for (const synergist of exercise.synergist_muscles) {
    credits.push({ muscle: synergist, fraction: SYNERGIST_FRACTION });
  }
  return credits;
}

function buildSnapshot(volumeByMuscle: ReadonlyMap<string, number>): WeeklyVolumeSnapshot {
  return Object.freeze({
    byMuscle: volumeByMuscle,
    mev: MEV,
    mrvSoft: MRV_SOFT,
    mrvHard: MRV_HARD,
  });
}

/**
 * Rolling 7-day effective set ledger (primary 1.0×, synergists 0.5×).
 * Seeds from `performance_logs` rows, then accepts projected credits from the solver.
 */
export function createWeeklyVolumeTracker(
  catalog: ExerciseCatalog,
  logs7d: readonly EnginePerformanceRow[],
  weekStartDate: string,
): WeeklyVolumeTracker;
export function createWeeklyVolumeTracker(
  catalog: ExerciseCatalog,
  logs7d: readonly EnginePerformanceRow[],
  logs21d: readonly EnginePerformanceRow[],
  biological?: RecoveryBiologicalProfile | null,
): WeeklyVolumeTracker;
export function createWeeklyVolumeTracker(
  catalog: ExerciseCatalog,
  logs7d: readonly EnginePerformanceRow[],
  logsOrWeekStart: readonly EnginePerformanceRow[] | string,
  biological?: RecoveryBiologicalProfile | null,
): WeeklyVolumeTracker {
  const volumeByMuscle = new Map<string, number>();
  const legacyWeekStartDate = typeof logsOrWeekStart === 'string' ? logsOrWeekStart : null;
  const chronicLogs = Array.isArray(logsOrWeekStart) ? logsOrWeekStart : logs7d;
  const acwr = computeAcwr(logs7d, chronicLogs);
  const isRecoveryMode = (acwr != null && acwr > 1.5) || biological?.hormonal_transition === true;

  const applyDelta = (muscle: string, sets: number, fraction: number, sign: 1 | -1): void => {
    if (sets <= 0) return;
    const delta = sets * fraction * sign;
    volumeByMuscle.set(muscle, (volumeByMuscle.get(muscle) ?? 0) + delta);
  };

  const addCredit = (muscle: string, sets: number, fraction: number): void => {
    applyDelta(muscle, sets, fraction, 1);
  };

  const removeCredit = (muscle: string, sets: number, fraction: number): void => {
    applyDelta(muscle, sets, fraction, -1);
  };

  for (const log of logs7d) {
    if (log.pillar !== 'iron') continue;
    if (legacyWeekStartDate) {
      const weekEndMs = weekWindowEnd(legacyWeekStartDate);
      if (!isLogInWeek(log.timestamp, legacyWeekStartDate, weekEndMs)) continue;
    }

    const exerciseId = log.payload?.iron?.exercise_id ?? log.exercise_id;
    if (!exerciseId) continue;

    const exercise = catalog.byId.get(exerciseId);
    if (!exercise) continue;

    const setCount = setsFromLog(log);
    for (const { muscle, fraction } of muscleCreditsForExercise(exercise)) {
      addCredit(muscle, setCount, fraction);
    }
  }

  const tracker: WeeklyVolumeTracker = {
    acwr,
    isRecoveryMode,

    get snapshot(): WeeklyVolumeSnapshot {
      return buildSnapshot(volumeByMuscle);
    },

    completedSetsForMuscle(muscle: string): number {
      return volumeByMuscle.get(muscle) ?? 0;
    },

    creditVolume(exercise: CatalogExercise, sets: number): void {
      for (const { muscle, fraction } of muscleCreditsForExercise(exercise)) {
        addCredit(muscle, sets, fraction);
      }
    },

    debitVolume(exercise: CatalogExercise, sets: number): void {
      for (const { muscle, fraction } of muscleCreditsForExercise(exercise)) {
        removeCredit(muscle, sets, fraction);
      }
    },

    projectSets(exercise: CatalogExercise, sets: number): ReadonlyMap<string, number> {
      const projected = new Map<string, number>();
      for (const { muscle, fraction } of muscleCreditsForExercise(exercise)) {
        const current = volumeByMuscle.get(muscle) ?? 0;
        projected.set(muscle, current + sets * fraction);
      }
      return projected;
    },

    canAddSets(exercise: CatalogExercise, sets: number): CanAddSetsResult {
      if (sets <= 0) {
        return {
          allowed: true,
          projected: tracker.projectSets(exercise, 0),
          projectedVolume: tracker.completedSetsForMuscle(exercise.primary_muscle),
          clampedSets: 0,
        };
      }

      const projected = tracker.projectSets(exercise, sets);
      const limit = tracker.isRecoveryMode ? MEV : MRV_HARD;
      for (const [muscle, total] of projected) {
        if (total > limit) {
          return {
            allowed: false,
            projected,
            projectedVolume: total,
            clampedSets: 0,
            reason: tracker.isRecoveryMode
              ? `${muscle} would reach ${total.toFixed(1)} effective sets (> ${MEV} recovery cap)`
              : `${muscle} would reach ${total.toFixed(1)} effective sets (> ${MRV_HARD} MRV)`,
          };
        }
      }

      return {
        allowed: true,
        projected,
        projectedVolume: projected.get(exercise.primary_muscle) ?? 0,
        clampedSets: sets,
      };
    },
  };

  return tracker;
}
