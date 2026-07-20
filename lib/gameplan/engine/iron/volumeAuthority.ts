/**
 * Final weekly volume authority — runs after all Iron post-passes.
 * Recalculates ledger, prunes MRV_HARD overshoot → MRV_SOFT, enforces maxSetsSession.
 */
import type { ExerciseCatalog, CatalogExercise } from '@/lib/gameplan/engine/iron/types';
import type { WeeklyVolumeTracker } from '@/lib/gameplan/engine/iron/WeeklyVolumeTracker';
import {
  resolveVolumeLimitsForSplit,
  type VolumeLimits,
} from '@/lib/gameplan/engine/iron/volumeMatrix';
import type { IronExercisePrescription, MicrocycleDay } from '@/types/gameplan';
import type { PreferredSplit, UserBiological } from '@/types/biological';
import { normalizePreferredSplit } from '@/types/biological';
import { setFloorForExercise } from '@/lib/gameplan/engine/iron/setFloors';

/** @deprecated Use setFloorForExercise — kept for test imports. */
export const MIN_SETS_PER_EXERCISE = 1;
/** @deprecated Constitution compound floor is 2 via setFloors. */
export const MIN_SETS_COMPOUND = 2;
/** @deprecated Constitution isolation floor is 1 via setFloors. */
export const MIN_SETS_ISOLATION = 1;

function minSetsForExercise(catalogExercise: CatalogExercise): number {
  return setFloorForExercise(catalogExercise);
}

interface MutableExerciseRef {
  dayIndex: number;
  blockIndex: number;
  exerciseIndex: number;
  exercise: IronExercisePrescription;
  catalogExercise: CatalogExercise;
}

function resolveCatalogExercise(
  prescription: IronExercisePrescription,
  catalog: ExerciseCatalog,
): CatalogExercise | null {
  return (
    catalog.byId.get(prescription.exercise_id) ??
    (prescription.slug ? catalog.bySlug.get(prescription.slug) : undefined) ??
    null
  );
}

function cloneMicrocycle(microcycle: MicrocycleDay[]): MicrocycleDay[] {
  return microcycle.map((day) => ({
    ...day,
    blocks: (day.blocks ?? []).map((block) => {
      if (block.pillar !== 'iron' || !block.iron) return block;
      return {
        ...block,
        iron: {
          ...block.iron,
          exercises: [...(block.iron.exercises ?? [])],
        },
      };
    }),
  }));
}

function collectExerciseRefs(
  microcycle: MicrocycleDay[],
  catalog: ExerciseCatalog,
): MutableExerciseRef[] {
  const refs: MutableExerciseRef[] = [];
  for (const day of microcycle) {
    if (day.is_rest_day) continue;
    for (let blockIndex = 0; blockIndex < (day.blocks ?? []).length; blockIndex += 1) {
      const block = day.blocks![blockIndex]!;
      if (block.pillar !== 'iron' || !block.iron) continue;
      for (let exerciseIndex = 0; exerciseIndex < (block.iron.exercises ?? []).length; exerciseIndex += 1) {
        const exercise = block.iron.exercises![exerciseIndex]!;
        const catalogExercise = resolveCatalogExercise(exercise, catalog);
        if (!catalogExercise) continue;
        refs.push({
          dayIndex: day.day_index,
          blockIndex,
          exerciseIndex,
          exercise,
          catalogExercise,
        });
      }
    }
  }
  return refs;
}

function writeExercise(
  microcycle: MicrocycleDay[],
  ref: MutableExerciseRef,
  next: IronExercisePrescription,
): void {
  const day = microcycle.find((candidate) => candidate.day_index === ref.dayIndex);
  const block = day?.blocks?.[ref.blockIndex];
  if (!block?.iron?.exercises) return;
  block.iron.exercises[ref.exerciseIndex] = next;
  ref.exercise = next;
}

function trimPriority(ref: MutableExerciseRef): number {
  const diagnostic = (ref.exercise.diagnostic_reason ?? '').toLowerCase();
  const slot = (ref.exercise.slot_category ?? '').toLowerCase();
  const technique = (ref.exercise.execution_technique ?? '').toLowerCase();
  let score = 0;
  if (diagnostic.includes('fallback') || diagnostic.includes('minimum_viable') || diagnostic.includes('rescue')) {
    score += 1000;
  }
  if (slot.includes('finisher') || technique.includes('drop') || technique.includes('myo')) {
    score += 500;
  }
  if (ref.catalogExercise.movement_pattern === 'isolation') score += 200;
  score += Math.max(0, 100 - Math.round(ref.catalogExercise.selection_score * 10));
  score += ref.dayIndex;
  return score;
}

function compareTrimOrder(a: MutableExerciseRef, b: MutableExerciseRef): number {
  const priorityDelta = trimPriority(b) - trimPriority(a);
  if (priorityDelta !== 0) return priorityDelta;
  const setDelta = b.exercise.target_sets - a.exercise.target_sets;
  if (setDelta !== 0) return setDelta;
  return (a.exercise.slug ?? a.exercise.exercise_id).localeCompare(
    b.exercise.slug ?? b.exercise.exercise_id,
  );
}

function rebuildPrimaryVolume(refs: readonly MutableExerciseRef[]): Map<string, number> {
  const byMuscle = new Map<string, number>();
  for (const ref of refs) {
    const muscle = ref.catalogExercise.primary_muscle;
    byMuscle.set(muscle, (byMuscle.get(muscle) ?? 0) + Math.max(0, ref.exercise.target_sets));
  }
  return byMuscle;
}

