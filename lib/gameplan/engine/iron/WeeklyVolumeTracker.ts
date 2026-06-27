import type {
  CatalogExercise,
  ExerciseCatalog,
  WeeklyVolumeSnapshot,
} from '@/lib/gameplan/engine/iron/types';
import type { EnginePerformanceRow } from '@/lib/gameplan/engine/performanceLogs';
import {
  defaultVolumeCreditContext,
  resolveVolumeLimitsForSplit,
  synergistFractionForMuscle,
  type VolumeCreditContext,
  type VolumeLimits,
  VOLUME_MATRIX,
} from '@/lib/gameplan/engine/iron/volumeMatrix';
import type { BiologicalProfile, PreferredSplit } from '@/types/biological';

/** Minimum effective volume / muscle / week (MEV) — 2× frequency splits (PPL). */
export const MEV = VOLUME_MATRIX.twice_per_week.mev;

/** Soft maximum — scoring penalty zone begins above this (2× frequency). */
export const MRV_SOFT = VOLUME_MATRIX.twice_per_week.mrvSoft;

/** Hard maximum — exercises that would exceed this are rejected (2× frequency). */
export const MRV_HARD = VOLUME_MATRIX.twice_per_week.mrvHard;

/** ABCDE (1× muscle frequency) volume landmarks. */
export const ABCDE_MEV = VOLUME_MATRIX.once_per_week.mev;
export const ABCDE_MRV_SOFT = VOLUME_MATRIX.once_per_week.mrvSoft;
export const ABCDE_MRV_HARD = VOLUME_MATRIX.once_per_week.mrvHard;

export type { VolumeLimits, VolumeCreditContext };
export {
  resolveVolumeLimitsForSplit,
  VOLUME_MATRIX,
} from '@/lib/gameplan/engine/iron/volumeMatrix';

/** @deprecated Use `VOLUME_MATRIX.once_per_week.synergistFractionDefault`. */
export const SYNERGIST_FRACTION = VOLUME_MATRIX.once_per_week.synergistFractionDefault;

/** Per-exercise safety cap for imported/projected set counts. */
export const MAX_TRACKED_SETS_PER_EXERCISE = 8;

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
  setVolumeCreditContext(context: VolumeCreditContext): void;
  creditVolume(exercise: CatalogExercise, sets: number): void;
  debitVolume(exercise: CatalogExercise, sets: number): void;
  canAddSets(exercise: CatalogExercise, sets: number): CanAddSetsResult;
  projectSets(exercise: CatalogExercise, sets: number): ReadonlyMap<string, number>;
}

interface MuscleCredit {
  muscle: string;
  fraction: number;
}

function sanitizeSetCount(sets: number): number {
  if (!Number.isFinite(sets) || sets <= 0) return 0;
  return Math.min(sets, MAX_TRACKED_SETS_PER_EXERCISE);
}

function setsFromLog(log: EnginePerformanceRow): number {
  const fromPayload = log.payload?.iron?.sets?.length;
  if (fromPayload != null && fromPayload > 0) return sanitizeSetCount(fromPayload);
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

  // Regra 2.2: ACWR = acute 7d load / chronic 21d weekly average.
  const chronicWeeklyAverage = chronicLoad / 3;
  if (chronicWeeklyAverage <= 0) return null;

  return Math.round((acuteLoad / chronicWeeklyAverage) * 100) / 100;
}

type RecoveryBiologicalProfile = Partial<BiologicalProfile> & {
  hormonal_transition?: boolean | null;
};

function muscleCreditsForExercise(
  exercise: CatalogExercise,
  creditContext: VolumeCreditContext,
): readonly MuscleCredit[] {
  const credits: MuscleCredit[] = [{ muscle: exercise.primary_muscle, fraction: 1 }];
  for (const synergist of exercise.synergist_muscles) {
    credits.push({
      muscle: synergist,
      fraction: synergistFractionForMuscle(synergist, creditContext),
    });
  }
  return credits;
}

function buildSnapshot(
  volumeByMuscle: ReadonlyMap<string, number>,
  limits: VolumeLimits,
): WeeklyVolumeSnapshot {
  return Object.freeze({
    byMuscle: volumeByMuscle,
    mev: limits.mev,
    mrvSoft: limits.mrvSoft,
    mrvHard: limits.mrvHard,
    maxSetsSession: limits.maxSetsSession,
  });
}

/**
 * Rolling 7-day effective set ledger.
 * Primary 1.0×; synergists use split-adaptive fractions from `volumeMatrix`.
 */
