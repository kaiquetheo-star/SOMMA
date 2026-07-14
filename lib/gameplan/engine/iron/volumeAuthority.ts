/**
 * Final weekly volume authority — runs after all Iron post-passes.
 * Recalculates ledger, prunes MRV_HARD overshoot → MRV_SOFT, enforces maxSetsSession,
 * and applies Recovery Composition Policy (additive levers, 40% floor).
 */
import type { ExerciseCatalog, CatalogExercise } from '@/lib/gameplan/engine/iron/types';
import type { WeeklyVolumeTracker } from '@/lib/gameplan/engine/iron/WeeklyVolumeTracker';
import {
  resolveVolumeLimitsForSplit,
  type VolumeLimits,
} from '@/lib/gameplan/engine/iron/volumeMatrix';
import {
  applyRecoveryCompositionToSets,
  composeRecoveryFromSignals,
  type RecoveryVolumeSignals,
} from '@/lib/gameplan/engine/iron/recoveryComposition';
import type { IronExercisePrescription, MicrocycleDay } from '@/types/gameplan';
import type { PreferredSplit } from '@/types/biological';
import { normalizePreferredSplit } from '@/types/biological';

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
  if (ref.exercise.target_sets <= 1) return;
  writeExercise(microcycle, ref, {
    ...ref.exercise,
    target_sets: ref.exercise.target_sets - 1,
    diagnostic_reason: reason,
  });
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
          ref.catalogExercise.primary_muscle === muscle && ref.exercise.target_sets > 1,
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
        .filter((ref) => ref.exercise.target_sets > 1)
        .sort(compareTrimOrder);
      const victim = candidates[0];
      if (!victim) break;
      debitOneSet(microcycle, victim, 'volume_authority_max_sets_session');
      sessionSets -= 1;
    }
  }
}

function applyComposedRecoveryScale(
  microcycle: MicrocycleDay[],
  refs: MutableExerciseRef[],
  signals: RecoveryVolumeSignals,
): void {
  const composition = composeRecoveryFromSignals(signals);
  if (composition.totalPenalty <= 0) return;

  for (const ref of refs) {
    const scaled = applyRecoveryCompositionToSets(ref.exercise.target_sets, composition);
    if (scaled === ref.exercise.target_sets) continue;
    writeExercise(microcycle, ref, {
      ...ref.exercise,
      target_sets: scaled,
      diagnostic_reason:
        ref.exercise.diagnostic_reason ??
        `recovery_composition_${composition.dominant ?? 'none'}`,
    });
  }
}

export interface EnforceWeeklyAuthorityOptions {
  preferredSplit?: PreferredSplit | string | null;
  /** Extra recovery levers beyond tracker.isRecoveryMode (ACWR). */
  recoverySignals?: Omit<RecoveryVolumeSignals, 'acwr'>;
}

/**
 * Post-pass volume authority for UI-bound microcycles.
 * Deterministic: trim order is priority → sets → slug.
 */
export function enforceWeeklyAuthority(
  microcycle: MicrocycleDay[],
  tracker: Pick<WeeklyVolumeTracker, 'isRecoveryMode' | 'snapshot'>,
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

  // Prefer matrix limits when snapshot is stale (e.g. empty week start).
  const matrixLimits = resolveVolumeLimitsForSplit(normalizePreferredSplit(split));
  const mrvSoft = limits.mrvSoft || matrixLimits.mrvSoft;
  const mrvHard = limits.mrvHard || matrixLimits.mrvHard;
  const maxSetsSession = limits.maxSetsSession || matrixLimits.maxSetsSession;

  let refs = collectExerciseRefs(next, catalog);

  // a)+b) Recalculate and prune any primary muscle above MRV_HARD down to MRV_SOFT.
  let volumeByMuscle = rebuildPrimaryVolume(refs);
  const overshotMuscles = [...volumeByMuscle.entries()]
    .filter(([, total]) => total > mrvHard)
    .map(([muscle]) => muscle)
    .sort((a, b) => a.localeCompare(b));

  for (const muscle of overshotMuscles) {
    pruneMuscleToSoftCap(next, refs, muscle, mrvSoft);
    refs = collectExerciseRefs(next, catalog);
  }

  // c) Per-day primary muscle session cap.
  enforceMaxSetsSession(next, refs, maxSetsSession);
  refs = collectExerciseRefs(next, catalog);

  // Recovery composition: ACWR + Readiness + RPE + Injector (additive, 40% floor).
  const recoverySignals: RecoveryVolumeSignals = {
    acwr: tracker.isRecoveryMode,
    readiness: options.recoverySignals?.readiness === true,
    rpe: options.recoverySignals?.rpe === true,
    mapper: options.recoverySignals?.mapper === true,
    injector: options.recoverySignals?.injector === true,
  };
  if (
    recoverySignals.acwr ||
    recoverySignals.readiness ||
    recoverySignals.rpe ||
    recoverySignals.injector
  ) {
    applyComposedRecoveryScale(next, refs, recoverySignals);
  }

  return next;
}

/** Test / diagnostics helper — primary-muscle weekly totals after authority. */
export function primaryWeeklyVolumeSnapshot(
  microcycle: MicrocycleDay[],
  catalog: ExerciseCatalog,
): ReadonlyMap<string, number> {
  return rebuildPrimaryVolume(collectExerciseRefs(microcycle, catalog));
}