function debitOneSet(
  microcycle: MicrocycleDay[],
  ref: MutableExerciseRef,
  reason: string,
): void {
  if (ref.exercise.target_sets <= minSetsForExercise(ref.catalogExercise)) return;
  writeExercise(microcycle, ref, {
    ...ref.exercise,
    target_sets: ref.exercise.target_sets - 1,
    diagnostic_reason: reason,
  });
}

function enforceMinSetsPerExercise(
  microcycle: MicrocycleDay[],
  refs: MutableExerciseRef[],
): void {
  for (const ref of refs) {
    const floor = minSetsForExercise(ref.catalogExercise);
    if (ref.exercise.target_sets > 0 && ref.exercise.target_sets < floor) {
      writeExercise(microcycle, ref, {
        ...ref.exercise,
        target_sets: floor,
        diagnostic_reason:
          ref.exercise.diagnostic_reason ?? 'volume_authority_min_sets_floor',
      });
    }
  }
}

function pruneMuscleToSoftCap(
  microcycle: MicrocycleDay[],
  refs: MutableExerciseRef[],
  muscle: string,
  mrvSoft: number,
): void {
  let volume = rebuildPrimaryVolume(refs).get(muscle) ?? 0;
  while (volume > mrvSoft) {
    const candidates = refs
      .filter(
        (ref) =>
          ref.catalogExercise.primary_muscle === muscle &&
          ref.exercise.target_sets > minSetsForExercise(ref.catalogExercise),
      )
      .sort(compareTrimOrder);
    const victim = candidates[0];
    if (!victim) break;
    debitOneSet(microcycle, victim, 'volume_authority_mrv_soft_cap');
    volume -= 1;
  }
}

function enforceMaxSetsSession(
  microcycle: MicrocycleDay[],
  refs: MutableExerciseRef[],
  maxSetsSession: number,
): void {
  const dayMuscles = new Map<string, MutableExerciseRef[]>();
  for (const ref of refs) {
    const key = `${ref.dayIndex}::${ref.catalogExercise.primary_muscle}`;
    const bucket = dayMuscles.get(key) ?? [];
    bucket.push(ref);
    dayMuscles.set(key, bucket);
  }

  for (const bucket of dayMuscles.values()) {
    let sessionSets = bucket.reduce((sum, ref) => sum + ref.exercise.target_sets, 0);
    while (sessionSets > maxSetsSession) {
      const candidates = bucket
        .filter((ref) => ref.exercise.target_sets > minSetsForExercise(ref.catalogExercise))
        .sort(compareTrimOrder);
      const victim = candidates[0];
      if (!victim) break;
      debitOneSet(microcycle, victim, 'volume_authority_max_sets_session');
      sessionSets -= 1;
    }
  }
}

export interface EnforceWeeklyAuthorityOptions {
  preferredSplit?: PreferredSplit | string | null;
  biological?: Pick<UserBiological, 'hormonal_protocol' | 'hormonal_transition'> | null;
}

/**
 * Post-pass volume authority for UI-bound microcycles.
 * Deterministic: trim order is priority → sets → slug.
 */
export function enforceWeeklyAuthority(
  microcycle: MicrocycleDay[],
  tracker: Pick<WeeklyVolumeTracker, 'snapshot'>,
  catalog: ExerciseCatalog,
  preferredSplitOrOptions?: PreferredSplit | string | null | EnforceWeeklyAuthorityOptions,
): MicrocycleDay[] {
  const options: EnforceWeeklyAuthorityOptions =
    preferredSplitOrOptions != null &&
    typeof preferredSplitOrOptions === 'object' &&
    !Array.isArray(preferredSplitOrOptions)
      ? preferredSplitOrOptions
      : { preferredSplit: preferredSplitOrOptions as PreferredSplit | string | null | undefined };

  const next = cloneMicrocycle(microcycle);
  const split = options.preferredSplit ?? null;
  const limits: VolumeLimits = {
    mev: tracker.snapshot.mev,
    mrvSoft: tracker.snapshot.mrvSoft,
    mrvHard: tracker.snapshot.mrvHard,
    maxSetsSession: tracker.snapshot.maxSetsSession,
  };

  const matrixLimits = resolveVolumeLimitsForSplit(
    normalizePreferredSplit(split),
    options.biological,
  );
  const mrvSoft = limits.mrvSoft || matrixLimits.mrvSoft;
  const mrvHard = limits.mrvHard || matrixLimits.mrvHard;
  const maxSetsSession = limits.maxSetsSession || matrixLimits.maxSetsSession;

  let refs = collectExerciseRefs(next, catalog);

  let volumeByMuscle = rebuildPrimaryVolume(refs);
  const overshotMuscles = [...volumeByMuscle.entries()]
    .filter(([, total]) => total > mrvHard)
    .map(([muscle]) => muscle)
    .sort((a, b) => a.localeCompare(b));

  for (const muscle of overshotMuscles) {
    pruneMuscleToSoftCap(next, refs, muscle, mrvSoft);
    refs = collectExerciseRefs(next, catalog);
  }

  enforceMaxSetsSession(next, refs, maxSetsSession);
  refs = collectExerciseRefs(next, catalog);
  enforceMinSetsPerExercise(next, refs);

  return next;
}

/** Test / diagnostics helper — primary-muscle weekly totals after authority. */
export function primaryWeeklyVolumeSnapshot(
  microcycle: MicrocycleDay[],
  catalog: ExerciseCatalog,
): ReadonlyMap<string, number> {
  return rebuildPrimaryVolume(collectExerciseRefs(microcycle, catalog));
}