export function createWeeklyVolumeTracker(
  catalog: ExerciseCatalog,
  logs7d: readonly EnginePerformanceRow[],
  weekStartDate: string,
  preferredSplit?: PreferredSplit | null,
): WeeklyVolumeTracker;
export function createWeeklyVolumeTracker(
  catalog: ExerciseCatalog,
  logs7d: readonly EnginePerformanceRow[],
  logs21d: readonly EnginePerformanceRow[],
  biological?: RecoveryBiologicalProfile | null,
  creditContext?: VolumeCreditContext,
): WeeklyVolumeTracker;
export function createWeeklyVolumeTracker(
  catalog: ExerciseCatalog,
  logs7d: readonly EnginePerformanceRow[],
  logsOrWeekStart: readonly EnginePerformanceRow[] | string,
  biologicalOrSplit?: RecoveryBiologicalProfile | PreferredSplit | null,
  initialCreditContext?: VolumeCreditContext,
): WeeklyVolumeTracker {
  const volumeByMuscle = new Map<string, number>();
  const legacyWeekStartDate = typeof logsOrWeekStart === 'string' ? logsOrWeekStart : null;
  const chronicLogs = Array.isArray(logsOrWeekStart) ? logsOrWeekStart : logs7d;
  const biological =
    biologicalOrSplit != null &&
    typeof biologicalOrSplit === 'object' &&
    !Array.isArray(biologicalOrSplit)
      ? biologicalOrSplit
      : null;
  const preferredSplit =
    typeof biologicalOrSplit === 'string'
      ? biologicalOrSplit
      : biological?.preferred_split;
  const volumeLimits = resolveVolumeLimitsForSplit(preferredSplit);
  const acwr = computeAcwr(logs7d, chronicLogs);
  const isRecoveryMode = (acwr != null && acwr > 1.5) || biological?.hormonal_transition === true;

  let creditContext: VolumeCreditContext =
    initialCreditContext ?? defaultVolumeCreditContext(preferredSplit);

  const applyDelta = (muscle: string, sets: number, fraction: number, sign: 1 | -1): void => {
    const safeSets = sanitizeSetCount(sets);
    if (safeSets <= 0) return;
    const delta = safeSets * fraction * sign;
    volumeByMuscle.set(muscle, (volumeByMuscle.get(muscle) ?? 0) + delta);
  };

  const addCredit = (muscle: string, sets: number, fraction: number): void => {
    applyDelta(muscle, sets, fraction, 1);
  };

  const removeCredit = (muscle: string, sets: number, fraction: number): void => {
    applyDelta(muscle, sets, fraction, -1);
  };

  const logCreditContext = defaultVolumeCreditContext(preferredSplit);

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
    for (const { muscle, fraction } of muscleCreditsForExercise(exercise, logCreditContext)) {
      addCredit(muscle, setCount, fraction);
    }
  }

  const tracker: WeeklyVolumeTracker = {
    acwr,
    isRecoveryMode,

    get snapshot(): WeeklyVolumeSnapshot {
      return buildSnapshot(volumeByMuscle, volumeLimits);
    },

    completedSetsForMuscle(muscle: string): number {
      return volumeByMuscle.get(muscle) ?? 0;
    },

    setVolumeCreditContext(context: VolumeCreditContext): void {
      creditContext = {
        frequencyClass: context.frequencyClass,
        dayFocusMuscles: new Set(context.dayFocusMuscles),
      };
    },

    creditVolume(exercise: CatalogExercise, sets: number): void {
      const safeSets = sanitizeSetCount(sets);
      for (const { muscle, fraction } of muscleCreditsForExercise(exercise, creditContext)) {
        addCredit(muscle, safeSets, fraction);
      }
    },

    debitVolume(exercise: CatalogExercise, sets: number): void {
      const safeSets = sanitizeSetCount(sets);
      for (const { muscle, fraction } of muscleCreditsForExercise(exercise, creditContext)) {
        removeCredit(muscle, safeSets, fraction);
      }
    },

    projectSets(exercise: CatalogExercise, sets: number): ReadonlyMap<string, number> {
      const safeSets = sanitizeSetCount(sets);
      const projected = new Map<string, number>();
      for (const { muscle, fraction } of muscleCreditsForExercise(exercise, creditContext)) {
        const current = volumeByMuscle.get(muscle) ?? 0;
        projected.set(muscle, current + safeSets * fraction);
      }
      return projected;
    },

    canAddSets(exercise: CatalogExercise, sets: number): CanAddSetsResult {
      const safeSets = sanitizeSetCount(sets);
      if (safeSets <= 0) {
        return {
          allowed: true,
          projected: tracker.projectSets(exercise, 0),
          projectedVolume: tracker.completedSetsForMuscle(exercise.primary_muscle),
          clampedSets: 0,
        };
      }

      const projected = tracker.projectSets(exercise, safeSets);
      const limit = volumeLimits.mrvHard;
      for (const [muscle, total] of projected) {
        if (total > limit) {
          return {
            allowed: false,
            projected,
            projectedVolume: total,
            clampedSets: 0,
            reason: `${muscle} would reach ${total.toFixed(1)} effective sets (> ${limit} MRV)`,
          };
        }
      }

      return {
        allowed: true,
        projected,
        projectedVolume: projected.get(exercise.primary_muscle) ?? 0,
        clampedSets: safeSets,
      };
    },
  };

  return tracker;
}
