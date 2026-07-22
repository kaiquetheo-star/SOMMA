import type { IronExercisePrescription, MicrocycleDay } from '@/types/gameplan';
import type { BiologicalProfile } from '@/types/biological';
import type { CatalogExercise, ExerciseCatalog } from '@/lib/gameplan/engine/iron/types';
import {
  calculateVolumeBudget,
  isCompoundExercise,
  resolveEffectiveMesocyclePhase,
} from '@/lib/gameplan/engine/iron/volumePeriodization';
import { applySetFloors } from '@/lib/gameplan/engine/iron/setFloors';
import { initialBiologicalProfile } from '@/types/biological';

export { enforceWeeklyAuthority } from '@/lib/gameplan/engine/iron/volumeAuthority';

const MAX_FINISHER_OR_ISOLATION_SETS = 4;
const MAX_REASONABLE_SETS_PER_EXERCISE = 8;

export interface MicrocycleHealth {
  trainingDayCount: number;
  trainingDaysWithBlocks: number;
  restDayCount: number;
  allRest: boolean;
  meetsTrainingQuota: boolean;
}

function normalizedToken(value: string | null | undefined): string {
  return (value ?? '').toLowerCase().replace(/[\s-]+/g, '_');
}

function isIsolationOrFinisherLike(exercise: {
  slug?: string;
  display_name?: string;
  execution_technique?: string;
  target_sets: number;
  rest_seconds?: number;
}): boolean {
  const slug = normalizedToken(exercise.slug);
  const name = normalizedToken(exercise.display_name);
  const technique = normalizedToken(exercise.execution_technique);

  return (
    exercise.target_sets > MAX_REASONABLE_SETS_PER_EXERCISE ||
    technique.includes('myo') ||
    slug.includes('finisher') ||
    name.includes('finisher') ||
    /face_pull|leg_extension|leg_curl|lying_leg_curl|curl|raise|fly|pushdown|extension|pec_deck|calf/.test(slug) ||
    /face_pull|leg_extension|leg_curl|lying_leg_curl|curl|raise|fly|pushdown|extension|pec_deck|calf/.test(name)
  );
}

function sanitizeTargetSets(exercise: {
  slug?: string;
  display_name?: string;
  execution_technique?: string;
  target_sets: number;
  rest_seconds?: number;
  slot_category?: string | null;
}): number {
  const requested = Number(exercise.target_sets);
  const safe = Number.isFinite(requested) ? Math.max(1, Math.round(requested)) : 1;
  const slug = normalizedToken(exercise.slug);
  const slot = normalizedToken(exercise.slot_category);
  const isCalf =
    slug.includes('calf') || slot === 'calf_raise' || slot === 'calf_raise_seated';
  if (isCalf) {
    return Math.min(safe, 6);
  }
  if (isIsolationOrFinisherLike({ ...exercise, target_sets: safe })) {
    return Math.min(safe, MAX_FINISHER_OR_ISOLATION_SETS);
  }
  return Math.min(safe, MAX_REASONABLE_SETS_PER_EXERCISE);
}

export interface MicrocycleIronVolumeSanitizeContext {
  biological?: Pick<
    BiologicalProfile,
    'mesocycle_phase' | 'mesocycle_week' | 'hormonal_protocol'
  > | null;
  catalog?: Pick<ExerciseCatalog, 'byId' | 'bySlug'> | ReadonlyMap<string, CatalogExercise> | null;
}

function resolveCatalogExercise(
  exercise: { exercise_id: string; slug?: string },
  catalog: MicrocycleIronVolumeSanitizeContext['catalog'],
): CatalogExercise | null {
  if (!catalog) return null;
  if ('get' in catalog) {
    return catalog.get(exercise.exercise_id) ?? (exercise.slug ? catalog.get(exercise.slug) : undefined) ?? null;
  }
  return catalog.byId.get(exercise.exercise_id) ?? (exercise.slug ? catalog.bySlug.get(exercise.slug) : undefined) ?? null;
}

