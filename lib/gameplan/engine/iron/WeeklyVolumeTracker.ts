import type {
  CatalogExercise,
  ExerciseCatalog,
  WeeklyVolumeSnapshot,
} from '@/lib/gameplan/engine/iron/types';
import type { EnginePerformanceRow } from '@/lib/gameplan/engine/performanceLogs';
import {
  rowExerciseId,
  rowExerciseSlug,
} from '@/lib/gameplan/engine/iron/exerciseLogMatch';
import {
  defaultVolumeCreditContext,
  resolveVolumeLimitsForSplit,
  synergistFractionForMuscle,
  VOLUME_MATRIX,
  type VolumeCreditContext,
  type VolumeLimits,
} from '@/lib/gameplan/engine/iron/volumeMatrix';
import type { PreferredSplit, UserBiological } from '@/types/biological';

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

export type { VolumeCreditContext, VolumeLimits };
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
  /** Slug-keyed ledger of credited sets (resilient to catalog UUID regeneration). */
  readonly weeklySlugLedger: ReadonlyMap<string, number>;
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

type TrackerBiologicalProfile = Partial<UserBiological> & {
  hormonal_transition?: boolean | null;
};

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
 * Resolve catalog exercise slug-first: prefer live slug match when UUID is stale
 * (catalog regenerated) so volume credit still lands.
 */
export function resolveExerciseSlugFirst(
  catalog: ExerciseCatalog,
  exercise: Pick<CatalogExercise, 'id' | 'slug'>,
): CatalogExercise | null {
  const bySlug = exercise.slug ? catalog.bySlug.get(exercise.slug) : undefined;
  if (bySlug) return bySlug;
  return catalog.byId.get(exercise.id) ?? null;
}

function resolveExerciseFromLog(
  catalog: ExerciseCatalog,
  log: EnginePerformanceRow,
): CatalogExercise | null {
  const slug = rowExerciseSlug(log);
  if (slug) {
    const bySlug = catalog.bySlug.get(slug);
    if (bySlug) return bySlug;
  }
  const exerciseId = rowExerciseId(log);
  if (exerciseId) {
    return catalog.byId.get(exerciseId) ?? null;
  }
  return null;
}

function resolvePreferredSplit(
  biologicalOrSplit?: TrackerBiologicalProfile | PreferredSplit | null,
): PreferredSplit | null | undefined {
  if (typeof biologicalOrSplit === 'string') return biologicalOrSplit;
  return biologicalOrSplit?.preferred_split;
}