function sanitizeTargetSetsWithBudget(
  exercise: IronExercisePrescription,
  context?: MicrocycleIronVolumeSanitizeContext,
): IronExercisePrescription {
  const catalogExercise = resolveCatalogExercise(exercise, context?.catalog);
  if (!catalogExercise || !context?.biological) {
    return {
      ...exercise,
      target_sets: sanitizeTargetSets(exercise),
    };
  }

  const requested = Number(exercise.target_sets);
  const safe = Number.isFinite(requested) ? Math.max(1, Math.round(requested)) : 1;
  const diagnostic = normalizedToken(exercise.diagnostic_reason);
  const isForcedLowVolume =
    diagnostic.includes('deload') ||
    diagnostic.includes('rescue') ||
    diagnostic.includes('minimum_viable') ||
    diagnostic.includes('injury_constraint') ||
    diagnostic.includes('volume_authority') ||
    diagnostic.includes('recovery_volume');
  const mesocyclePhase = diagnostic.includes('deload')
    ? 'deload'
    : resolveEffectiveMesocyclePhase(
        context.biological.mesocycle_phase,
        context.biological.mesocycle_week,
      );
  const biological = {
    ...initialBiologicalProfile,
    ...context.biological,
    mesocycle_phase: mesocyclePhase,
  };
  const budget = calculateVolumeBudget(
    catalogExercise,
    biological,
    isCompoundExercise(catalogExercise),
  );

  // Once-weekly calf dose (ABCDE) may legitimately exceed the generic iso ceiling.
  const isCalfDose =
    catalogExercise.primary_muscle === 'calves' ||
    exercise.slot_category === 'calf_raise' ||
    exercise.slot_category === 'calf_raise_seated';
  const maxAllowed = isCalfDose ? Math.max(budget.maxSets, 6) : budget.maxSets;

  if (safe > maxAllowed) {
    return {
      ...exercise,
      target_sets: maxAllowed,
      diagnostic_reason: `Sanitized: ${safe} sets exceeded budget max of ${maxAllowed} for ${mesocyclePhase}`,
    };
  }

  const constitutionFloor = applySetFloors(
    safe,
    catalogExercise.tactical_role ?? exercise.tactical_role,
  );
  if (safe < constitutionFloor && mesocyclePhase !== 'deload' && !isForcedLowVolume) {
    return {
      ...exercise,
      target_sets: constitutionFloor,
      diagnostic_reason: `Adjusted to Constitution floor: ${constitutionFloor} sets`,
    };
  }

  return {
    ...exercise,
    target_sets: safe,
  };
}

export function sanitizeMicrocycleIronVolume(
  microcycle: MicrocycleDay[],
  context?: MicrocycleIronVolumeSanitizeContext,
): MicrocycleDay[] {
  return microcycle.map((day) => ({
    ...day,
    blocks: (day.blocks ?? []).map((block) => {
      if (block.pillar !== 'iron' || !block.iron) return block;
      const exercises = (block.iron.exercises ?? []).map((exercise) =>
        sanitizeTargetSetsWithBudget(exercise, context),
      );
      return {
        ...block,
        iron: {
          ...block.iron,
          exercises,
        },
      };
    }),
  }));
}

function hasRunnableTrainingBlock(day: MicrocycleDay): boolean {
  return (day.blocks ?? []).some((block) => {
    if (block.pillar !== 'iron') return true;
    return (block.iron?.exercises ?? []).length > 0;
  });
}

function hasEmptyIronWorkout(day: MicrocycleDay): boolean {
  if (day.is_rest_day) return false;
  const ironBlocks = (day.blocks ?? []).filter((block) => block.pillar === 'iron');
  return ironBlocks.length === 0 || ironBlocks.some((block) => (block.iron?.exercises ?? []).length === 0);
}

/** Count active vs rest days and whether the week matches expected training frequency. */
export function assessMicrocycleHealth(
  microcycle: MicrocycleDay[] | null | undefined,
  expectedTrainingDaysPerWeek?: number,
): MicrocycleHealth | null {
  if (!microcycle?.length) return null;

  const trainingDays = microcycle.filter((day) => !day.is_rest_day);
  const trainingDayCount = trainingDays.length;
  const trainingDaysWithBlocks = trainingDays.filter(hasRunnableTrainingBlock).length;
  const restDayCount = microcycle.length - trainingDayCount;
  const allRest = trainingDayCount === 0;

  const expected =
    expectedTrainingDaysPerWeek != null
      ? Math.min(7, Math.max(1, Math.round(expectedTrainingDaysPerWeek)))
      : null;

  const meetsTrainingQuota =
    expected == null ? !allRest : trainingDayCount >= expected;

  return {
    trainingDayCount,
    trainingDaysWithBlocks,
    restDayCount,
    allRest,
    meetsTrainingQuota,
  };
}

/** Reject cached or AI payloads that silently zero out the training week. */
export function isDegenerateMicrocycle(
  microcycle: MicrocycleDay[] | null | undefined,
  expectedTrainingDaysPerWeek?: number,
): boolean {
  const health = assessMicrocycleHealth(microcycle, expectedTrainingDaysPerWeek);
  if (!health) return true;
  return health.allRest || !health.meetsTrainingQuota || microcycle!.some(hasEmptyIronWorkout);
}