function resolveBiological(
  biologicalOrSplit?: TrackerBiologicalProfile | PreferredSplit | null,
): TrackerBiologicalProfile | null {
  if (biologicalOrSplit == null || typeof biologicalOrSplit === 'string') return null;
  return biologicalOrSplit;
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
  biological?: TrackerBiologicalProfile | null,
  creditContext?: VolumeCreditContext,
): WeeklyVolumeTracker;
export function createWeeklyVolumeTracker(
  catalog: ExerciseCatalog,
  logs7d: readonly EnginePerformanceRow[],
  logsOrWeekStart: readonly EnginePerformanceRow[] | string,
  biologicalOrSplit?: TrackerBiologicalProfile | PreferredSplit | null,
  initialCreditContext?: VolumeCreditContext,
): WeeklyVolumeTracker {
  const volumeByMuscle = new Map<string, number>();
  /** Slug → credited sets this week (UUID-regeneration resilient). */
  const weeklySlugLedger = new Map<string, number>();
  const legacyWeekStartDate = typeof logsOrWeekStart === 'string' ? logsOrWeekStart : null;
  const biological = resolveBiological(biologicalOrSplit);
  const preferredSplit = resolvePreferredSplit(biologicalOrSplit);
  const volumeLimits = resolveVolumeLimitsForSplit(preferredSplit, biological);

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

  const recordSlugLedger = (slug: string, sets: number, sign: 1 | -1): void => {
    const safeSets = sanitizeSetCount(sets);
    if (!slug || safeSets <= 0) return;
    weeklySlugLedger.set(slug, (weeklySlugLedger.get(slug) ?? 0) + safeSets * sign);
  };

  const logCreditContext = defaultVolumeCreditContext(preferredSplit);

  for (const log of logs7d) {
    if (log.pillar !== 'iron') continue;
    if (legacyWeekStartDate) {
      const weekEndMs = weekWindowEnd(legacyWeekStartDate);
      if (!isLogInWeek(log.timestamp, legacyWeekStartDate, weekEndMs)) continue;
    }

    const exercise = resolveExerciseFromLog(catalog, log);
    if (!exercise) continue;

    const setCount = setsFromLog(log);
    recordSlugLedger(exercise.slug, setCount, 1);
    for (const { muscle, fraction } of muscleCreditsForExercise(exercise, logCreditContext)) {
      addCredit(muscle, setCount, fraction);
    }
  }

  const tracker: WeeklyVolumeTracker = {
    get weeklySlugLedger(): ReadonlyMap<string, number> {
      return weeklySlugLedger;
    },

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
      const resolved = resolveExerciseSlugFirst(catalog, exercise) ?? exercise;
      const safeSets = sanitizeSetCount(sets);
      recordSlugLedger(resolved.slug, safeSets, 1);
      for (const { muscle, fraction } of muscleCreditsForExercise(resolved, creditContext)) {
        addCredit(muscle, safeSets, fraction);
      }
    },

    debitVolume(exercise: CatalogExercise, sets: number): void {
      const resolved = resolveExerciseSlugFirst(catalog, exercise) ?? exercise;
      const safeSets = sanitizeSetCount(sets);
      recordSlugLedger(resolved.slug, safeSets, -1);
      for (const { muscle, fraction } of muscleCreditsForExercise(resolved, creditContext)) {
        removeCredit(muscle, safeSets, fraction);
      }
    },

    projectSets(exercise: CatalogExercise, sets: number): ReadonlyMap<string, number> {
      const resolved = resolveExerciseSlugFirst(catalog, exercise) ?? exercise;
      const safeSets = sanitizeSetCount(sets);
      const projected = new Map<string, number>();
      for (const { muscle, fraction } of muscleCreditsForExercise(resolved, creditContext)) {
        const current = volumeByMuscle.get(muscle) ?? 0;
        projected.set(muscle, current + safeSets * fraction);
      }
      return projected;
    },

    canAddSets(exercise: CatalogExercise, sets: number): CanAddSetsResult {
      const resolved = resolveExerciseSlugFirst(catalog, exercise) ?? exercise;
      const safeSets = sanitizeSetCount(sets);

      if (safeSets <= 0) {
        return {
          allowed: true,
          projected: tracker.projectSets(resolved, 0),
          projectedVolume: tracker.completedSetsForMuscle(resolved.primary_muscle),
          clampedSets: 0,
        };
      }

      const limit = volumeLimits.mrvHard;
      let candidateSets = safeSets;

      while (candidateSets > 0) {
        const projected = tracker.projectSets(resolved, candidateSets);
        let withinHard = true;
        let projectedVolume = projected.get(resolved.primary_muscle) ?? 0;

        for (const [muscle, total] of projected) {
          if (total > limit) {
            withinHard = false;
            projectedVolume = total;
            break;
          }
        }

        if (withinHard) {
          const fullyFits = candidateSets === safeSets;
          return {
            allowed: fullyFits,
            projected,
            projectedVolume,
            clampedSets: candidateSets,
            reason: fullyFits
              ? undefined
              : `${resolved.primary_muscle} clamped to ${candidateSets} sets to respect MRV_HARD ${limit}`,
          };
        }

        candidateSets -= 1;
      }

      const projected = tracker.projectSets(resolved, 0);
      return {
        allowed: false,
        projected,
        projectedVolume: tracker.completedSetsForMuscle(resolved.primary_muscle),
        clampedSets: 0,
        reason: `${resolved.primary_muscle} already at or above MRV_HARD ${limit}`,
      };
    },
  };

  return tracker;
}
